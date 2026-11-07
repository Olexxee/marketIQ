import test from "node:test";
import assert from "node:assert/strict";
import { buildOrderPaymentLedgerAllocation } from "./payment.ledger-allocation.js";

test("credits seller payable with merchandise only and recognizes Hub cost separately", () => {
  const result = buildOrderPaymentLedgerAllocation({
    paymentAmount: "110.00",
    orderSubtotal: "100.00",
    orderShippingTotal: "10.00",
    orderTax: "0.00",
    sellerOrders: [
      {
        id: "seller-order-a",
        subtotal: "60.00",
        shippingTotal: "6.00",
        logisticsQuote: { customerDeliveryChargeMinor: 600n, agreedLogisticsCostMinor: 500n },
      },
      {
        id: "seller-order-b",
        subtotal: "40.00",
        shippingTotal: "4.00",
        logisticsQuote: { customerDeliveryChargeMinor: 400n, agreedLogisticsCostMinor: 350n },
      },
    ],
  });

  assert.deepEqual(result.allocation, {
    sellerPayableMinor: "10000",
    customerDeliveryChargeMinor: "1000",
    logisticsPayableMinor: "850",
    unallocatedDeliveryMinor: "0",
    deliveryMarginMinor: "150",
    taxPayableMinor: "0",
    currency: "NGN",
  });
  assert.equal(result.entries.find(entry => entry.account === "SELLER_PAYABLE").amount, "60.00");
  assert.equal(result.entries.filter(entry => entry.account === "SELLER_PAYABLE")
    .reduce((sum, entry) => sum + Number(entry.amount), 0), 100);
  assert.equal(result.entries.find(entry => entry.account === "LOGISTICS_PAYABLE").amount, "5.00");
  assert.equal(result.entries.find(entry => entry.account === "PLATFORM_REVENUE").amount, "1.50");
});

test("records platform-funded delivery subsidy when Hub cost exceeds customer charge", () => {
  const result = buildOrderPaymentLedgerAllocation({
    paymentAmount: "100.00",
    orderSubtotal: "100.00",
    orderShippingTotal: "0.00",
    orderTax: "0.00",
    sellerOrders: [{
      id: "seller-order-a",
      subtotal: "100.00",
      shippingTotal: "0.00",
      logisticsQuote: { customerDeliveryChargeMinor: 0n, agreedLogisticsCostMinor: 250n },
    }],
  });

  assert.equal(result.entries.find(entry => entry.account === "LOGISTICS_PAYABLE").amount, "2.50");
  assert.equal(result.entries.find(entry => entry.account === "LOGISTICS_SUBSIDY").amount, "2.50");
  assert.equal(result.entries.find(entry => entry.account === "LOGISTICS_SUBSIDY").direction, "DEBIT");
});

test("holds legacy delivery charges in suspense and rejects mismatched checkout allocations", () => {
  const legacy = buildOrderPaymentLedgerAllocation({
    paymentAmount: "110.00",
    orderSubtotal: "100.00",
    orderShippingTotal: "10.00",
    orderTax: "0.00",
    sellerOrders: [{
      id: "seller-order-a",
      subtotal: "100.00",
      shippingTotal: "10.00",
      logisticsQuote: null,
    }],
  });
  assert.equal(legacy.allocation.sellerPayableMinor, "10000");
  assert.equal(legacy.allocation.unallocatedDeliveryMinor, "1000");
  assert.equal(legacy.entries.find(entry => entry.account === "DELIVERY_UNALLOCATED").amount, "10.00");

  assert.throws(() => buildOrderPaymentLedgerAllocation({
    paymentAmount: "111.00",
    orderSubtotal: "100.00",
    orderShippingTotal: "10.00",
    orderTax: "0.00",
    sellerOrders: [{
      id: "seller-order-a",
      subtotal: "100.00",
      shippingTotal: "10.00",
      logisticsQuote: { customerDeliveryChargeMinor: 1000n, agreedLogisticsCostMinor: 800n },
    }],
  }), /does not reconcile/);
});
