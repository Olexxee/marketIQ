import app from "./app.js";
import { env } from "./config/env.js";
import prisma from "./config/prisma.js";
import { startShipmentAuthorizationWorker } from "./modules/logistics/shipment-authorization.worker.js";

let stopShipmentAuthorizationWorker = () => {};

const startServer = async () => {
  try {
    await prisma.$connect();

    console.log("Database connected");
    stopShipmentAuthorizationWorker = startShipmentAuthorizationWorker();

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
  await prisma.$disconnect();

  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
