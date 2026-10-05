const listeners = new Map();

export const registerEventListener = (eventType, listener) => {
  if (!eventType) {
    throw new Error("Event type is required to register a listener");
  }

  if (typeof listener !== "function") {
    throw new Error(`Listener for "${eventType}" must be a function`);
  }

  const existing = listeners.get(eventType) ?? [];

  existing.push(listener);

  listeners.set(eventType, existing);
};

export const getEventListeners = (eventType) => {
  return listeners.get(eventType) ?? [];
};
