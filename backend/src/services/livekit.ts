import { AccessToken } from "livekit-server-sdk";

export async function generateToken(
  identity: string,
  room: string,
  metadata?: string
): Promise<string> {
  const apiKey = process.env.LIVEKIT_API_KEY || "devkey";
  const apiSecret = process.env.LIVEKIT_API_SECRET || "devsecret";

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    ttl: "6h",
    metadata,
  });

  at.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return at.toJwt();
}