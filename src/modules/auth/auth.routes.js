import { Router } from "express";
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  logoutAllDevices,
  currentUser,
} from "./auth.controller.js";
import { registerSchema, loginSchema } from "./auth.validation.js";
import { validateBody } from "../../middlewares/validateMiddleware.js";
import { authenticate } from "../../middlewares/authenticate.js";


const authRouter = Router();

authRouter.post("/register", validateBody(registerSchema), registerUser);

authRouter.post("/login", validateBody(loginSchema), loginUser);

authRouter.post("/refresh", refreshAccessToken);

authRouter.post("/logout", logoutUser);

authRouter.post("/logout-all", authenticate, logoutAllDevices);

authRouter.get("/me", authenticate, currentUser);

export default authRouter;
