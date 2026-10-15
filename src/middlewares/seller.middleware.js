import { ForbiddenError, NotFoundError } from "../classes/errorClasses.js";
import { findSellerByUserId } from "../modules/sellers/seller.db.js";

export const requireSeller = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      throw new ForbiddenError("Authentication required");
    }

    // Never accept a seller ID from request input. Resolve ownership from the
    // authenticated user's ID to prevent cross-seller access.
    const seller = await findSellerByUserId(req.user.id);

    if (!seller) {
      throw new NotFoundError("Seller profile not found");
    }

    req.seller = seller;
    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireActiveSeller = (req, res, next) => {
  if (!req.seller) {
    return next(new ForbiddenError("Seller context is required"));
  }

  if (req.seller.status !== "ACTIVE") {
    return next(
      new ForbiddenError("An active seller profile is required for this operation"),
    );
  }

  return next();
};
