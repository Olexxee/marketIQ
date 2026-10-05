import { getEventListeners } from "./event.registry.js";

export const dispatchEvent = async (event) => {
  const listeners = getEventListeners(event.eventType);

  if (listeners.length === 0) {
    return;
  }

  const results = await Promise.allSettled(
    listeners.map((listener) => listener(event)),
  );

  const failures = results.filter((result) => result.status === "rejected");

  if (failures.length > 0) {
    const error = failures[0].reason;

    throw error instanceof Error ? error : new Error(String(error));
  }
};
