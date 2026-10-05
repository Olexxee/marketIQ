import { asyncWrapper } from "../../lib/asyncWrapper.js";
import { successResponse } from "../../lib/response.js";

import { checkoutService } from "./checkout.service.js";

export const checkout = asyncWrapper(async (req, res) => {
  const order = await checkoutService(req.user.id, req.body);

  return successResponse({
    res,
    statusCode: 201,
    message: "Order created successfully",
    data: order,
  });
});
