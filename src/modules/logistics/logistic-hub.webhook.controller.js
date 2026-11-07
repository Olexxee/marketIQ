import { asyncWrapper } from "../../lib/asyncWrapper.js";
import { createLogisticHubWebhookRepository } from "./logistic-hub.webhook.db.js";
import { createLogisticHubWebhookService } from "./logistic-hub.webhook.service.js";
import prisma from "../../config/prisma.js";
import { env } from "../../config/env.js";

const service = createLogisticHubWebhookService({
  repository: createLogisticHubWebhookRepository({ prismaClient: prisma }),
  secret: env.logisticHub.webhookSecret,
  toleranceSeconds: env.logisticHub.webhookToleranceSeconds,
});

export const receiveLogisticHubWebhook = asyncWrapper(async (req, res) => {
  const result = await service.receive({ rawBody: req.body, headers: req.headers });
  return res.status(202).json({ success: true, data: result });
});
