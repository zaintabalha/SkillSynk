"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/lib/skillsync-media-storage.ts
var skillsync_media_storage_exports = {};
__export(skillsync_media_storage_exports, {
  createRoomMediaUploadUrl: () => createRoomMediaUploadUrl,
  deleteRoomMediaFile: () => deleteRoomMediaFile,
  getRoomMediaFile: () => getRoomMediaFile,
  newRoomMediaId: () => newRoomMediaId,
  readRoomMediaFile: () => readRoomMediaFile,
  roomMediaObjectPath: () => roomMediaObjectPath
});
module.exports = __toCommonJS(skillsync_media_storage_exports);
var import_node_crypto = require("node:crypto");
var import_storage = require("@google-cloud/storage");
var SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
var storage = new import_storage.Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${SIDECAR_ENDPOINT}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" }
    },
    universe_domain: "googleapis.com"
  },
  projectId: ""
});
function privateObjectDir() {
  const directory = process.env.PRIVATE_OBJECT_DIR?.trim().replace(/\/+$/, "");
  if (!directory) throw new Error("Private object storage is not configured.");
  return directory;
}
function parseBucketObjectPath(path) {
  const parts = path.replace(/^\/+/, "").split("/");
  if (parts.length < 3 || !parts[0] || !parts.slice(1).join("/")) {
    throw new Error("Invalid private object path.");
  }
  return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
}
function pathFor(roomId, mediaId) {
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(roomId) || !/^[0-9a-f-]{36}$/i.test(mediaId)) {
    throw new Error("Invalid room media identifier.");
  }
  return `/objects/uploads/skillsync/${roomId}/${mediaId}`;
}
function toBucketObjectPath(mediaObjectPath) {
  if (!mediaObjectPath.startsWith("/objects/uploads/skillsync/")) {
    throw new Error("Invalid room media path.");
  }
  return `${privateObjectDir()}${mediaObjectPath.slice("/objects".length)}`;
}
function newRoomMediaId() {
  return (0, import_node_crypto.randomUUID)();
}
async function createRoomMediaUploadUrl(roomId, mediaId) {
  const mediaObjectPath = pathFor(roomId, mediaId);
  const { bucketName, objectName } = parseBucketObjectPath(toBucketObjectPath(mediaObjectPath));
  const response = await fetch(`${SIDECAR_ENDPOINT}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method: "PUT",
      expires_at: new Date(Date.now() + 5 * 60 * 1e3).toISOString()
    }),
    signal: AbortSignal.timeout(3e4)
  });
  if (!response.ok) {
    throw new Error(`Object storage could not create an upload URL (HTTP ${response.status}).`);
  }
  const payload = await response.json();
  if (typeof payload.signed_url !== "string" || !payload.signed_url.startsWith("https://")) {
    throw new Error("Object storage returned an invalid upload URL.");
  }
  return { uploadUrl: payload.signed_url, mediaObjectPath };
}
function roomMediaObjectPath(roomId, mediaId) {
  return pathFor(roomId, mediaId);
}
async function getRoomMediaFile(roomId, mediaId) {
  const objectPath = pathFor(roomId, mediaId);
  const { bucketName, objectName } = parseBucketObjectPath(toBucketObjectPath(objectPath));
  const file = storage.bucket(bucketName).file(objectName);
  const [exists] = await file.exists();
  return exists ? file : null;
}
async function deleteRoomMediaFile(roomId, mediaId) {
  const file = await getRoomMediaFile(roomId, mediaId);
  if (file) await file.delete();
}
async function readRoomMediaFile(file) {
  const [contents] = await file.download();
  return contents;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createRoomMediaUploadUrl,
  deleteRoomMediaFile,
  getRoomMediaFile,
  newRoomMediaId,
  readRoomMediaFile,
  roomMediaObjectPath
});
