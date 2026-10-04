import jwt from "jsonwebtoken";

import { env } from "./env.js";

export const signAccessToken = (user) => {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    },
  );
};

export const signRefreshToken = (userId) => {
  return jwt.sign(
    {
      sub: userId,
    },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    },
  );
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
};

export const verifyRefreshToken = (token) => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
};
