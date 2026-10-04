import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .email("Invalid email address")
  .transform((value) => value.toLowerCase());

const phoneSchema = z
  .string()
  .trim()
  .min(7, "Invalid phone number")
  .max(20, "Invalid phone number")
  .optional()
  .nullable();

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long");

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name is too long"),

  email: emailSchema,

  phone: phoneSchema,

  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,

  password: z.string().min(1, "Password is required"),
});
