import { registerEventListeners } from "./registerListeners.js";
import { processOutboxEvents } from "./event.worker.js";

registerEventListeners();

const POLL_INTERVAL = 2_000;

let running = false;

const run = async () => {
  if (running) {
    return;
  }

  running = true;

  try {
    await processOutboxEvents();
  } catch (error) {
    console.error("[EVENT WORKER] Processing failed:", error);
  } finally {
    running = false;
  }
};

await run();

setInterval(run, POLL_INTERVAL);
