import { ForbiddenError } from "../classes/errorClasses.js";

export const requireVerifiedEmail = (req, res, next) => {
  if (!req.auth?.user?.emailVerifiedAt) {
    return next(new ForbiddenError("Verify your email before performing this action"));
  }
  return next();
};
