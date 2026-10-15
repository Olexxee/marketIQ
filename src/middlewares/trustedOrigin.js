import { ForbiddenError } from "../classes/errorClasses.js";
import { env } from "../config/env.js";

// Browser requests that include Origin must come from a configured frontend.
// Requests without Origin remain supported for native clients and server-to-server
// calls; cookie-based browser requests are additionally protected by SameSite and
// this strict origin allowlist.
export const enforceTrustedOrigin = (req, res, next) => {
  const origin = req.get("Origin");

  if (origin && !env.CORS_ORIGINS.includes(origin)) {
    return next(new ForbiddenError("Request origin is not allowed"));
  }

  return next();
};
