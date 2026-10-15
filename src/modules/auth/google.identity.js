import { OAuth2Client } from "google-auth-library";
import { env } from "../../config/env.js";
import { UnauthorizedError, ServiceUnavailableError } from "../../classes/errorClasses.js";

const client = new OAuth2Client();

export const verifyGoogleIdToken = async (idToken) => {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new ServiceUnavailableError("Google sign-in is not configured");
  }
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (
      !payload?.sub ||
      !payload.email ||
      payload.email_verified !== true ||
      !payload.iss ||
      !["accounts.google.com", "https://accounts.google.com"].includes(payload.iss)
    ) {
      throw new UnauthorizedError("Google account could not be verified");
    }
    return {
      subject: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified: payload.email_verified === true,
      fullName: payload.name?.trim() || payload.email.split("@")[0],
    };
  } catch (error) {
    if (error?.statusCode) throw error;
    throw new UnauthorizedError("Invalid or expired Google ID token");
  }
};
