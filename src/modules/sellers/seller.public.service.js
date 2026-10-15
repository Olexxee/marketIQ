import { NotFoundError } from "../../classes/errorClasses.js";
import { getPagination } from "../../lib/pagination.js";
import {
  countPublicSellers,
  findPublicSellerById,
  findPublicSellers,
} from "./seller.public.db.js";

export const listPublicSellersService = async (query = {}) => {
  const { page, limit, skip, take } = getPagination(query);
  const filters = {
    search: query.search,
    tradeCapability: query.tradeCapability,
  };

  const [items, total] = await Promise.all([
    findPublicSellers({ ...filters, skip, take }),
    countPublicSellers(filters),
  ]);

  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
};

export const getPublicSellerStorefrontService = async (id) => {
  const seller = await findPublicSellerById(id);
  if (!seller) throw new NotFoundError("Seller storefront not found");
  return seller;
};
