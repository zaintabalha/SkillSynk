import { randomUUID } from "node:crypto";
import { File, Storage } from "@google-cloud/storage";

const SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${SIDECAR_ENDPOINT}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

function privateObjectDir(): string {
  const directory = process.env.PRIVATE_OBJECT_DIR?.trim().replace(/\/+$/, "");
  if (!directory) throw new Error("Private object storage is not configured.");
  return directory;
}

function parseBucketObjectPath(path: string): { bucketName: string; objectName: string } {
  const parts = path.replace(/^\/+/, "").split("/");
  if (parts.length < 3 || !parts[0] || !parts.slice(1).join("/")) {
    throw new Error("Invalid private object path.");
  }
  return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
}

function pathFor(roomId: string, mediaId: string): string {
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(roomId) || !/^[0-9a-f-]{36}$/i.test(mediaId)) {
    throw new Error("Invalid room media identifier.");
  }
  return `/objects/uploads/skillsync/${roomId}/${mediaId}`;
}

function toBucketObjectPath(mediaObjectPath: string): string {
  if (!mediaObjectPath.startsWith("/objects/uploads/skillsync/")) {
    throw new Error("Invalid room media path.");
  }
  return `${privateObjectDir()}${mediaObjectPath.slice("/objects".length)}`;
}

export function newRoomMediaId(): string {
  return randomUUID();
}

export async function createRoomMediaUploadUrl(
  roomId: string,
  mediaId: string,
): Promise<{ uploadUrl: string; mediaObjectPath: string }> {
  const mediaObjectPath = pathFor(roomId, mediaId);
  const { bucketName, objectName } = parseBucketObjectPath(toBucketObjectPath(mediaObjectPath));
  const response = await fetch(`${SIDECAR_ENDPOINT}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method: "PUT",
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Object storage could not create an upload URL (HTTP ${response.status}).`);
  }
  const payload = await response.json() as { signed_url?: unknown };
  if (typeof payload.signed_url !== "string" || !payload.signed_url.startsWith("https://")) {
    throw new Error("Object storage returned an invalid upload URL.");
  }
  return { uploadUrl: payload.signed_url, mediaObjectPath };
}

export function roomMediaObjectPath(roomId: string, mediaId: string): string {
  return pathFor(roomId, mediaId);
}

export async function getRoomMediaFile(roomId: string, mediaId: string): Promise<File | null> {
  const objectPath = pathFor(roomId, mediaId);
  const { bucketName, objectName } = parseBucketObjectPath(toBucketObjectPath(objectPath));
  const file = storage.bucket(bucketName).file(objectName);
  const [exists] = await file.exists();
  return exists ? file : null;
}

export async function deleteRoomMediaFile(roomId: string, mediaId: string): Promise<void> {
  const file = await getRoomMediaFile(roomId, mediaId);
  if (file) await file.delete();
}

export async function readRoomMediaFile(file: File): Promise<Buffer> {
  const [contents] = await file.download();
  return contents;
}
