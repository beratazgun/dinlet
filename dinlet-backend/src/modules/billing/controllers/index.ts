import { RevenueCatWebhookController } from "./revenuecat-webhook.controller.js";
import { SubscriptionController } from "./subscription.controller.js";

export const BillingControllers = [
  SubscriptionController,
  RevenueCatWebhookController,
];

export { RevenueCatWebhookController, SubscriptionController };
