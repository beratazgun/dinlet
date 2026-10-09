import { AuthAccountService } from "./auth-account.service.js";
import { AuthPasswordService } from "./auth-password.service.js";
import { AuthSessionService } from "./auth-session.service.js";
import { AuthSocialService } from "./auth-social.service.js";
import { AuthService } from "./auth.service.js";
import { ConsentService } from "./consent.service.js";
import { LegalService } from "./legal.service.js";
import { SocialIdentityService } from "./social-identity.service.js";
import { UserPurgeService } from "./user-purge.service.js";

export {
  AuthAccountService,
  AuthPasswordService,
  AuthSessionService,
  AuthSocialService,
  AuthService,
  ConsentService,
  LegalService,
  SocialIdentityService,
  UserPurgeService,
};

export const AuthServices = [
  AuthService,
  AuthPasswordService,
  AuthSessionService,
  AuthAccountService,
  AuthSocialService,
  SocialIdentityService,
  UserPurgeService,
  ConsentService,
  LegalService,
];
