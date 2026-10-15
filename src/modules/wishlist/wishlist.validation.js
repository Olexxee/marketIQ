import { z } from "zod";
import { cuid } from "../../lib/validators.js";

export const productIdParamSchema = z.object({
  productId: cuid,
}).strict();
