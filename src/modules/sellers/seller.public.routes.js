import { Router } from "express";
import { z } from "zod";
import { cuid } from "../../lib/validators.js";
import { validateParams, validateQuery } from "../../middlewares/validateMiddleware.js";
import {
  getPublicSellerDirectory,
  getPublicSellerStorefront,
} from "./seller.public.controller.js";

const publicSellerRouter = Router();

const sellerDirectoryQuerySchema = z.object({
  search: z.string().trim().min(1).max(150).optional(),
  tradeCapability: z.enum([
    "RETAIL",
    "WHOLESALE",
    "IMPORTER",
    "EXPORTER",
    "MANUFACTURER",
    "DISTRIBUTOR",
  ]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const sellerIdParamSchema = z.object({ id: cuid });

publicSellerRouter.get(
  "/directory",
  validateQuery(sellerDirectoryQuerySchema),
  getPublicSellerDirectory,
);

publicSellerRouter.get(
  "/:id/storefront",
  validateParams(sellerIdParamSchema),
  getPublicSellerStorefront,
);

export default publicSellerRouter;
