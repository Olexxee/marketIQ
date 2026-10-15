import { asyncWrapper } from "../../lib/asyncWrapper.js";
import { successResponse } from "../../lib/response.js";
import {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  getCurrentUser,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  changePassword,
  updateProfile,
  googleSignIn,
  linkGoogleAccount,
  unlinkGoogleAccount,
} from "./auth.service.js";
import { env } from "../../config/env.js";

const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: env.NODE_ENV === "production" ? "none" : "lax",
  path: "/api/auth",
  maxAge: 30 * 24 * 60 * 60 * 1000,
});

const setRefreshCookie = (res, token) =>
  res.cookie(env.JWT_REFRESH_COOKIE_NAME, token, refreshCookieOptions());

const clearRefreshCookie = (res) =>
  res.clearCookie(env.JWT_REFRESH_COOKIE_NAME, refreshCookieOptions());

const withoutRefreshToken = (result) => {
  const { refreshToken, ...response } = result;
  return response;
};

export const registerUser = asyncWrapper(async (req, res) => {
  const result = await register(req.body);
  setRefreshCookie(res, result.refreshToken);
  return successResponse({
    res, statusCode: 201,
    message: "Account created. Check your email to verify your address.",
    data: withoutRefreshToken(result),
  });
});

export const loginUser = asyncWrapper(async (req, res) => {
  const result = await login(req.body);
  setRefreshCookie(res, result.refreshToken);
  return successResponse({
    res, message: "Login successful", data: withoutRefreshToken(result),
  });
});

export const googleSignInUser = asyncWrapper(async (req, res) => {
  const result = await googleSignIn(req.body.idToken);
  setRefreshCookie(res, result.refreshToken);
  return successResponse({
    res, message: "Google sign-in successful", data: withoutRefreshToken(result),
  });
});

export const refreshAccessToken = asyncWrapper(async (req, res) => {
  const result = await refresh(req.cookies?.[env.JWT_REFRESH_COOKIE_NAME]);
  setRefreshCookie(res, result.refreshToken);
  return successResponse({
    res, message: "Access token refreshed successfully",
    data: withoutRefreshToken(result),
  });
});

export const logoutUser = asyncWrapper(async (req, res) => {
  await logout(req.cookies?.[env.JWT_REFRESH_COOKIE_NAME]);
  clearRefreshCookie(res);
  return successResponse({ res, message: "Logged out successfully" });
});

export const logoutAllDevices = asyncWrapper(async (req, res) => {
  await logoutAll(req.user.id);
  clearRefreshCookie(res);
  return successResponse({ res, message: "Logged out from all devices" });
});

export const currentUser = asyncWrapper(async (req, res) => {
  const user = await getCurrentUser(req.user.id);
  return successResponse({
    res, message: "Authenticated user retrieved successfully", data: user,
  });
});

export const verifyEmailAddress = asyncWrapper(async (req, res) => {
  const result = await verifyEmail(req.body.token);
  return successResponse({ res, message: "Email verified successfully", data: result });
});

export const resendVerificationEmail = asyncWrapper(async (req, res) => {
  await resendVerification(req.body.email);
  return successResponse({
    res,
    message: "If an unverified account exists for that email, a verification email has been sent.",
  });
});

export const requestPasswordReset = asyncWrapper(async (req, res) => {
  await forgotPassword(req.body.email);
  return successResponse({
    res,
    message: "If an active account exists for that email, password reset instructions have been sent.",
  });
});

export const resetPasswordWithToken = asyncWrapper(async (req, res) => {
  await resetPassword(req.body);
  clearRefreshCookie(res);
  return successResponse({
    res, message: "Password reset successfully. Sign in with your new password.",
  });
});

export const changeCurrentPassword = asyncWrapper(async (req, res) => {
  await changePassword(req.user.id, req.body);
  clearRefreshCookie(res);
  return successResponse({
    res, message: "Password changed. Sign in again on this device.",
  });
});

export const patchCurrentProfile = asyncWrapper(async (req, res) => {
  const user = await updateProfile(req.user.id, req.body);
  return successResponse({ res, message: "Profile updated successfully", data: user });
});

export const linkGoogle = asyncWrapper(async (req, res) => {
  const result = await linkGoogleAccount(req.user.id, req.body.idToken);
  return successResponse({ res, message: "Google account linked successfully", data: result });
});

export const unlinkGoogle = asyncWrapper(async (req, res) => {
  const result = await unlinkGoogleAccount(req.user.id);
  return successResponse({ res, message: "Google account unlinked successfully", data: result });
});
