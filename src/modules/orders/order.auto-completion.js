import prisma from "../../config/prisma.js";
import { EVENT_TYPES } from "../events/event.types.js";
import { publishEvent } from "../events/event.publisher.js";
import { recalculateOrderStatus } from "./order.status.service.js";
import { areSellerOrdersResolved } from "./order.completion-policy.js";

export const processAutoCompletion = async () => {
  const dueOrders = await prisma.order.findMany({
    where: {
      status: "DELIVERED",
      completionDueAt: { lte: new Date() },
      disputedAt: null,
    },
    select: { id: true },
    take: 50,
    orderBy: { completionDueAt: "asc" },
  });

  for (const candidate of dueOrders) {
    try {
      await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: candidate.id },
        include: { sellerOrders: { select: { id: true, status: true } } },
      });

      if (
        !order ||
        order.status !== "DELIVERED" ||
        !order.completionDueAt ||
        order.completionDueAt > new Date() ||
        order.disputedAt ||
        !areSellerOrdersResolved(order.sellerOrders)
      ) {
        return;
      }

      const claimed = await tx.order.updateMany({
        where: {
          id: order.id,
          status: "DELIVERED",
          completionDueAt: { lte: new Date() },
          disputedAt: null,
        },
        data: { completionDueAt: null },
      });

      if (claimed.count !== 1) {
        return;
      }

      await tx.sellerOrder.updateMany({
        where: { orderId: order.id, status: "DELIVERED" },
        data: { status: "COMPLETED" },
      });

      await recalculateOrderStatus(order.id, tx);
      await publishEvent(
        {
          eventType: EVENT_TYPES.ORDER_COMPLETED,
          aggregateType: "ORDER",
          aggregateId: order.id,
          payload: { orderId: order.id, completedBy: "PLATFORM" },
        },
        tx,
      );
      });
    } catch (error) {
      console.error("[AUTO-COMPLETION] Failed for order:", candidate.id, error?.message);
    }
  }
};
