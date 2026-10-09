import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FastifyAdapter } from "@bull-board/fastify";
import { getQueueToken } from "@nestjs/bullmq";
import type { INestApplicationContext } from "@nestjs/common";
import type { Queue } from "bullmq";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { QueueName } from "#/infra/queue/queue.constants.js";
import { getSessionUser } from "#/infra/session/index.js";

export const QUEUE_BOARD_PATH = "/admin/queues";
const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"]);

/**
 * Bull Board kuyruk paneli (doküman §11 "İzleme"). Yalnızca admin rolündeki
 * oturumlara açıktır; diğer istekler 404 görür (panelin varlığı sızmaz).
 * Oturum, uygulamanın normal oturum zinciriyle (cookie veya Bearer) okunur.
 */
export async function registerQueueBoard(
  app: INestApplicationContext,
  fastify: FastifyInstance,
): Promise<void> {
  const serverAdapter = new FastifyAdapter();
  serverAdapter.setBasePath(QUEUE_BOARD_PATH);
  createBullBoard({
    queues: Object.values(QueueName).map(
      (name) =>
        new BullMQAdapter(app.get<Queue>(getQueueToken(name), { strict: false })),
    ),
    serverAdapter,
  });

  await fastify.register(async (scope) => {
    scope.addHook(
      "onRequest",
      async (request: FastifyRequest, reply: FastifyReply) => {
        const user = getSessionUser(request);
        if (!user || !ADMIN_ROLES.has(user.role.code)) {
          await reply.code(404).send({ message: "Bulunamadı" });
        }
      },
    );
    await scope.register(serverAdapter.registerPlugin(), {
      prefix: QUEUE_BOARD_PATH,
    });
  });
}
