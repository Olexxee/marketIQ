import bcrypt from "bcryptjs";
import {
  createEmailVerificationToken,
  createOAuthAccount,
  createPasswordResetToken,
  createRefreshToken,
  createUser,
  consumeEmailVerificationToken,
  consumePasswordResetToken,
  deleteOAuthAccount,
  findEmailVerificationToken,
  findOAuthAccount,
  findOAuthAccountByUser,
  findPasswordResetToken,
  findRefreshTokenByHash,
  findUserByEmail,
  findUserById,
  findUserByPhone,
  revokeAllUserRefreshTokens,
  revokeEmailVerificationTokens,
  revokePasswordResetTokens,
  revokeRefreshToken,
  updateUser,
  withTransaction,
} from "./auth.db.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../config/jwt.js";
import {
  createOpaqueToken,
  getRefreshTokenExpiry,
  getTokenExpiry,
  hashOpaqueToken,
  hashRefreshToken,
} from "./auth.utils.js";
import { sendAuthEmail, buildFrontendUrl } from "./auth.email.js";
import { verifyGoogleIdToken } from "./google.identity.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../../classes/errorClasses.js";

const SALT_ROUNDS = 12;
const VERIFICATION_MINUTES = 30;
const RESET_MINUTES = 20;

const sanitizeUser = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone ?? null,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    sellerProfile: user.sellerProfile
      ? {
          id: user.sellerProfile.id,
          businessName: user.sellerProfile.businessName,
          status: user.sellerProfile.status,
        }
      : null,
  };
};

const assertActiveUser = (user) => {
  if (!user) throw new UnauthorizedError("Invalid email or password");
  if (user.status !== "ACTIVE") throw new UnauthorizedError("Your account is suspended");
};

const buildAuthResponse = (user, accessToken) => ({
  user: sanitizeUser(user),
  accessToken,
});

const issueSession = async (user) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user.id);
  await createRefreshToken({
    userId: user.id,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: getRefreshTokenExpiry(),
  });
  return { ...buildAuthResponse(user, accessToken), refreshToken };
};

const issueVerificationEmail = async (user) => {
  if (user.emailVerifiedAt) return;
  await revokeEmailVerificationTokens(user.id);
  const token = createOpaqueToken();
  await createEmailVerificationToken({
    userId: user.id,
    tokenHash: hashOpaqueToken(token),
    expiresAt: getTokenExpiry(VERIFICATION_MINUTES),
  });
  const url = buildFrontendUrl("/verify-email", { token });
  await sendAuthEmail({
    to: user.email,
    subject: "Verify your MarketIQ email",
    text: `Verify your email within 30 minutes: ${url}`,
    html: `<p>Hello ${escapeHtml(user.fullName)},</p><p>Verify your MarketIQ email within 30 minutes.</p><p><a href="${url}">Verify email</a></p><p>If you did not create this account, you can ignore this message.</p>`,
  });
};

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);

export const register = async ({ fullName, email, phone, password }) => {
  if (await findUserByEmail(email)) {
    throw new ConflictError("An account with this email already exists");
  }
  if (phone && (await findUserByPhone(phone))) {
    throw new ConflictError("An account with this phone number already exists");
  }

  const user = await createUser({
    fullName,
    email,
    phone: phone || null,
    password: await bcrypt.hash(password, SALT_ROUNDS),
    role: "USER",
    status: "ACTIVE",
    emailVerifiedAt: null,
  });
  await issueVerificationEmail(user);
  return issueSession(user);
};

export const login = async ({ email, password }) => {
  const user = await findUserByEmail(email);
  assertActiveUser(user);
  if (!user.password || !(await bcrypt.compare(password, user.password))) {
    throw new UnauthorizedError("Invalid email or password");
  }
  return issueSession(user);
};

export const refresh = async (rawRefreshToken) => {
  if (!rawRefreshToken) throw new UnauthorizedError("Refresh token is required");

  let payload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }

  const storedToken = await findRefreshTokenByHash(hashRefreshToken(rawRefreshToken));
  if (!storedToken || storedToken.revokedAt || storedToken.expiresAt <= new Date()) {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }
  if (storedToken.userId !== payload.sub) throw new UnauthorizedError("Invalid refresh token");

  const user = await findUserById(storedToken.userId);
  assertActiveUser(user);

  const newRefreshToken = await withTransaction(async (tx) => {
    const revocation = await revokeRefreshToken(storedToken.id, tx);
    if (revocation.count !== 1) {
      throw new UnauthorizedError("Refresh token has already been used");
    }
    const nextToken = signRefreshToken(user.id);
    await createRefreshToken({
      userId: user.id,
      tokenHash: hashRefreshToken(nextToken),
      expiresAt: getRefreshTokenExpiry(),
    }, tx);
    return nextToken;
  });

  return { ...buildAuthResponse(user, signAccessToken(user)), refreshToken: newRefreshToken };
};

export const logout = async (rawRefreshToken) => {
  if (!rawRefreshToken) return;
  const storedToken = await findRefreshTokenByHash(hashRefreshToken(rawRefreshToken));
  if (storedToken && !storedToken.revokedAt) await revokeRefreshToken(storedToken.id);
};

export const logoutAll = async (userId) => {
  const user = await findUserById(userId);
  if (!user) throw new NotFoundError("User not found");
  await revokeAllUserRefreshTokens(userId);
};

export const getCurrentUser = async (userId) => {
  const user = await findUserById(userId);
  if (!user) throw new NotFoundError("User not found");
  assertActiveUser(user);
  return sanitizeUser(user);
};

