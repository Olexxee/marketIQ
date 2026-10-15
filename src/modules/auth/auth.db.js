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
