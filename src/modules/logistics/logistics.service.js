import { createHash } from "node:crypto";
import {
  BadRequestError, ConflictError, NotFoundError, ServiceUnavailableError,
} from "../../classes/errorClasses.js";
import { env } from "../../config/env.js";
import { buildVerifiedLogisticsLocation } from "./location.js";
import { toMinorUnits } from "./money.js";
import { scaleMeasurementCeil } from "./measurement.js";
import { createLogisticHubClient, LogisticHubApiError } from "./logistic-hub.client.js";
import {
  acceptLocalQuoteOption,
  createQuoteWithOptions,
  findActiveCartForSeller,
  findActiveDestinationZoneMapping,
  findActiveLogisticsProvider,
  findActivePackageCategoryMappings,
  findEligibleWarehouseMappings,
  findOwnedDeliveryAddress,
  findOwnedQuote,
  findQuoteByIdempotency,
} from "./logistics.db.js";

const hash = value => createHash("sha256").update(value).digest("hex");

const parseMinorUnits = (value, field) => {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value)) {
    throw new ServiceUnavailableError(`Logistic Hub returned an invalid ${field} amount.`);
  }
  return BigInt(value);
};

const providerClient = provider => createLogisticHubClient({
  config: {
    ...env.logisticHub,
    baseUrl: env.logisticHub.baseUrl || provider.baseUrl,
  },
});

const mapProviderError = error => {
  if (error instanceof LogisticHubApiError && error.retryable) {
    throw new ServiceUnavailableError("Logistic Hub is temporarily unavailable. Retry with the same Idempotency-Key.");
  }
  if (error instanceof LogisticHubApiError) {
    throw new ConflictError(`Logistic Hub rejected the quote request: ${error.message}`);
  }
  throw error;
};

const buildPackages = (items, categoryMappings) => {
  const mappingByCategory = new Map(categoryMappings.map(mapping => [mapping.categoryId, mapping]));
  const packages = [];
  for (const item of items) {
    const variant = item.variant;
    const categoryId = variant.product.categoryId;
    const mapping = mappingByCategory.get(categoryId);
    if (!mapping) {
      throw new ConflictError(`Product category for "${variant.product.name}" has no verified Logistic Hub package mapping.`);
    }
    for (let index = 0; index < item.quantity; index += 1) {
      if (packages.length >= 50) {
        throw new BadRequestError("A Logistic Hub quote supports at most 50 packages per seller shipment.");
      }
      const weightGrams = scaleMeasurementCeil(variant.weight, 1000, "weight");
      const lengthMm = scaleMeasurementCeil(variant.length, 10, "length");
      const widthMm = scaleMeasurementCeil(variant.width, 10, "width");
      const heightMm = scaleMeasurementCeil(variant.height, 10, "height");
      packages.push({
        externalPackageRef: `${item.id}-${index + 1}`,
        packageCategory: mapping.externalPackageCategory,
        description: variant.product.name.slice(0, 500),
        ...(weightGrams > 0 ? { weightGrams } : {}),
        ...(lengthMm > 0 ? { lengthMm } : {}),
        ...(widthMm > 0 ? { widthMm } : {}),
        ...(heightMm > 0 ? { heightMm } : {}),
        declaredValueMinor: String(toMinorUnits(variant.price.toString())),
      });
    }
  }
  return packages;
};

const presentQuote = quote => ({
  id: quote.id,
  status: quote.status,
  currency: quote.currency,
  expiresAt: quote.expiresAt,
  acceptedAt: quote.acceptedAt,
  customerDeliveryChargeMinor: quote.customerDeliveryChargeMinor?.toString() ?? null,
  agreedLogisticsCostMinor: quote.agreedLogisticsCostMinor?.toString() ?? null,
  selectedOptionId: quote.selectedOptionId,
  options: (quote.options ?? []).map(option => ({
    id: option.id,
    serviceLevel: option.serviceLevel,
    currency: option.currency,
    customerDeliveryChargeMinor: option.customerDeliveryChargeMinor.toString(),
    agreedLogisticsCostMinor: option.agreedLogisticsCostMinor.toString(),
    expiresAt: option.expiresAt,
    selected: option.id === quote.selectedOptionId,
  })),
  assessment: quote.responseSnapshot?.quoteSession?.assessment ?? null,
});

