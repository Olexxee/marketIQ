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
        isActive: false,
      },
    });
    await audit(tx, actorId, "LOGISTICS_WAREHOUSE_MAPPING_CREATED", "LogisticsWarehouseMapping", mapping.id, {
      providerId: mapping.providerId,
      warehouseId: mapping.warehouseId,
      externalWarehouseReference: mapping.externalWarehouseReference,
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
    });
    await audit(tx, actorId, "LOGISTICS_ADDRESS_COORDINATES_VERIFIED", "Address", id, {
      latitude: input.latitude,
      longitude: input.longitude,
      source: input.source,
    });
    return updated;
  });
};
