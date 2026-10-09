import { AuthAccountRepository } from "./auth-account.repository.js";
import { AuthConsentRepository } from "./auth-consent.repository.js";
import { AuthTokenRepository } from "./auth-token.repository.js";
import { AuthUserRepository } from "./auth-user.repository.js";

export {
  AuthAccountRepository,
  AuthConsentRepository,
  AuthTokenRepository,
  AuthUserRepository,
};
export type { ConsentRecord } from "./auth-consent.repository.js";

export const AuthRepositories = [
  AuthUserRepository,
  AuthTokenRepository,
  AuthAccountRepository,
  AuthConsentRepository,
];