export const createDeliveryQuoteService = async (userId, { sellerId, addressId }, idempotencyKey) => {
  const [cart, address, provider] = await Promise.all([
    findActiveCartForSeller(userId, sellerId),
    findOwnedDeliveryAddress(addressId, userId),
    findActiveLogisticsProvider(),
  ]);
  if (!cart || cart.items.length === 0) throw new NotFoundError("No active cart items were found for this seller.");
  if (!address) throw new NotFoundError("Delivery address not found.");
  if (!provider) throw new ServiceUnavailableError("Logistic Hub is not configured as an active delivery provider.");

  const destination = buildVerifiedLogisticsLocation(address, "Destination");
  if (!address.lgaId) throw new ConflictError("The delivery address must have an LGA before delivery can be quoted.");

  const [warehouseMappings, destinationZone, categoryMappings] = await Promise.all([
    findEligibleWarehouseMappings(provider.id, sellerId),
    findActiveDestinationZoneMapping(provider.id, address.lgaId),
    findActivePackageCategoryMappings(provider.id, [...new Set(cart.items.map(item => item.variant.product.categoryId))]),
  ]);

  if (warehouseMappings.length !== 1) {
    throw new ConflictError(
      warehouseMappings.length === 0
        ? "This seller does not have one active, verified Logistic Hub pickup warehouse mapping."
        : "This seller has multiple active pickup warehouse mappings. Admin must resolve the origin before quoting.",
    );
  }
  if (!destinationZone) throw new ConflictError("No verified Logistic Hub service-zone mapping exists for the delivery address LGA.");

  const warehouseMapping = warehouseMappings[0];
  if (typeof warehouseMapping.warehouse.address !== "string" || warehouseMapping.warehouse.address.trim().length < 3) {
    throw new ConflictError("The mapped pickup warehouse must have a complete address before quoting.");
  }
  if (typeof address.fullName !== "string" || typeof address.phone !== "string" || address.phone.trim().length < 7) {
    throw new ConflictError("The delivery address must contain a valid recipient name and phone number.");
  }
  const pickup = buildVerifiedLogisticsLocation(warehouseMapping.warehouse, "Pickup");
  const packages = buildPackages(cart.items, categoryMappings);
  const externalReference = `mqi-${hash(`${cart.id}:${sellerId}:${addressId}:${idempotencyKey}`).slice(0, 48)}`;
  const request = {
    billingAgreementReference: env.logisticHub.billingAgreementReference,
    externalReference,
    pickupServiceZoneId: warehouseMapping.externalServiceZoneId,
    destinationServiceZoneId: destinationZone.externalServiceZoneId,
    pickupAddress: warehouseMapping.warehouse.address,
    pickup: { latitude: pickup.latitude, longitude: pickup.longitude },
    destinationAddress: address.addressLine,
    destination: { latitude: destination.latitude, longitude: destination.longitude },
    recipientName: address.fullName,
    recipientPhone: address.phone,
    packages,
    expiresInMinutes: 60,
  };
  if (!request.billingAgreementReference) {
    throw new ServiceUnavailableError("Logistic Hub billing agreement reference is not configured.");
  }

  const requestSnapshot = {
    addressId,
    warehouseMappingId: warehouseMapping.id,
    destinationServiceZoneMappingId: destinationZone.id,
    payloadHash: hash(JSON.stringify(request)),
    request,
  };
  const existing = await findQuoteByIdempotency(provider.id, idempotencyKey);
  if (existing) {
    if (
      existing.cartId !== cart.id ||
      existing.sellerId !== sellerId ||
      existing.requestSnapshot?.payloadHash !== requestSnapshot.payloadHash
    ) {
      throw new ConflictError("The Idempotency-Key was reused for a different delivery quote request.");
    }
    return presentQuote(existing);
  }

  let providerResponse;
  try {
    providerResponse = await providerClient(provider).createQuote(request, idempotencyKey);
  } catch (error) {
    mapProviderError(error);
  }

  const quoteSession = providerResponse.quoteSession;
  const quoteExpiry = new Date(quoteSession?.expiresAt ?? NaN);
  if (
    !quoteSession?.id ||
    !Number.isFinite(quoteExpiry.getTime()) ||
    !["NGN"].includes(quoteSession.currency) ||
    !Array.isArray(providerResponse.options)
  ) {
    throw new ServiceUnavailableError("Logistic Hub returned an incomplete or unsupported quote response.");
  }
  const options = providerResponse.options.map(option => {
    const optionExpiry = option.expiresAt ? new Date(option.expiresAt) : null;
    if (
      !option.id ||
      option.currency !== quoteSession.currency ||
      (optionExpiry && !Number.isFinite(optionExpiry.getTime()))
    ) {
      throw new ServiceUnavailableError("Logistic Hub returned an invalid quote option.");
    }
    return {
      providerOptionReference: option.id,
      customerDeliveryChargeMinor: parseMinorUnits(option.customerChargeMinor, "customer delivery charge"),
      agreedLogisticsCostMinor: parseMinorUnits(option.logisticsCostMinor, "agreed logistics cost"),
      currency: option.currency,
      serviceLevel: option.optionCode ?? option.routeMode ?? null,
      expiresAt: optionExpiry,
      optionSnapshot: option,
    };
  });
  const status = quoteSession.status === "QUOTED" && options.length > 0 ? "QUOTED" : "REJECTED";
  let quote;
  try {
    quote = await createQuoteWithOptions({
    providerId: provider.id,
    cartId: cart.id,
    sellerId,
    warehouseMappingId: warehouseMapping.id,
    idempotencyKey,
    externalFulfillmentReference: null,
    providerQuoteReference: quoteSession.id,
    status,
    customerDeliveryChargeMinor: null,
    agreedLogisticsCostMinor: null,
    currency: quoteSession.currency,
    selectedOptionId: null,
    expiresAt: new Date(quoteSession.expiresAt),
    acceptedAt: null,
    requestSnapshot,
    responseSnapshot: providerResponse,
    }, options);
  } catch (error) {
    if (error?.code !== "P2002") throw error;
    const replayed = await findQuoteByIdempotency(provider.id, idempotencyKey);
    if (
      replayed &&
      replayed.cartId === cart.id &&
      replayed.sellerId === sellerId &&
      replayed.requestSnapshot?.payloadHash === requestSnapshot.payloadHash
    ) return presentQuote(replayed);
    throw new ConflictError("The Idempotency-Key was already used for a different delivery quote request.");
  }
  return presentQuote(quote);
};

