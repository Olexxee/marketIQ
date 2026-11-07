import { toMinorUnits } from "../logistics/money.js";

/**
 * Calculate parent and per-seller checkout amounts in integer kobo.
 * Customer delivery charge is deliberately kept separate from merchandise.
 */
export const calculateCheckoutTotals = (sellerGroups, quotesBySeller) => {
  let orderSubtotalMinor = 0n;
  let orderShippingTotalMinor = 0n;

  const sellerTotals = sellerGroups.map(group => {
    const subtotalMinor = group.items.reduce(
      (sum, item) => sum + BigInt(toMinorUnits(item.unitPriceSnapshot.toString())) * BigInt(item.quantity),
      0n,
    );
    const quote = quotesBySeller.get(group.seller.id);
    const shippingTotalMinor = quote ? BigInt(quote.customerDeliveryChargeMinor) : 0n;

    orderSubtotalMinor += subtotalMinor;
    orderShippingTotalMinor += shippingTotalMinor;

    return {
      sellerId: group.seller.id,
      subtotalMinor,
      shippingTotalMinor,
      quoteId: quote?.id ?? null,
    };
  });

  return {
    sellerTotals,
    orderSubtotalMinor,
    orderShippingTotalMinor,
    orderTotalMinor: orderSubtotalMinor + orderShippingTotalMinor,
  };
};
