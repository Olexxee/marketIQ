import { NotFoundError } from "../../classes/errorClasses.js";
import {
  findLogisticsResolutionReviewById,
  listLogisticsResolutionReviews,
} from "./logistics-resolution-review.db.js";
import { buildLogisticsResolutionReviewFlags } from "./logistics-resolution-review.flags.js";

const serializeShipmentMoney = (shipment) => ({
  ...shipment,
  customerDeliveryChargeMinor: shipment.customerDeliveryChargeMinor?.toString() ?? null,
  agreedLogisticsCostMinor: shipment.agreedLogisticsCostMinor?.toString() ?? null,
});

const toReviewRecord = (record) => ({
  ...record,
  shipment: serializeShipmentMoney(record.shipment),
  reviewFlags: buildLogisticsResolutionReviewFlags(record),
  financialActionsEnabled: false,
});

export const listLogisticsResolutionReviewsService = async ({ status, page = 1, limit = 20 } = {}) => {
  const { items, total } = await listLogisticsResolutionReviews({
    status,
    skip: (page - 1) * limit,
    take: limit,
  });
  return { items: items.map(toReviewRecord), total, page, limit };
};

export const getLogisticsResolutionReviewService = async (id) => {
  const record = await findLogisticsResolutionReviewById(id);
  if (!record) throw new NotFoundError("Logistics resolution review not found");
  return toReviewRecord(record);
};
