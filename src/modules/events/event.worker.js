import {
  findPendingOutboxEvents,
  markEventCompleted,
  markEventFailed,
  markEventProcessing,
  recoverStaleProcessingEvents,
} from "./event.db.js";
import { dispatchEvent } from "./event.dispatcher.js";
import { getRetryDate } from "./event.retry.js";

const BATCH_SIZE = 25;

const processEvent = async (event) => {
  const claimed = await markEventProcessing(event.id);

  if (claimed.count !== 1) {
    return;
  }

  try {
    await dispatchEvent(event);

    await markEventCompleted(event.id);
  } catch (error) {
    const retryAt = getRetryDate(event.attempts + 1);

    await markEventFailed(event.id, error, retryAt, event.attempts + 1 >= 10);
  }
};

export const processOutboxEvents = async () => {
  await recoverStaleProcessingEvents();
  const events = await findPendingOutboxEvents(BATCH_SIZE);

  for (const event of events) {
    await processEvent(event);
  }
};
