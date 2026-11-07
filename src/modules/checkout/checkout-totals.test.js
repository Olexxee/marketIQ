import test from "node:test";
import assert from "node:assert/strict";
import { calculateCheckoutTotals } from "./checkout-totals.js";

test("adds accepted delivery charges to checkout without mixing them into merchandise subtotals", () => {
  const groups = [
    {
      seller: { id: "seller-a" },
      items: [
        { unitPriceSnapshot: "125.25", quantity: 2 },
        { unitPriceSnapshot: "9.50", quantity: 1 },
      ],
    },
    {
      seller: { id: "seller-b" },
      items: [{ unitPriceSnapshot: "40.00", quantity: 1 }],
    },
  ];
  const quotes = new Map([
    ["seller-a", { id: "quote-a", customerDeliveryChargeMinor: 1500n, agreedLogisticsCostMinor: 1200n }],
    ["seller-b", { id: "quote-b", customerDeliveryChargeMinor: 875n, agreedLogisticsCostMinor: 900n }],
  ]);

  const totals = calculateCheckoutTotals(groups, quotes);
  assert.deepEqual(totals.sellerTotals, [
    { sellerId: "seller-a", subtotalMinor: 26000n, shippingTotalMinor: 1500n, quoteId: "quote-a" },
    { sellerId: "seller-b", subtotalMinor: 4000n, shippingTotalMinor: 875n, quoteId: "quote-b" },
  ]);
  assert.equal(totals.orderSubtotalMinor, 30000n);
  assert.equal(totals.orderShippingTotalMinor, 2375n);
  assert.equal(totals.orderTotalMinor, 32375n);
});

test("keeps seller-managed delivery at zero when no quote is selected", () => {
  const totals = calculateCheckoutTotals([{
    seller: { id: "seller-a" },
    items: [{ unitPriceSnapshot: "19.99", quantity: 1 }],
  }], new Map());

  assert.equal(totals.sellerTotals[0].subtotalMinor, 1999n);
  assert.equal(totals.sellerTotals[0].shippingTotalMinor, 0n);
  assert.equal(totals.orderTotalMinor, 1999n);
});