export const getDeliveryQuoteService = async (userId, quoteId) => {
  const quote = await findOwnedQuote(quoteId, userId);
  if (!quote) throw new NotFoundError("Delivery quote not found.");
  return presentQuote(quote);
};

export const acceptDeliveryQuoteOptionService = async (userId, quoteId, optionId) => {
  const quote = await findOwnedQuote(quoteId, userId);
  if (!quote) throw new NotFoundError("Delivery quote not found.");
  if (quote.status === "ACCEPTED") {
    if (quote.selectedOptionId === optionId) return presentQuote(quote);
    throw new ConflictError("A different delivery option has already been accepted for this quote.");
  }
  if (quote.status !== "QUOTED" || quote.expiresAt <= new Date()) {
    throw new ConflictError("This delivery quote has expired or is no longer selectable.");
  }
  const option = quote.options.find(item => item.id === optionId);
  if (!option || (option.expiresAt && option.expiresAt <= new Date())) {
    throw new ConflictError("The selected delivery option is unavailable or expired.");
  }

  const idempotencyKey = `mqi-accept-${hash(`${quote.id}:${option.id}`).slice(0, 40)}`;
  try {
    const result = await providerClient(quote.provider).acceptQuoteOption(
      quote.providerQuoteReference,
      option.providerOptionReference,
      idempotencyKey,
    );
    if (result.status !== "SELECTED" || result.selectedOption?.id !== option.providerOptionReference) {
      throw new ServiceUnavailableError("Logistic Hub did not confirm the selected quote option.");
    }
  } catch (error) {
    mapProviderError(error);
  }

  const acceptedAt = new Date();
  const updated = await acceptLocalQuoteOption({
    quoteId,
    optionId,
    customerChargeMinor: option.customerDeliveryChargeMinor,
    logisticsCostMinor: option.agreedLogisticsCostMinor,
    acceptedAt,
  });
  if (!updated) throw new ConflictError("The delivery quote was concurrently accepted with another option.");
  return presentQuote(updated);
};
