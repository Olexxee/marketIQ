import prisma from "../../config/prisma.js";
import { releaseReservationForOrderItem } from "../inventory/inventory.ledger.js";
import { publishEvent } from "../events/event.publisher.js";
import { EVENT_TYPES } from "../events/event.types.js";
import { recalculateOrderStatus } from "./order.status.service.js";

const lockSort = (items) => [...items].sort((a, b) => String(a.inventoryId || "").localeCompare(String(b.inventoryId || "")));

export const processExpiredUnpaidOrders = async () => {
  const now = new Date();
  const candidates = await prisma.order.findMany({
    where: {
      status: "PENDING",
      paymentStatus: { in: ["PENDING", "FAILED", "ABANDONED"] },
      paymentExpiresAt: { lte: now },
    },
    select: { id: true },
    orderBy: { paymentExpiresAt: "asc" },
    take: 50,
  });

  for (const candidate of candidates) {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: candidate.id },
        include: { items: true },
      });
      if (!order || order.status !== "PENDING" || !order.paymentExpiresAt || order.paymentExpiresAt > new Date() || !["PENDING", "FAILED", "ABANDONED"].includes(order.paymentStatus)) return;

      const claimed = await tx.order.updateMany({
        where: {
          id: order.id,
          status: "PENDING",
          paymentStatus: { in: ["PENDING", "FAILED", "ABANDONED"] },
          paymentExpiresAt: { lte: new Date() },
        },
        data: { paymentStatus: "ABANDONED" },
      });
      if (claimed.count !== 1) return;

      await tx.payment.updateMany({ where: { orderId: order.id, status: "PENDING" }, data: { status: "ABANDONED" } });
      await tx.sellerOrder.updateMany({ where: { orderId: order.id, status: { in: ["PENDING", "CONFIRMED"] } }, data: { status: "CANCELLED" } });
      for (const item of lockSort(order.items)) await releaseReservationForOrderItem(item, tx);
      await recalculateOrderStatus(order.id, tx);
      await publishEvent({
        eventType: EVENT_TYPES.ORDER_CANCELLED,
        aggregateType: "ORDER",
        aggregateId: order.id,
        payload: { orderId: order.id, reason: "PAYMENT_WINDOW_EXPIRED" },
      }, tx);
      await tx.auditLog.create({
        data: { action: "UNPAID_ORDER_EXPIRED", resource: "Order", resourceId: order.id, metadata: { paymentExpiresAt: order.paymentExpiresAt.toISOString() } },
      });
    }, { timeout: 15000 });
  }
};
