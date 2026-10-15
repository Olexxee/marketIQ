import crypto from "crypto";

export const hashRefreshToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

export const getRefreshTokenExpiry = () => {
  const days = 30;

  const expiresAt = new Date();

  expiresAt.setDate(expiresAt.getDate() + days);

  return expiresAt;
};

export const createOpaqueToken = () => {
  return crypto.randomBytes(32).toString("base64url");
};

export const hashOpaqueToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

export const getTokenExpiry = (minutes) => {
  return new Date(Date.now() + minutes * 60 * 1000);
};
