import { z } from "zod";

export const idParamSchema = z.object({
  id: z.string().min(1, "ID is required"),
});

export const countryIdParamSchema = z.object({
  countryId: z.string().min(1, "Country ID is required"),
});

export const stateIdParamSchema = z.object({
  stateId: z.string().min(1, "State ID is required"),
});

export const lgaIdParamSchema = z.object({
  lgaId: z.string().min(1, "LGA ID is required"),
});
