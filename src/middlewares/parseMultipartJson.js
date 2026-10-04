import { BadRequestError } from "../classes/errorClasses.js";

export const parseMultipartJsonFields = (fields = []) => {
  return (req, res, next) => {
    try {
      for (const field of fields) {
        if (!req.body[field]) continue;

        if (typeof req.body[field] !== "string") continue;

        req.body[field] = JSON.parse(req.body[field]);
      }

      next();
    } catch {
      next(new BadRequestError("Invalid JSON field in multipart form"));
    }
  };
};