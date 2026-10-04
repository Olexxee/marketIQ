import { asyncWrapper } from "../../lib/asyncWrapper.js";
import { successResponse } from "../../lib/response.js";

import {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  getCurrentUser,
} from "./auth.service.js";

import { env } from "../../config/env.js";

const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: env.NODE_ENV === "production" ? "none" : "lax",
  path: "/api/auth",
  maxAge: 30 * 24 * 60 * 60 * 1000,
});

export const registerUser = asyncWrapper(async (req, res) => {
  const result = await register(req.body);

  res.cookie(
    env.JWT_REFRESH_COOKIE_NAME,
    result.refreshToken,
    refreshCookieOptions(),
  );

  const { refreshToken, ...response } = result;

  void refreshToken;

  return successResponse({
    res,
    statusCode: 201,
    message: "Account created successfully",
    data: response,
  });
});

export const loginUser = asyncWrapper(async (req, res) => {
  const result = await login(req.body);

  res.cookie(
    env.JWT_REFRESH_COOKIE_NAME,
    result.refreshToken,
    refreshCookieOptions(),
  );

  const { refreshToken, ...response } = result;

  void refreshToken;

  return successResponse({
    res,
    statusCode: 200,
    message: "Login successful",
    data: response,
  });
});

export const refreshAccessToken = asyncWrapper(async (req, res) => {
  const rawRefreshToken = req.cookies[env.JWT_REFRESH_COOKIE_NAME];

  const result = await refresh(rawRefreshToken);

  res.cookie(
    env.JWT_REFRESH_COOKIE_NAME,
    result.refreshToken,
    refreshCookieOptions(),
  );

  const { refreshToken, ...response } = result;

  void refreshToken;

  return successResponse({
    res,
    statusCode: 200,
    message: "Access token refreshed successfully",
    data: response,
  });
});

export const logoutUser = asyncWrapper(async (req, res) => {
  const rawRefreshToken = req.cookies[env.JWT_REFRESH_COOKIE_NAME];

  await logout(rawRefreshToken);

  res.clearCookie(env.JWT_REFRESH_COOKIE_NAME, refreshCookieOptions());

  return successResponse({
    res,
    statusCode: 200,
    message: "Logged out successfully",
  });
});

export const logoutAllDevices = asyncWrapper(async (req, res) => {
  await logoutAll(req.user.id);

  res.clearCookie(env.JWT_REFRESH_COOKIE_NAME, refreshCookieOptions());

  return successResponse({
    res,
    statusCode: 200,
    message: "Logged out from all devices",
  });
});

export const currentUser = asyncWrapper(async (req, res) => {
  const user = await getCurrentUser(req.user.id);

  return successResponse({
    res,
    statusCode: 200,
    message: "Authenticated user retrieved successfully",
    data: user,
  });
});
