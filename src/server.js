import app from "./app.js";
import { env } from "./config/env.js";
import prisma from "./config/prisma.js";
import { startShipmentAuthorizationWorker } from "./modules/logistics/shipment-authorization.worker.js";
import { startShipmentReviewWorker } from "./modules/logistics/shipment-review.worker.js";
import { startShipmentResolutionWorker } from "./modules/logistics/shipment-resolution.worker.js";

let stopShipmentAuthorizationWorker = () => {};
let stopShipmentReviewWorker = () => {};
let stopShipmentResolutionWorker = () => {};

const startServer = async () => {
  try {
    await prisma.$connect();

    console.log("Database connected");
    stopShipmentAuthorizationWorker = startShipmentAuthorizationWorker();
    stopShipmentReviewWorker = startShipmentReviewWorker();
    stopShipmentResolutionWorker = startShipmentResolutionWorker();

    app.listen(env.PORT, () => {
      console.log(`MarketIQ API running on port ${env.PORT}`);
      console.log(`Environment: ${env.NODE_ENV}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);

    await prisma.$disconnect();

    process.exit(1);
  }
};

startServer();

const shutdown = async (signal) => {
  console.log(`${signal} received. Shutting down...`);

  await stopShipmentAuthorizationWorker();
  await stopShipmentReviewWorker();
  await stopShipmentResolutionWorker();
  await prisma.$disconnect();

  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
