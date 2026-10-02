import "server-only";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

/** LiveKit settings from the environment (server only: the secret never reaches a browser). */
export function livekitEnv(): { url: string; key: string; secret: string } | null {
  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  return url && key && secret ? { url, key, secret } : null;
}

export function roomService(env: { url: string; key: string; secret: string }): RoomServiceClient {
  // The room API speaks HTTPS on the same host as the WebSocket URL.
  return new RoomServiceClient(env.url.replace(/^ws/, "http"), env.key, env.secret);
}

export interface Grant {
  room: string;
  identity: string;
  name: string;
  metadata: string;
  admin: boolean;
}

/**
 * A short-lived join token. Everyone may talk, show their camera, share their screen and chat
 * (the team chose a Meet-style room); the coach also moderates.
 */
export async function joinToken(env: { key: string; secret: string }, grant: Grant): Promise<string> {
  const token = new AccessToken(env.key, env.secret, { identity: grant.identity, name: grant.name, metadata: grant.metadata, ttl: "10m" });
  token.addGrant({ room: grant.room, roomJoin: true, canSubscribe: true, canPublish: true, canPublishData: true, roomAdmin: grant.admin, canUpdateOwnMetadata: false });
  return token.toJwt();
}
