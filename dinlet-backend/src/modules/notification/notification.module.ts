import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { DateManager } from "#/core/utils/date-manager.js";
import { Paginator } from "#/core/utils/paginator.js";
import { QueueName } from "#/infra/queue/queue.constants.js";
import { NotificationControllers } from "#/modules/notification/controllers/index.js";
import { DocumentNotificationEventHandler } from "#/modules/notification/event/document-notification.event-handler.js";
import { NotificationEventHandler } from "#/modules/notification/event/notification.event-handler.js";
import { StoreNotificationEventHandler } from "#/modules/notification/event/store-notification.event-handler.js";
import { NotificationGateway } from "#/modules/notification/gateways/index.js";
import {
  PushProcessor,
  PushQueueService,
} from "#/modules/notification/queue/index.js";
import { NotificationRepositories } from "#/modules/notification/repository/index.js";
import { NotificationServices } from "#/modules/notification/services/index.js";

const NotificationProviders = [
  DateManager,
  Paginator,
  NotificationGateway,
  NotificationEventHandler,
  DocumentNotificationEventHandler,
  StoreNotificationEventHandler,
  PushQueueService,
  PushProcessor,
];

@Module({
  imports: [BullModule.registerQueue({ name: QueueName.PUSH })],
  controllers: [...NotificationControllers],
  providers: [
    ...NotificationRepositories,
    ...NotificationServices,
    ...NotificationProviders,
  ],
})
export class NotificationModule {}
