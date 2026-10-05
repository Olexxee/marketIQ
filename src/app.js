import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";

// ============================================================
// MIDDLEWARE
// ============================================================

import { errorMiddleware } from "./middlewares/errorMiddleware.js";

// ============================================================
// MODULE ROUTERS
// ============================================================

import authRouter from "./modules/auth/auth.routes.js";
import locationRouter from "./modules/locations/location.routes.js";
import sellerRouter from "./modules/sellers/seller.routes.js";

import catalogRouter from "./modules/categories/category.routes.js";
import brandRouter from "./modules/brands/brand.routes.js";
import collectionRouter from "./modules/collections/collection.routes.js";
import cartRouter from "./modules/cart/cart.routes.js";
import { paystackWebhook } from "./modules/payments/payment.webhook.js";

import productRouter from "./modules/products/product.routes.js";
import productSellerRouter from "./modules/products/product.seller.routes.js";

import variantPublicRouter from "./modules/variants/variant.routes.js";
import {
  variantFlatRouter,
  variantNestedRouter,
} from "./modules/variants/variant.seller.routes.js";

import inventoryRouter from "./modules/inventory/inventory.routes.js";

// ============================================================
// SWAGGER
// ============================================================

import { buildSwaggerDocument } from "../docs/swagger.js";

const app = express();

// ============================================================
// SECURITY + PARSING
// ============================================================

app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  paystackWebhook,
);

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

// ============================================================
// HEALTH
// ============================================================

app.get("/api/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "MarketIQ API is running",
  });
});

// ============================================================
// SWAGGER
// ============================================================

const swaggerDocument = await buildSwaggerDocument();

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ============================================================
// ROUTES
// ============================================================

// Identity + geography
app.use("/api/auth", authRouter);
app.use("/api/sellers", sellerRouter);
app.use("/api/locations", locationRouter);

// Catalog metadata
app.use("/api/categories", catalogRouter);
app.use("/api/brands", brandRouter);
app.use("/api/collections", collectionRouter);
app.use("/api/cart", cartRouter);

// ------------------------------------------------------------
// Public catalog
// Nested variants MUST be mounted before the parent product
// router, otherwise Express matches "/:id" first.
// ------------------------------------------------------------
app.use("/api/products/:productId/variants", variantPublicRouter);
app.use("/api/products", productRouter);

// ------------------------------------------------------------
// Seller catalog + inventory
// Same rule: nested variants before flat product routes.
// ------------------------------------------------------------
app.use("/api/seller/products/:productId/variants", variantNestedRouter);
app.use("/api/seller/products", productSellerRouter);
app.use("/api/seller/variants", variantFlatRouter);
app.use("/api/seller/inventory", inventoryRouter);

// ============================================================
// ERROR HANDLER (must be last)
// ============================================================

app.use(errorMiddleware);

export default app;
