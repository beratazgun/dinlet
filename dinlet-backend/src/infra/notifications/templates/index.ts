import type { ComponentType } from "react";

import AccountDeletionEmail from "#/infra/notifications/templates/account-deletion-email.js";
import AccountLockedEmail from "#/infra/notifications/templates/account-locked.template.js";
import EmailUpdatedVerification from "#/infra/notifications/templates/email-updated-verification.js";
import NewDeviceLoginEmail from "#/infra/notifications/templates/new-device-login.template.js";
import OpsAlertEmail from "#/infra/notifications/templates/ops-alert.template.js";
import PasswordChangedEmail from "#/infra/notifications/templates/password-changed.template.js";
import PasswordResetEmail from "#/infra/notifications/templates/password-reset-email.js";
import VerificationEmail from "#/infra/notifications/templates/verification-email.template.js";
import WelcomeEmail from "#/infra/notifications/templates/welcome.js";

export type EmailTemplate = ComponentType<Record<string, unknown>>;

const templates: Record<string, EmailTemplate> = {
  "account-deletion-email": AccountDeletionEmail as unknown as EmailTemplate,
  "account-locked.template": AccountLockedEmail as unknown as EmailTemplate,
  "email-updated-verification":
    EmailUpdatedVerification as unknown as EmailTemplate,
  "new-device-login.template": NewDeviceLoginEmail as unknown as EmailTemplate,
  "ops-alert.template": OpsAlertEmail as unknown as EmailTemplate,
  "password-changed.template": PasswordChangedEmail as unknown as EmailTemplate,
  "password-reset-email": PasswordResetEmail as unknown as EmailTemplate,
  "verification-email.template": VerificationEmail as unknown as EmailTemplate,
  welcome: WelcomeEmail as unknown as EmailTemplate,
};

export function getEmailTemplate(name: string): EmailTemplate | undefined {
  return templates[name.replace(/\.tsx$/, "")];
}
