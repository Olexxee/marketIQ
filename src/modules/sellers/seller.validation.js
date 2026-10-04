import { z } from "zod";

const tradeCapabilitySchema = z.enum([
  "RETAIL",
  "WHOLESALE",
  "IMPORTER",
  "EXPORTER",
  "MANUFACTURER",
  "DISTRIBUTOR",
]);

const optionalString = (max, message) =>
  z.string().trim().max(max, message).optional().nullable();

export const onboardSellerSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(2, "Business name must be at least 2 characters")
    .max(150, "Business name is too long"),

  description: optionalString(2000, "Business description is too long"),

  phone: z
    .string()
    .trim()
    .min(7, "Invalid business phone number")
    .max(20, "Invalid business phone number")
    .optional()
    .nullable(),

  email: z
    .string()
    .trim()
    .email("Invalid business email address")
    .transform((value) => value.toLowerCase())
    .optional()
    .nullable(),

  tradeCapabilities: z
    .array(tradeCapabilitySchema)
    .min(1, "Select at least one business capability")
    .max(6, "Too many business capabilities")
    .refine(
      (values) => new Set(values).size === values.length,
      "Business capabilities must be unique",
    ),
});

export const updateSellerSchema = z
  .object({
    businessName: z
      .string()
      .trim()
      .min(2, "Business name must be at least 2 characters")
      .max(150, "Business name is too long")
      .optional(),

    description: optionalString(2000, "Business description is too long"),

    phone: z
      .string()
      .trim()
      .min(7, "Invalid business phone number")
      .max(20, "Invalid business phone number")
      .optional()
      .nullable(),

    email: z
      .string()
      .trim()
      .email("Invalid business email address")
      .transform((value) => value.toLowerCase())
      .optional()
      .nullable(),

    tradeCapabilities: z
      .array(tradeCapabilitySchema)
      .min(1, "Select at least one business capability")
      .max(6, "Too many business capabilities")
      .refine(
        (values) => new Set(values).size === values.length,
        "Business capabilities must be unique",
      )
      .optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field is required",
  );

export const sellerLocationIdParamSchema = z.object({
  id: z.string().min(1, "Location ID is required"),
});

export const createBusinessLocationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Location name must be at least 2 characters")
    .max(150, "Location name is too long"),

  addressLine: z
    .string()
    .trim()
    .min(3, "Address is required")
    .max(500, "Address is too long"),

  countryId: z.string().min(1, "Country is required"),

  stateId: z.string().min(1, "State is required"),

  lgaId: z.string().min(1, "LGA is required"),

  cityId: z.string().min(1, "City is required"),

  isPrimary: z.boolean().optional().default(false),

  isFulfillmentLocation: z.boolean().optional().default(false),
});

export const updateBusinessLocationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Location name must be at least 2 characters")
      .max(150, "Location name is too long")
      .optional(),

    addressLine: z
      .string()
      .trim()
      .min(3, "Address is required")
      .max(500, "Address is too long")
      .optional(),

    countryId: z.string().min(1, "Country is required").optional(),

    stateId: z.string().min(1, "State is required").optional(),

    lgaId: z.string().min(1, "LGA is required").optional(),

    cityId: z.string().min(1, "City is required").optional(),

    isPrimary: z.boolean().optional(),

    isFulfillmentLocation: z.boolean().optional(),

    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field is required",
  );
