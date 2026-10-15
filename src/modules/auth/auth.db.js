import prisma from "../../config/prisma.js";

const dbClient = (tx) => tx || prisma;

export const findUserByEmail = async (email, tx) => {
  return dbClient(tx).user.findUnique({
    where: {
      email,
    },
    include: {
      sellerProfile: true,
    },
  });
};

export const findUserById = async (id, tx) => {
  return dbClient(tx).user.findUnique({
    where: {
      id,
    },
    include: {
      sellerProfile: true,
    },
  });
};

export const findUserByPhone = async (phone, tx) => {
  return dbClient(tx).user.findUnique({
    where: {
      phone,
    },
  });
};

export const createUser = async (data, tx) => {
  return dbClient(tx).user.create({
    data,
    include: {
      sellerProfile: true,
    },
  });
};

export const createRefreshToken = async (data, tx) => {
  return dbClient(tx).refreshToken.create({
    data,
  });
};

export const findRefreshTokenByHash = async (tokenHash, tx) => {
  return dbClient(tx).refreshToken.findUnique({
    where: {
      tokenHash,
    },
  });
};

// Conditional revocation makes refresh-token rotation single-use under concurrent
// requests. Callers must check count === 1 before issuing a replacement token.
export const revokeRefreshToken = async (id, tx) => {
  return dbClient(tx).refreshToken.updateMany({
    where: {
      id,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
};

export const revokeAllUserRefreshTokens = async (userId, tx) => {
  return dbClient(tx).refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
};

export const withTransaction = async (callback) => {
  return prisma.$transaction(callback);
};

export const updateUser = async (id, data, tx) => {
  return dbClient(tx).user.update({
    where: { id },
    data,
    include: { sellerProfile: true },
  });
};

export const createOAuthAccount = async (data, tx) => {
  return dbClient(tx).oAuthAccount.create({ data });
};

export const findOAuthAccount = async (provider, providerSubject, tx) => {
  return dbClient(tx).oAuthAccount.findUnique({
    where: { provider_providerSubject: { provider, providerSubject } },
  });
};

export const findOAuthAccountByUser = async (userId, provider, tx) => {
  return dbClient(tx).oAuthAccount.findFirst({ where: { userId, provider } });
};

export const deleteOAuthAccount = async (id, tx) => {
  return dbClient(tx).oAuthAccount.delete({ where: { id } });
};

export const createEmailVerificationToken = async (data, tx) => {
  return dbClient(tx).emailVerificationToken.create({ data });
};

export const findEmailVerificationToken = async (tokenHash, tx) => {
  return dbClient(tx).emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
};

export const consumeEmailVerificationToken = async (id, tx) => {
  return dbClient(tx).emailVerificationToken.updateMany({
    where: { id, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date() },
  });
};

export const revokeEmailVerificationTokens = async (userId, tx) => {
  return dbClient(tx).emailVerificationToken.updateMany({
    where: { userId, consumedAt: null },
    data: { consumedAt: new Date() },
  });
};

export const createPasswordResetToken = async (data, tx) => {
  return dbClient(tx).passwordResetToken.create({ data });
};

export const findPasswordResetToken = async (tokenHash, tx) => {
  return dbClient(tx).passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
};

export const consumePasswordResetToken = async (id, tx) => {
  return dbClient(tx).passwordResetToken.updateMany({
    where: { id, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date() },
  });
};

export const revokePasswordResetTokens = async (userId, tx) => {
  return dbClient(tx).passwordResetToken.updateMany({
    where: { userId, consumedAt: null },
    data: { consumedAt: new Date() },
  });
};
