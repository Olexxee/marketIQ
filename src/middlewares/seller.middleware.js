import { NotFoundError } from "../classes/errorClasses.js";
import { findSellerByUserId } from "../modules/sellers/seller.db.js";

export const requireSeller = async (req, res, next) => {
  try {
    const seller = await findSellerByUserId(req.user.id);

    if (!seller) {
      throw new NotFoundError("Seller profile not found");
    }

    req.seller = seller;

    next();
  } catch (error) {
    next(error);
  }
};
