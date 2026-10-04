// src/middlewares/errorMiddleware.js
import { Prisma } from "@prisma/client";

// ============================================================================
// PRISMA ERROR MAPPER
// ============================================================================
//
// Translates the Prisma error codes we actually encounter into HTTP status
// codes with human-readable messages. Without this, every constraint
// violation reaches the client as a 500 with a raw stack trace.

const handlePrismaError = (err) => {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }

  switch (err.code) {
    case "P2002": {
      const field = Array.isArray(err.meta?.target)
        ? err.meta.target.join(", ")
        : (err.meta?.target ?? "field");

      return {
        statusCode: 409,
        message: `A record with this ${field} already exists.`,
      };
    }

    case "P2003": {
      const field = err.meta?.field_name ?? "related records";
      return {
        statusCode: 409,
        message: `Cannot complete this action — ${field} still reference it.`,
      };
    }

    case "P2025":
      return {
        statusCode: 404,
        message: "Record not found.",
      };

    default:
      return null;
  }
};

// ============================================================================
// MIDDLEWARE
// ============================================================================

export const errorMiddleware = (err, req, res, next) => {
  console.error("========================================");
  console.error("🔥 ERROR");
  console.error("Method:", req.method);
  console.error("URL:", req.originalUrl);
  console.error("Message:", err.message);
  console.error("Stack:", err.stack);
  console.error("========================================");

  const prismaError = handlePrismaError(err);

  const statusCode = prismaError?.statusCode || err.statusCode || 500;

  const message =
    prismaError?.message || err.message || "Something went wrong";

  return res.status(statusCode).json({
    success: false,
    message,
    ...(err.details && { details: err.details }),
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
    }),
  });
};