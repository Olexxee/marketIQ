import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  registerUser,
  loginUser,
  googleSignInUser,
  refreshAccessToken,
  logoutUser,
  logoutAllDevices,
  currentUser,
  verifyEmailAddress,
  resendVerificationEmail,
  requestPasswordReset,
  resetPasswordWithToken,
  changeCurrentPassword,
  patchCurrentProfile,
  linkGoogle,
  unlinkGoogle,
} from "./auth.controller.js";
import {
  registerSchema,
  loginSchema,
  googleSignInSchema,
  tokenBodySchema,
  emailBodySchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
} from "./auth.validation.js";
import { validateBody } from "../../middlewares/validateMiddleware.js";
import { authenticate } from "../../middlewares/authenticate.js";

const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many authentication attempts. Try again later." },
});
const recoveryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Try again later." },
});

authRouter.post("/register", authLimiter, validateBody(registerSchema), registerUser);
authRouter.post("/login", authLimiter, validateBody(loginSchema), loginUser);
authRouter.post("/google", authLimiter, validateBody(googleSignInSchema), googleSignInUser);
authRouter.post("/refresh", refreshAccessToken);
authRouter.post("/logout", logoutUser);
authRouter.post("/logout-all", authenticate, logoutAllDevices);
authRouter.get("/me", authenticate, currentUser);

authRouter.post("/verify-email", recoveryLimiter, validateBody(tokenBodySchema), verifyEmailAddress);
authRouter.post("/resend-verification", recoveryLimiter, validateBody(emailBodySchema), resendVerificationEmail);
authRouter.post("/forgot-password", recoveryLimiter, validateBody(emailBodySchema), requestPasswordReset);
authRouter.post("/reset-password", recoveryLimiter, validateBody(resetPasswordSchema), resetPasswordWithToken);
authRouter.post("/change-password", authenticate, recoveryLimiter, validateBody(changePasswordSchema), changeCurrentPassword);
authRouter.patch("/profile", authenticate, validateBody(updateProfileSchema), patchCurrentProfile);
authRouter.post("/google/link", authenticate, authLimiter, validateBody(googleSignInSchema), linkGoogle);
authRouter.delete("/google/link", authenticate, unlinkGoogle);

export default authRouter;
