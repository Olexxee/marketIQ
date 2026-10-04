import { ZodError } from "zod";

export const validate = (schema, source = "body") => {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      console.error("❌ VALIDATION ERROR");
      console.error("Source:", source);
      console.error("Received:", req[source]);
      console.error("Details:", result.error.issues);

      const error = new ZodError(result.error.issues);

      error.statusCode = 400;
      error.code = "VALIDATION_ERROR";

      return next(error);
    }

    const value = result.data;

    /*
     * Express 5 exposes req.query through a getter,
     * so we mutate the existing object instead of replacing it.
     */
    if (source === "query") {
      Object.keys(req.query).forEach((key) => {
        delete req.query[key];
      });

      Object.assign(req.query, value);
    } else {
      req[source] = value;
    }

    req.validated = req.validated || {};
    req.validated[source] = value;

    next();
  };
};

export const validateBody = (schema) => validate(schema, "body");

export const validateParams = (schema) => validate(schema, "params");

export const validateQuery = (schema) => validate(schema, "query");