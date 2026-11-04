import { connect, type ClientHttp2Session } from "node:http2";
import { createPrivateKey, sign } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, skillSyncPushDevicesTable } from "@workspace/db";
import { logger } from "./logger";

export type SkillSyncPushPayload = {
  event: "partner_message" | "ai_reply" | "activity_ready" | "solution_ready";
  title: string;
  body: string;
  roomId: string;
  activityId?: string;
};

type ApnsEnvironment = "development" | "production";
type RegisteredDevice = typeof skillSyncPushDevicesTable.$inferSelect;

const bundleId = "ai.skillsync.native";
let cachedJwt: { value: string; expiresAt: number } | null = null;
let missingConfigWarningSent = false;

function providerCredentials() {
  const teamId = process.env.APNS_TEAM_ID?.trim();
  const keyId = process.env.APNS_KEY_ID?.trim();
  const privateKey = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!teamId || !keyId || !privateKey) return null;
  return { teamId, keyId, privateKey };
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function providerJwt(): string | null {
  const credentials = providerCredentials();
  if (!credentials) return null;
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.expiresAt > now + 60) return cachedJwt.value;

  const header = base64Url(JSON.stringify({ alg: "ES256", kid: credentials.keyId }));
  const claims = base64Url(JSON.stringify({ iss: credentials.teamId, iat: now }));
  const signingInput = `${header}.${claims}`;
  const signature = sign("sha256", Buffer.from(signingInput), {
    key: createPrivateKey(credentials.privateKey),
    dsaEncoding: "ieee-p1363",
  });
  const value = `${signingInput}.${base64Url(signature)}`;
  cachedJwt = { value, expiresAt: now + 50 * 60 };
  return value;
}

function apnsRequest(
  host: string,
  token: string,
  jwt: string,
  payload: SkillSyncPushPayload,
): Promise<{ status: number; response: string }> {
  return new Promise((resolve, reject) => {
    let session: ClientHttp2Session | undefined;
    let settled = false;
    let status = 0;
    let response = "";
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      session?.close();
      if (error) reject(error);
      else resolve({ status, response });
    };
    const timer = setTimeout(() => {
      session?.destroy();
      finish(new Error("APNs request timed out."));
    }, 10_000);

    try {
      session = connect(`https://${host}`);
      session.once("error", (error) => finish(error));
      const request = session.request({
        ":method": "POST",
        ":path": `/3/device/${token}`,
        authorization: `bearer ${jwt}`,
        "apns-topic": bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
      });
      request.setEncoding("utf8");
      request.on("response", (headers) => {
        status = Number(headers[":status"] ?? 0);
      });
      request.on("data", (chunk: string) => {
        response += chunk;
      });
      request.once("error", (error) => finish(error));
      request.once("end", () => finish());
      request.end(JSON.stringify({
        aps: {
          alert: { title: payload.title, body: payload.body },
          sound: "default",
        },
        skillSync: {
          event: payload.event,
          roomId: payload.roomId,
          activityId: payload.activityId,
          route: `/rooms/${encodeURIComponent(payload.roomId)}`,
        },
      }));
    } catch (error) {
      finish(error instanceof Error ? error : new Error("Could not open an APNs connection."));
    }
  });
}

async function sendToDevice(device: RegisteredDevice, payload: SkillSyncPushPayload, jwt: string) {
  const host = device.environment === "production"
    ? "api.push.apple.com"
    : "api.sandbox.push.apple.com";
  const result = await apnsRequest(host, device.token, jwt, payload);
  if (result.status >= 200 && result.status < 300) return;

  if (result.status === 410) {
    await db.delete(skillSyncPushDevicesTable).where(eq(skillSyncPushDevicesTable.token, device.token));
  }
  logger.warn(
    { status: result.status, environment: device.environment, response: result.response.slice(0, 500) },
    "APNs did not accept a SkillSync notification",
  );
}

/**
 * Delivers push alerts out of band. Provider outages must never fail a chat,
 * activity-generation, or simulator request.
 */
export function notifySkillSyncUsers(userIds: string[], payload: SkillSyncPushPayload) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (!uniqueUserIds.length) return;

  void (async () => {
    const jwt = providerJwt();
    if (!jwt) {
      if (!missingConfigWarningSent) {
        missingConfigWarningSent = true;
        logger.warn(
          { required: ["APNS_TEAM_ID", "APNS_KEY_ID", "APNS_PRIVATE_KEY"] },
          "APNs delivery is disabled until Apple push credentials are configured",
        );
      }
      return;
    }
    const devices = await db.select().from(skillSyncPushDevicesTable)
      .where(inArray(skillSyncPushDevicesTable.userId, uniqueUserIds));
    const results = await Promise.allSettled(devices.map((device) => sendToDevice(device, payload, jwt)));
    for (const result of results) {
      if (result.status === "rejected") {
        logger.warn({ err: result.reason, event: payload.event }, "Could not send a SkillSync push notification");
      }
    }
  })().catch((error) => {
    logger.warn({ err: error, event: payload.event }, "Could not prepare SkillSync push notifications");
  });
}
