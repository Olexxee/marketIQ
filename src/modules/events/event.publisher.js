import { BadRequestError } from "../classes/errorClasses.js";
import { createOutboxEvent } from "./event.db.js";

export const publishEvent = async (
  { eventType, aggregateType, aggregateId, payload = {} },
  tx,
) => {
  if (!eventType) {
    throw new BadRequestError("Event type is required");
  }

  if (!aggregateType) {
    throw new BadRequestError("Event aggregate type is required");
  }

  if (!aggregateId) {
    throw new BadRequestError("Event aggregate ID is required");
  }

  return createOutboxEvent(
    {
      eventType,
      aggregateType,
      aggregateId,
      payload,
    },
    tx,
  );
};
