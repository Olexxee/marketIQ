import bcrypt from "bcryptjs";
import {
  createRefreshToken,
  createUser,
  findRefreshTokenByHash,
  findUserByEmail,
  findUserById,
  findUserByPhone,
  revokeAllUserRefreshTokens,
  revokeRefreshToken,
  withTransaction,
} from "./auth.db.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../config/jwt.js";
import { getRefreshTokenExpiry, hashRefreshToken } from "./auth.utils.js";
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from "../../classes/errorClasses.js";


const SALT_ROUNDS = 12;

const sanitizeUser = (user) => {
  const { password, ...safeUser } = user;

  return safeUser;
};

const assertActiveUser = (user) => {
  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }

  if (user.status !== "ACTIVE") {
    throw new UnauthorizedError("Your account is suspended");
  }
};

const buildAuthResponse = (user, accessToken) => {
  return {
    user: sanitizeUser(user),
    accessToken,
  };
};

export const register = async ({ fullName, email, phone, password }) => {
  const existingEmail = await findUserByEmail(email);

  if (existingEmail) {
    throw new ConflictError("An account with this email already exists");
  }

  if (phone) {
    const existingPhone = await findUserByPhone(phone);

    if (existingPhone) {
      throw new ConflictError(
        "An account with this phone number already exists",
      );
    }
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await createUser({
    fullName,
    email,
    phone: phone || null,
    password: hashedPassword,
    role: "USER",
    status: "ACTIVE",
  });

  const accessToken = signAccessToken(user);

  const refreshToken = signRefreshToken(user.id);

  const refreshTokenHash = hashRefreshToken(refreshToken);

  await createRefreshToken({
    userId: user.id,
    tokenHash: refreshTokenHash,
    expiresAt: getRefreshTokenExpiry(),
  });

  return {
    ...buildAuthResponse(user, accessToken),
    refreshToken,
  };
};

export const login = async ({ email, password }) => {
  const user = await findUserByEmail(email);

  assertActiveUser(user);

  const passwordValid = await bcrypt.compare(password, user.password);

  if (!passwordValid) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const accessToken = signAccessToken(user);

  const refreshToken = signRefreshToken(user.id);

  const refreshTokenHash = hashRefreshToken(refreshToken);

  await createRefreshToken({
    userId: user.id,
    tokenHash: refreshTokenHash,
    expiresAt: getRefreshTokenExpiry(),
  });

  return {
    ...buildAuthResponse(user, accessToken),
    refreshToken,
  };
};

export const refresh = async (rawRefreshToken) => {
  if (!rawRefreshToken) {
    throw new UnauthorizedError("Refresh token is required");
  }

  let payload;

  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }

  const tokenHash = hashRefreshToken(rawRefreshToken);

  const storedToken = await findRefreshTokenByHash(tokenHash);

  if (!storedToken) {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }

  if (storedToken.revokedAt) {
    throw new UnauthorizedError("Refresh token has been revoked");
  }

  if (storedToken.expiresAt <= new Date()) {
    throw new UnauthorizedError("Refresh token has expired");
  }

  if (storedToken.userId !== payload.sub) {
    throw new UnauthorizedError("Invalid refresh token");
  }

  const user = await findUserById(storedToken.userId);

  assertActiveUser(user);

  const result = await withTransaction(async (tx) => {
    await revokeRefreshToken(storedToken.id, tx);

    const newRefreshToken = signRefreshToken(user.id);

    const newRefreshTokenHash = hashRefreshToken(newRefreshToken);

    await createRefreshToken(
      {
        userId: user.id,
        tokenHash: newRefreshTokenHash,
        expiresAt: getRefreshTokenExpiry(),
      },
      tx,
    );

    return newRefreshToken;
  });

  const accessToken = signAccessToken(user);

  return {
    ...buildAuthResponse(user, accessToken),
    refreshToken: result,
  };
};

export const logout = async (rawRefreshToken) => {
  if (!rawRefreshToken) {
    return;
  }

  const tokenHash = hashRefreshToken(rawRefreshToken);

  const storedToken = await findRefreshTokenByHash(tokenHash);

  if (!storedToken || storedToken.revokedAt) {
    return;
  }

  await revokeRefreshToken(storedToken.id);
};

export const logoutAll = async (userId) => {
  const user = await findUserById(userId);

  if (!user) {
    throw new NotFoundError("User not found");
  }

  await revokeAllUserRefreshTokens(userId);
};

export const getCurrentUser = async (userId) => {
  const user = await findUserById(userId);

  if (!user) {
    throw new NotFoundError("User not found");
  }

  assertActiveUser(user);

  return sanitizeUser(user);
};