export const verifyEmail = async (rawToken) => {
  if (!rawToken) throw new BadRequestError("Verification token is required");
  const record = await findEmailVerificationToken(hashOpaqueToken(rawToken));
  if (!record || record.consumedAt || record.expiresAt <= new Date()) {
    throw new BadRequestError("Verification link is invalid or expired");
  }
  assertActiveUser(record.user);
  await withTransaction(async (tx) => {
    const consumed = await consumeEmailVerificationToken(record.id, tx);
    if (consumed.count !== 1) throw new BadRequestError("Verification link is invalid or expired");
    await updateUser(record.user.id, { emailVerifiedAt: new Date() }, tx);
    await revokeEmailVerificationTokens(record.user.id, tx);
  });
  return { email: record.user.email, emailVerifiedAt: new Date() };
};

export const resendVerification = async (email) => {
  const user = await findUserByEmail(email);
  if (user?.status === "ACTIVE" && !user.emailVerifiedAt) {
    await issueVerificationEmail(user);
  }
};

export const forgotPassword = async (email) => {
  const user = await findUserByEmail(email);
  if (!user || user.status !== "ACTIVE") return;
  await revokePasswordResetTokens(user.id);
  const token = createOpaqueToken();
  await createPasswordResetToken({
    userId: user.id,
    tokenHash: hashOpaqueToken(token),
    expiresAt: getTokenExpiry(RESET_MINUTES),
  });
  const url = buildFrontendUrl("/reset-password", { token });
  await sendAuthEmail({
    to: user.email,
    subject: "Reset your MarketIQ password",
    text: `Reset your password within 20 minutes: ${url}. If you did not request this, ignore this email.`,
    html: `<p>Hello ${escapeHtml(user.fullName)},</p><p>This link expires in 20 minutes.</p><p><a href="${url}">Reset password</a></p><p>If you did not request this, ignore this email.</p>`,
  });
};

export const resetPassword = async ({ token, password }) => {
  if (!token) throw new BadRequestError("Password reset token is required");
  const record = await findPasswordResetToken(hashOpaqueToken(token));
  if (!record || record.consumedAt || record.expiresAt <= new Date()) {
    throw new BadRequestError("Password reset link is invalid or expired");
  }
  assertActiveUser(record.user);
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  await withTransaction(async (tx) => {
    const consumed = await consumePasswordResetToken(record.id, tx);
    if (consumed.count !== 1) throw new BadRequestError("Password reset link is invalid or expired");
    await updateUser(record.user.id, { password: hashedPassword }, tx);
    await revokePasswordResetTokens(record.user.id, tx);
    await revokeAllUserRefreshTokens(record.user.id, tx);
  });
};

export const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await findUserById(userId);
  if (!user) throw new NotFoundError("User not found");
  if (!user.password || !(await bcrypt.compare(currentPassword, user.password))) {
    throw new UnauthorizedError("Current password is incorrect");
  }
  const password = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await withTransaction(async (tx) => {
    await updateUser(userId, { password }, tx);
    await revokeAllUserRefreshTokens(userId, tx);
  });
};

export const updateProfile = async (userId, { fullName, phone }) => {
  if (phone) {
    const existing = await findUserByPhone(phone);
    if (existing && existing.id !== userId) {
      throw new ConflictError("An account with this phone number already exists");
    }
  }
  const data = {};
  if (fullName !== undefined) data.fullName = fullName;
  if (phone !== undefined) data.phone = phone || null;
  const user = await updateUser(userId, data);
  return sanitizeUser(user);
};

export const googleSignIn = async (idToken) => {
  const identity = await verifyGoogleIdToken(idToken);
  const linked = await findOAuthAccount("google", identity.subject);
  if (linked) {
    const user = await findUserById(linked.userId);
    assertActiveUser(user);
    return issueSession(user);
  }

  const existing = await findUserByEmail(identity.email);
  if (existing) {
    throw new ConflictError("An account already exists with this email. Sign in with your password, then link Google from account settings.");
  }

  const user = await withTransaction(async (tx) => {
    const created = await createUser({
      fullName: identity.fullName,
      email: identity.email,
      password: null,
      role: "USER",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    }, tx);
    await createOAuthAccount({
      userId: created.id,
      provider: "google",
      providerSubject: identity.subject,
    }, tx);
    return created;
  });
  return issueSession(user);
};

export const linkGoogleAccount = async (userId, idToken) => {
  const identity = await verifyGoogleIdToken(idToken);
  const user = await findUserById(userId);
  if (!user) throw new NotFoundError("User not found");
  if (identity.email !== user.email.toLowerCase()) {
    throw new ForbiddenError("The Google account email must match your MarketIQ email");
  }
  const existing = await findOAuthAccount("google", identity.subject);
  if (existing && existing.userId !== userId) {
    throw new ConflictError("This Google account is already linked to another account");
  }
  if (existing) return { linked: true };
  await createOAuthAccount({ userId, provider: "google", providerSubject: identity.subject });
  if (!user.emailVerifiedAt) await updateUser(userId, { emailVerifiedAt: new Date() });
  return { linked: true };
};

export const unlinkGoogleAccount = async (userId) => {
  const user = await findUserById(userId);
  if (!user) throw new NotFoundError("User not found");
  if (!user.password) {
    throw new ForbiddenError("Set a password before unlinking Google so you do not lose account access");
  }
  const account = await findOAuthAccountByUser(userId, "google");
  if (account) await deleteOAuthAccount(account.id);
  return { linked: false };
};
