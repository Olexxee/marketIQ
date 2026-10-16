import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validateBody, validateParams, validateQuery } from "../../middlewares/validateMiddleware.js";
import {
  disputeIdParamSchema,
  disputeListQuerySchema,
  orderIdParamSchema,
  refundIdParamSchema,
  refundListQuerySchema,
  refundRequestSchema,
  retryRefundParamSchema,
  retryRefundSchema,
  sellerOrderIdParamSchema,
  settlementIdParamSchema,
  settlementListQuerySchema,
  settlementPaidSchema,
  settlementRequestSchema,
  resolveDisputeSchema,
  paymentReconciliationListQuerySchema,
  paymentReconciliationResolveSchema,
} from "./admin-operations.validation.js";
import {
  getDispute,
  listDisputes,
  listRefunds,
  listSettlements,
  requestSellerSettlement,
  approveSellerSettlement,
  markSellerSettlementPaid,
  processRefund,
  retryRefundWithDetails,
  requestRefund,
  resolveDispute,
  reviewDispute,
  listPaymentReconciliation,
  resolvePaymentReconciliation,
} from "./admin-operations.controller.js";

const router = Router();
router.use(authenticate);

router.get("/disputes", authorize("ADMIN", "STAFF"), validateQuery(disputeListQuerySchema), listDisputes);
router.get("/disputes/:id", authorize("ADMIN", "STAFF"), validateParams(disputeIdParamSchema), getDispute);
router.post("/disputes/:id/review", authorize("ADMIN", "STAFF"), validateParams(disputeIdParamSchema), reviewDispute);
router.post("/disputes/:id/resolve", authorize("ADMIN"), validateParams(disputeIdParamSchema), validateBody(resolveDisputeSchema), resolveDispute);

router.get("/payment-reconciliation", authorize("ADMIN"), validateQuery(paymentReconciliationListQuerySchema), listPaymentReconciliation);
router.post("/payment-reconciliation/:id/resolve", authorize("ADMIN"), validateParams(refundIdParamSchema), validateBody(paymentReconciliationResolveSchema), resolvePaymentReconciliation);
router.get("/refunds", authorize("ADMIN"), validateQuery(refundListQuerySchema), listRefunds);
router.post("/orders/:orderId/refunds", authorize("ADMIN"), validateParams(orderIdParamSchema), validateBody(refundRequestSchema), requestRefund);
router.post("/refunds/:id/process", authorize("ADMIN"), validateParams(refundIdParamSchema), processRefund);
router.post("/refunds/:id/retry", authorize("ADMIN"), validateParams(retryRefundParamSchema), validateBody(retryRefundSchema), retryRefundWithDetails);

router.get("/settlements", authorize("ADMIN"), validateQuery(settlementListQuerySchema), listSettlements);
router.post("/seller-orders/:sellerOrderId/settlements", authorize("ADMIN"), validateParams(sellerOrderIdParamSchema), validateBody(settlementRequestSchema), requestSellerSettlement);
router.post("/settlements/:id/approve", authorize("ADMIN"), validateParams(settlementIdParamSchema), approveSellerSettlement);
router.post("/settlements/:id/mark-paid", authorize("ADMIN"), validateParams(settlementIdParamSchema), validateBody(settlementPaidSchema), markSellerSettlementPaid);

export default router;
