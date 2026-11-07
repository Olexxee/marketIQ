import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import prisma from "../../config/prisma.js";
import { acceptLocalQuoteOption } from "./logistics.db.js";

test("local quote acceptance is atomic under concurrent option selection and rejects expired quotes", async () => {
  const token = randomUUID();
  const emails = [`buyer-${token}@example.test`, `seller-${token}@example.test`];
  let buyer;
  let sellerUser;
  let seller;
  let cart;
  let provider;

  try {
    [buyer, sellerUser] = await Promise.all([
      prisma.user.create({ data: { fullName: "Quote Test Buyer", email: emails[0] } }),
      prisma.user.create({ data: { fullName: "Quote Test Seller", email: emails[1] } }),
    ]);
    seller = await prisma.sellerProfile.create({
      data: { userId: sellerUser.id, businessName: `Quote Test ${token}`, status: "ACTIVE" },
    });
    cart = await prisma.cart.create({ data: { userId: buyer.id } });
    provider = await prisma.logisticsProvider.create({
      data: { code: `test-${token}`, name: "Integration Test Provider", isActive: true },
    });

    const now = new Date();
    const quote = await prisma.logisticsQuote.create({
      data: {
        providerId: provider.id,
        cartId: cart.id,
        sellerId: seller.id,
        idempotencyKey: `active-${token}`,
        expiresAt: new Date(now.getTime() + 60_000),
        requestSnapshot: { test: true },
      },
    });
    const [optionA, optionB] = await Promise.all([
      prisma.logisticsQuoteOption.create({
        data: {
          quoteId: quote.id,
          providerOptionReference: "option-a",
          customerDeliveryChargeMinor: 1000n,
          agreedLogisticsCostMinor: 800n,
          optionSnapshot: { test: "a" },
        },
      }),
      prisma.logisticsQuoteOption.create({
        data: {
          quoteId: quote.id,
          providerOptionReference: "option-b",
          customerDeliveryChargeMinor: 1200n,
          agreedLogisticsCostMinor: 900n,
          optionSnapshot: { test: "b" },
        },
      }),
    ]);

    const results = await Promise.all([
      acceptLocalQuoteOption({
        quoteId: quote.id,
        optionId: optionA.id,
        customerChargeMinor: optionA.customerDeliveryChargeMinor,
        logisticsCostMinor: optionA.agreedLogisticsCostMinor,
        acceptedAt: now,
      }),
      acceptLocalQuoteOption({
        quoteId: quote.id,
        optionId: optionB.id,
        customerChargeMinor: optionB.customerDeliveryChargeMinor,
        logisticsCostMinor: optionB.agreedLogisticsCostMinor,
        acceptedAt: now,
      }),
    ]);

    assert.equal(results.filter(Boolean).length, 1);
    const accepted = await prisma.logisticsQuote.findUnique({ where: { id: quote.id } });
    assert.equal(accepted.status, "ACCEPTED");
    assert.ok([optionA.id, optionB.id].includes(accepted.selectedOptionId));

    const replay = await acceptLocalQuoteOption({
      quoteId: quote.id,
      optionId: accepted.selectedOptionId,
      customerChargeMinor: accepted.customerDeliveryChargeMinor,
      logisticsCostMinor: accepted.agreedLogisticsCostMinor,
      acceptedAt: now,
    });
    assert.equal(replay.selectedOptionId, accepted.selectedOptionId);

    const activeQuoteWithExpiredOption = await prisma.logisticsQuote.create({
      data: {
        providerId: provider.id,
        cartId: cart.id,
        sellerId: seller.id,
        idempotencyKey: `expired-option-${token}`,
        expiresAt: new Date(now.getTime() + 60_000),
        requestSnapshot: { test: true },
      },
    });
    const expiredOnlyOption = await prisma.logisticsQuoteOption.create({
      data: {
        quoteId: activeQuoteWithExpiredOption.id,
        providerOptionReference: "expired-only-option",
        customerDeliveryChargeMinor: 1000n,
        agreedLogisticsCostMinor: 800n,
        expiresAt: new Date(now.getTime() - 1000),
        optionSnapshot: { test: "expired-option" },
      },
    });
    const expiredOptionResult = await acceptLocalQuoteOption({
      quoteId: activeQuoteWithExpiredOption.id,
      optionId: expiredOnlyOption.id,
      customerChargeMinor: expiredOnlyOption.customerDeliveryChargeMinor,
      logisticsCostMinor: expiredOnlyOption.agreedLogisticsCostMinor,
      acceptedAt: now,
    });
    assert.equal(expiredOptionResult, null);

    const expiredQuote = await prisma.logisticsQuote.create({
      data: {
        providerId: provider.id,
        cartId: cart.id,
        sellerId: seller.id,
        idempotencyKey: `expired-${token}`,
        expiresAt: new Date(now.getTime() - 1000),
        requestSnapshot: { test: true },
      },
    });
    const expiredOption = await prisma.logisticsQuoteOption.create({
      data: {
        quoteId: expiredQuote.id,
        providerOptionReference: "expired-option",
        customerDeliveryChargeMinor: 1000n,
        agreedLogisticsCostMinor: 800n,
        optionSnapshot: { test: "expired" },
      },
    });
    const expiredResult = await acceptLocalQuoteOption({
      quoteId: expiredQuote.id,
      optionId: expiredOption.id,
      customerChargeMinor: expiredOption.customerDeliveryChargeMinor,
      logisticsCostMinor: expiredOption.agreedLogisticsCostMinor,
      acceptedAt: now,
    });
    assert.equal(expiredResult, null);
  } finally {
    if (provider) await prisma.logisticsQuote.deleteMany({ where: { providerId: provider.id } });
    if (cart) await prisma.cart.deleteMany({ where: { id: cart.id } });
    if (seller) await prisma.sellerProfile.deleteMany({ where: { id: seller.id } });
    if (provider) await prisma.logisticsProvider.deleteMany({ where: { id: provider.id } });
    const userIds = [buyer?.id, sellerUser?.id].filter(Boolean);
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
});

test.after(async () => {
  await prisma.$disconnect();
});
