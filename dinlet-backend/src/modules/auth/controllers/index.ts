import { AuthController } from "./auth.controller.js";
import { LegalController } from "./legal.controller.js";
import { SocialAuthController } from "./social-auth.controller.js";
import { UserController } from "./user.controller.js";

export { AuthController, LegalController, SocialAuthController, UserController };

export const AuthControllers = [
  AuthController,
  LegalController,
  SocialAuthController,
  UserController,
];
