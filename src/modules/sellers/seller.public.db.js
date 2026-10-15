import prisma from "../../config/prisma.js";

const dbClient = (tx) => tx || prisma;

const PUBLIC_SELLER_SELECT = {
  id: true,
  businessName: true,
  businessDescription: true,
  status: true,
  tradeCapabilities: true,
  createdAt: true,
  country: { select: { id: true, name: true, code: true } },
  state: { select: { id: true, name: true, code: true } },
  lga: { select: { id: true, name: true } },
  locations: {
    where: { isActive: true, isPrimary: true },
    take: 1,
    select: {
      id: true,
      name: true,
      country: { select: { name: true } },
      state: { select: { name: true } },
      lga: { select: { name: true } },
      city: { select: { name: true } },
    },
  },
};

const buildPublicSellerWhere = ({ search, tradeCapability } = {}) => ({
  status: "ACTIVE",
  ...(search && {
    businessName: { contains: search, mode: "insensitive" },
  }),
  ...(tradeCapability && {
    tradeCapabilities: { has: tradeCapability },
  }),
});

export const findPublicSellers = async ({ search, tradeCapability, skip, take } = {}, tx) =>
  dbClient(tx).sellerProfile.findMany({
    where: buildPublicSellerWhere({ search, tradeCapability }),
    select: {
      ...PUBLIC_SELLER_SELECT,
      _count: { select: { products: { where: { status: "ACTIVE" } } } },
    },
    orderBy: [{ createdAt: "desc" }, { businessName: "asc" }],
    ...(skip !== undefined && { skip }),
    ...(take !== undefined && { take }),
  });

export const countPublicSellers = async ({ search, tradeCapability } = {}, tx) =>
  dbClient(tx).sellerProfile.count({
    where: buildPublicSellerWhere({ search, tradeCapability }),
  });

export const findPublicSellerById = async (id, tx) =>
  dbClient(tx).sellerProfile.findFirst({
    where: { id, status: "ACTIVE" },
    select: {
      ...PUBLIC_SELLER_SELECT,
      _count: { select: { products: { where: { status: "ACTIVE" } } } },
    },
  });
