import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { UnauthorizedError, ServiceUnavailableError } from "../../classes/errorClasses.js";

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
let cachedKeys = new Map();
let cacheExpiresAt = 0;

const decodeJson = (part) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));

const loadGoogleKeys = async () => {
  if (Date.now() < cacheExpiresAt && cachedKeys.size) return cachedKeys;

  const response = await fetch(GOOGLE_JWKS_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);

  if (!response?.ok) {
    throw new ServiceUnavailableError("Google identity verification is temporarily unavailable");
  }

  const payload = await response.json();
  if (!Array.isArray(payload.keys) || payload.keys.length === 0) {
    throw new ServiceUnavailableError("Google identity verification keys are unavailable");
  }

  cachedKeys = new Map(payload.keys.map((key) => [key.kid, key]));
  const cacheControl = response.headers.get("cache-control") || "";
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/i)?.[1] || 300);
  cacheExpiresAt = Date.now() + Math.max(60, Math.min(maxAge, 3600)) * 1000;
  return cachedKeys;
};

const verifyClaimsAndSignature = (parts, jwk, claims) => {
  const publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const validSignature = crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    publicKey,
    Buffer.from(parts[2], "base64url"),
  );
  if (!validSignature) throw new Error("Invalid signature");

  const now = Math.floor(Date.now() / 1000);
  const issuerValid = ["accounts.google.com", "https://accounts.google.com"].includes(claims.iss);
  const audienceIsArray = Array.isArray(claims.aud);
  const audienceValid = claims.aud === env.GOOGLE_CLIENT_ID ||
    (audienceIsArray && claims.aud.includes(env.GOOGLE_CLIENT_ID));
  const authorizedPartyValid = !audienceIsArray ||
    claims.aud.length <= 1 ||
    claims.azp === env.GOOGLE_CLIENT_ID;
  if (
    !issuerValid ||
    !audienceValid ||
    !authorizedPartyValid ||
    !claims.sub ||
    !claims.email ||
    claims.email_verified !== true ||
    !Number.isFinite(claims.exp) ||
    claims.exp <= now ||
    (claims.iat && claims.iat > now + 60)
  ) {
    throw new Error("Invalid Google token claims");
  }

  return {
    subject: claims.sub,
    email: claims.email.toLowerCase(),
    emailVerified: true,
    fullName: claims.name?.trim() || claims.email.split("@")[0],
  };
};

export const verifyGoogleIdToken = async (idToken) => {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new ServiceUnavailableError("Google sign-in is not configured");
  }

  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) throw new Error("Malformed JWT");

    const header = decodeJson(parts[0]);
    const claims = decodeJson(parts[1]);
    if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported JWT algorithm");

    let keys = await loadGoogleKeys();
    let jwk = keys.get(header.kid);
    if (!jwk) {
      cacheExpiresAt = 0;
      keys = await loadGoogleKeys();
      jwk = keys.get(header.kid);
    }
    if (!jwk) throw new Error("Unknown signing key");
    return verifyClaimsAndSignature(parts, jwk, claims);
  } catch (error) {
    if (error?.statusCode) throw error;
    throw new UnauthorizedError("Invalid or expired Google ID token");
  }
};
