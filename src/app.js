import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";

// Middleware Import
import { errorMiddleware } from "./middlewares/errorMiddleware.js";

// Module Routes Imports
import locationRouter from "./modules/locations/location.routes.js";
import authRouter from "./modules/auth/auth.routes.js";

// Swagger
import { buildSwaggerDocument } from "../docs/swagger.js";

const app = express();

app.use((req, res, next) => {
  if (req.path.startsWith("/api-docs")) {
    return helmet({ contentSecurityPolicy: false })(req, res, next);
  }
  return helmet()(req, res, next);
});

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(morgan("dev"));
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "MarketIQ API is running",
  });
});

// Swagger docs (merged from /docs/*.openapi.yaml)
const swaggerDocument = await buildSwaggerDocument();
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use("/api/auth", authRouter);
app.use("/api/locations", locationRouter);

app.use(errorMiddleware);

export default app;
