import "dotenv/config";

const requiredEnv = ["DATABASE_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const configuredOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const developmentOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

if (process.env.NODE_ENV === "production" && configuredOrigins.length === 0) {
  throw new Error(
    "CORS_ORIGINS must contain the exact trusted frontend origins in production",
  );
}

if (
  process.env.NODE_ENV === "production" &&
  (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM || !process.env.FRONTEND_URL)
) {
  throw new Error(
    "RESEND_API_KEY, EMAIL_FROM, and FRONTEND_URL are required in production for account verification and recovery",
  );
}

if (process.env.FRONTEND_URL) {
  const frontendUrl = new URL(process.env.FRONTEND_URL);
  if (frontendUrl.pathname !== "/" || frontendUrl.search || frontendUrl.hash) {
    throw new Error("FRONTEND_URL must be an origin without a path, query, or hash");
  }
  if (process.env.NODE_ENV === "production" && frontendUrl.protocol !== "https:") {
    throw new Error("FRONTEND_URL must use HTTPS in production");
  }
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",

  PORT: Number(process.env.PORT) || 5000,

  DATABASE_URL: process.env.DATABASE_URL,

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,

  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "30d",

  JWT_REFRESH_COOKIE_NAME:
    process.env.JWT_REFRESH_COOKIE_NAME || "marketIQ_refresh_token",

  CORS_ORIGINS: configuredOrigins.length
    ? [...new Set(configuredOrigins)]
    : developmentOrigins,

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  FRONTEND_URL: process.env.FRONTEND_URL,
  paystack: {},
};
