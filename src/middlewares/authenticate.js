import { verifyAccessToken } from "../config/jwt.js";
import { findUserById } from "../modules/auth/auth.db.js";
import { UnauthorizedError } from "../classes/errorClasses.js";

const extractBearerToken = (req) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
};

export const authenticate = async (req, res, next) => {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      throw new UnauthorizedError("Authentication required");
    }

    let payload;

    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new UnauthorizedError("Invalid or expired access token");
    }

    if (!payload.sub) {
      throw new UnauthorizedError("Invalid access token");
    }

    const user = await findUserById(payload.sub);

    if (!user) {
      throw new UnauthorizedError("User no longer exists");
    }

    if (user.status !== "ACTIVE") {
      throw new UnauthorizedError("Your account is suspended");
    }

    req.user = {
      id: user.id,
      role: user.role,
      status: user.status,
    };

    req.auth = {
      user,
      tokenPayload: payload,
    };

    next();
  } catch (error) {
    next(error);
  }
};
