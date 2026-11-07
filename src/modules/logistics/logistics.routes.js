import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireVerifiedEmail } from "../../middlewares/requireVerifiedEmail.js";
import { validateBody, validateParams } from "../../middlewares/validateMiddleware.js";
import {
  quoteCreateSchema, quoteParamsSchema, quoteOptionParamsSchema,
} from "./logistics.validation.js";
import {
  createDeliveryQuote, getDeliveryQuote, acceptDeliveryQuoteOption,
} from "./logistics.controller.js";

const router = Router();
router.use(authenticate, requireVerifiedEmail);
router.post("/quotes", validateBody(quoteCreateSchema), createDeliveryQuote);
router.get("/quotes/:quoteId", validateParams(quoteParamsSchema), getDeliveryQuote);
router.post("/quotes/:quoteId/options/:optionId/accept", validateParams(quoteOptionParamsSchema), acceptDeliveryQuoteOption);

export default router;
