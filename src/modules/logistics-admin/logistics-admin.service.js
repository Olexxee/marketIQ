import prisma from "../../config/prisma.js";
import { ConflictError, NotFoundError } from "../../classes/errorClasses.js";

const audit = (tx, userId, action, resource, resourceId, metadata = {}) =>
  tx.auditLog.create({
    data: { userId, action, resource, resourceId, metadata },
  });

export const listWarehouseMappingsService = async ({ providerId, warehouseId, isActive } = {}) => {
  return prisma.logisticsWarehouseMapping.findMany({
    where: {
      ...(providerId && { providerId }),
      ...(warehouseId && { warehouseId }),
      ...(isActive !== undefined && { isActive }),
    },
    include: {
      provider: { select: { id: true, code: true, name: true, isActive: true } },
      warehouse: {
        select: {
          id: true, name: true, code: true, address: true, isActive: true,
          latitude: true, longitude: true, coordinatesVerifiedAt: true, coordinatesSource: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
};

export const createWarehouseMappingService = async (actorId, input) => {
  const [provider, warehouse] = await Promise.all([
    prisma.logisticsProvider.findUnique({ where: { id: input.providerId } }),
    prisma.warehouse.findUnique({ where: { id: input.warehouseId } }),
  ]);
  if (!provider) throw new NotFoundError("Logistics provider not found");
  if (!warehouse) throw new NotFoundError("Warehouse not found");

  return prisma.$transaction(async (tx) => {
    const mapping = await tx.logisticsWarehouseMapping.create({
      data: {
        providerId: input.providerId,
        warehouseId: input.warehouseId,
        externalWarehouseReference: input.externalWarehouseReference,
        externalServiceZoneId: input.externalServiceZoneId,
        isActive: false,
      },
    });
    await audit(tx, actorId, "LOGISTICS_WAREHOUSE_MAPPING_CREATED", "LogisticsWarehouseMapping", mapping.id, {
      providerId: mapping.providerId,
      warehouseId: mapping.warehouseId,
      externalWarehouseReference: mapping.externalWarehouseReference,
      externalServiceZoneId: mapping.externalServiceZoneId,
    });
    return mapping;
  });
};

export const verifyWarehouseMappingService = async (actorId, id, { notes }) => {
  return prisma.$transaction(async (tx) => {
    const current = await tx.logisticsWarehouseMapping.findUnique({ where: { id } });
    if (!current) throw new NotFoundError("Logistics warehouse mapping not found");

    const mapping = await tx.logisticsWarehouseMapping.update({
      where: { id },
      data: { verifiedAt: new Date(), notes, isActive: false },
    });
    await audit(tx, actorId, "LOGISTICS_WAREHOUSE_MAPPING_VERIFIED", "LogisticsWarehouseMapping", id, {
      providerId: mapping.providerId,
      warehouseId: mapping.warehouseId,
      externalWarehouseReference: mapping.externalWarehouseReference,
      notes,
    });
    return mapping;
  });
};

export const activateWarehouseMappingService = async (actorId, id) => {
  return prisma.$transaction(async (tx) => {
    const mapping = await tx.logisticsWarehouseMapping.findUnique({
      where: { id },
      include: { provider: true, warehouse: true },
    });
    if (!mapping) throw new NotFoundError("Logistics warehouse mapping not found");
    if (!mapping.verifiedAt) throw new ConflictError("Warehouse mapping must be verified before activation");
    if (!mapping.externalServiceZoneId) throw new ConflictError("Pickup service-zone reference is required before activation");
    if (!mapping.provider.isActive) throw new ConflictError("Logistics provider is inactive");
    if (!mapping.warehouse.isActive) throw new ConflictError("MarketIQ warehouse is inactive");
    if (!mapping.warehouse.coordinatesVerifiedAt || !mapping.warehouse.coordinatesSource) {
      throw new ConflictError("Warehouse coordinates must be verified before mapping activation");
    }

    const activated = await tx.logisticsWarehouseMapping.update({
      where: { id },
      data: { isActive: true },
    });
    await audit(tx, actorId, "LOGISTICS_WAREHOUSE_MAPPING_ACTIVATED", "LogisticsWarehouseMapping", id, {
      providerId: mapping.providerId,
      warehouseId: mapping.warehouseId,
      externalWarehouseReference: mapping.externalWarehouseReference,
    });
    return activated;
  });
};

export const deactivateWarehouseMappingService = async (actorId, id) => {
  return prisma.$transaction(async (tx) => {
    const mapping = await tx.logisticsWarehouseMapping.findUnique({ where: { id } });
    if (!mapping) throw new NotFoundError("Logistics warehouse mapping not found");
    const updated = await tx.logisticsWarehouseMapping.update({
      where: { id },
      data: { isActive: false },
    });
    await audit(tx, actorId, "LOGISTICS_WAREHOUSE_MAPPING_DEACTIVATED", "LogisticsWarehouseMapping", id, {
      providerId: mapping.providerId,
      warehouseId: mapping.warehouseId,
    });
    return updated;
  });
};

const coordinateData = ({ latitude, longitude, source }) => ({
  latitude,
  longitude,
  coordinatesVerifiedAt: new Date(),
  coordinatesSource: source,
});

export const verifyWarehouseCoordinatesService = async (actorId, id, input) => {
  return prisma.$transaction(async (tx) => {
    const warehouse = await tx.warehouse.findUnique({ where: { id } });
    if (!warehouse) throw new NotFoundError("Warehouse not found");

    const updated = await tx.warehouse.update({
      where: { id },
      data: coordinateData(input),
      select: { id: true, name: true, code: true, latitude: true, longitude: true, coordinatesVerifiedAt: true, coordinatesSource: true },
    });

    // Coordinate changes invalidate operational approval for every provider
    // mapping attached to this warehouse. Re-verification and reactivation are
    // intentionally separate admin actions.
    const invalidatedMappings = await tx.logisticsWarehouseMapping.updateMany({
      where: { warehouseId: id, isActive: true },
      data: { isActive: false, verifiedAt: null },
    });

    await audit(tx, actorId, "LOGISTICS_WAREHOUSE_COORDINATES_VERIFIED", "Warehouse", id, {
      latitude: input.latitude,
      longitude: input.longitude,
      source: input.source,
      invalidatedMappingCount: invalidatedMappings.count,
    });
    return updated;
  });
};

export const verifyAddressCoordinatesService = async (actorId, id, input) => {
  return prisma.$transaction(async (tx) => {
    const address = await tx.address.findUnique({ where: { id } });
    if (!address) throw new NotFoundError("Delivery address not found");

    const updated = await tx.address.update({
      where: { id },
      data: coordinateData(input),
      select: { id: true, addressLine: true, latitude: true, longitude: true, coordinatesVerifiedAt: true, coordinatesSource: true, countryId: true, stateId: true, lgaId: true, cityId: true },
    });
    await audit(tx, actorId, "LOGISTICS_ADDRESS_COORDINATES_VERIFIED", "Address", id, {
      latitude: input.latitude,
      longitude: input.longitude,
      source: input.source,
    });
    return updated;
  });
};


export const listServiceZoneMappingsService = async ({ providerId, isActive } = {}) =>
  prisma.logisticsServiceZoneMapping.findMany({
    where: { ...(providerId && { providerId }), ...(isActive !== undefined && { isActive }) },
    include: {
      provider: { select: { id: true, code: true, name: true, isActive: true } },
      lga: { select: { id: true, name: true, state: { select: { id: true, name: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

export const createServiceZoneMappingService = async (actorId, input) => {
  const [provider, lga] = await Promise.all([
    prisma.logisticsProvider.findUnique({ where: { id: input.providerId } }),
    prisma.lga.findUnique({ where: { id: input.lgaId }, include: { state: true } }),
  ]);
  if (!provider) throw new NotFoundError("Logistics provider not found");
  if (!lga) throw new NotFoundError("MarketIQ LGA not found");
  return prisma.$transaction(async (tx) => {
    const mapping = await tx.logisticsServiceZoneMapping.create({
      data: { ...input, isActive: false },
    });
    await audit(tx, actorId, "LOGISTICS_SERVICE_ZONE_MAPPING_CREATED", "LogisticsServiceZoneMapping", mapping.id, input);
    return mapping;
  });
};

export const verifyServiceZoneMappingService = async (actorId, id, { notes }) =>
  prisma.$transaction(async (tx) => {
    const current = await tx.logisticsServiceZoneMapping.findUnique({ where: { id } });
    if (!current) throw new NotFoundError("Logistics service-zone mapping not found");
    const mapping = await tx.logisticsServiceZoneMapping.update({
      where: { id }, data: { verifiedAt: new Date(), notes, isActive: false },
    });
    await audit(tx, actorId, "LOGISTICS_SERVICE_ZONE_MAPPING_VERIFIED", "LogisticsServiceZoneMapping", id, { notes });
    return mapping;
  });

export const activateServiceZoneMappingService = async (actorId, id) =>
  prisma.$transaction(async (tx) => {
    const current = await tx.logisticsServiceZoneMapping.findUnique({
      where: { id }, include: { provider: true, lga: true },
    });
    if (!current) throw new NotFoundError("Logistics service-zone mapping not found");
    if (!current.verifiedAt) throw new ConflictError("Service-zone mapping must be verified before activation");
    if (!current.provider.isActive) throw new ConflictError("Logistics provider is inactive");
    const mapping = await tx.logisticsServiceZoneMapping.update({ where: { id }, data: { isActive: true } });
    await audit(tx, actorId, "LOGISTICS_SERVICE_ZONE_MAPPING_ACTIVATED", "LogisticsServiceZoneMapping", id, {});
    return mapping;
  });

export const deactivateServiceZoneMappingService = async (actorId, id) =>
  prisma.$transaction(async (tx) => {
    const current = await tx.logisticsServiceZoneMapping.findUnique({ where: { id } });
    if (!current) throw new NotFoundError("Logistics service-zone mapping not found");
    const mapping = await tx.logisticsServiceZoneMapping.update({ where: { id }, data: { isActive: false } });
    await audit(tx, actorId, "LOGISTICS_SERVICE_ZONE_MAPPING_DEACTIVATED", "LogisticsServiceZoneMapping", id, {});
    return mapping;
  });

export const listPackageCategoryMappingsService = async ({ providerId, isActive } = {}) =>
  prisma.logisticsPackageCategoryMapping.findMany({
    where: { ...(providerId && { providerId }), ...(isActive !== undefined && { isActive }) },
    include: {
      provider: { select: { id: true, code: true, name: true, isActive: true } },
      category: { select: { id: true, name: true, slug: true, type: true, isActive: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

export const createPackageCategoryMappingService = async (actorId, input) => {
  const [provider, category] = await Promise.all([
    prisma.logisticsProvider.findUnique({ where: { id: input.providerId } }),
    prisma.category.findUnique({ where: { id: input.categoryId } }),
  ]);
  if (!provider) throw new NotFoundError("Logistics provider not found");
  if (!category) throw new NotFoundError("Product category not found");
  if (category.type !== "PRODUCT" || !category.isActive) {
    throw new ConflictError("Only active product categories can be mapped for parcel quoting");
  }
  return prisma.$transaction(async (tx) => {
    const mapping = await tx.logisticsPackageCategoryMapping.create({
      data: { ...input, isActive: false },
    });
    await audit(tx, actorId, "LOGISTICS_PACKAGE_CATEGORY_MAPPING_CREATED", "LogisticsPackageCategoryMapping", mapping.id, input);
    return mapping;
  });
};

export const verifyPackageCategoryMappingService = async (actorId, id, { notes }) =>
  prisma.$transaction(async (tx) => {
    const current = await tx.logisticsPackageCategoryMapping.findUnique({ where: { id } });
    if (!current) throw new NotFoundError("Logistics package-category mapping not found");
    const mapping = await tx.logisticsPackageCategoryMapping.update({
      where: { id }, data: { verifiedAt: new Date(), notes, isActive: false },
    });
    await audit(tx, actorId, "LOGISTICS_PACKAGE_CATEGORY_MAPPING_VERIFIED", "LogisticsPackageCategoryMapping", id, { notes });
    return mapping;
  });

export const activatePackageCategoryMappingService = async (actorId, id) =>
  prisma.$transaction(async (tx) => {
    const current = await tx.logisticsPackageCategoryMapping.findUnique({
      where: { id }, include: { provider: true, category: true },
    });
    if (!current) throw new NotFoundError("Logistics package-category mapping not found");
    if (!current.verifiedAt) throw new ConflictError("Package-category mapping must be verified before activation");
    if (!current.provider.isActive) throw new ConflictError("Logistics provider is inactive");
    if (!current.category.isActive || current.category.type !== "PRODUCT") {
      throw new ConflictError("Mapped product category is inactive or no longer eligible");
    }
    const mapping = await tx.logisticsPackageCategoryMapping.update({ where: { id }, data: { isActive: true } });
    await audit(tx, actorId, "LOGISTICS_PACKAGE_CATEGORY_MAPPING_ACTIVATED", "LogisticsPackageCategoryMapping", id, {});
    return mapping;
  });

export const deactivatePackageCategoryMappingService = async (actorId, id) =>
  prisma.$transaction(async (tx) => {
    const current = await tx.logisticsPackageCategoryMapping.findUnique({ where: { id } });
    if (!current) throw new NotFoundError("Logistics package-category mapping not found");
    const mapping = await tx.logisticsPackageCategoryMapping.update({ where: { id }, data: { isActive: false } });
    await audit(tx, actorId, "LOGISTICS_PACKAGE_CATEGORY_MAPPING_DEACTIVATED", "LogisticsPackageCategoryMapping", id, {});
    return mapping;
  });
