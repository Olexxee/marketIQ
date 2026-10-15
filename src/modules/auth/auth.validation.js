import { z } from "zod";

const emailSchema = z.string().trim().email("Invalid email address").transform((value) => value.toLowerCase());
const phoneSchema = z.string().trim().min(7, "Invalid phone number").max(20, "Invalid phone number").optional().nullable();
const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(128, "Password is too long");
const tokenSchema = z.string().trim().min(20, "Invalid token").max(512, "Invalid token");

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters").max(100, "Full name is too long"),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(128),
});

export const googleSignInSchema = z.object({ idToken: z.string().min(20).max(8192) });
export const tokenBodySchema = z.object({ token: tokenSchema });
export const emailBodySchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ token: tokenSchema, password: passwordSchema });
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
}).refine((value) => value.currentPassword !== value.newPassword, {
  message: "New password must differ from current password",
  path: ["newPassword"],
});
export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  phone: phoneSchema,
}).refine((value) => value.fullName !== undefined || value.phone !== undefined, {
  message: "Provide at least one profile field",
});
