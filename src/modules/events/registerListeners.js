import { registerEventListener } from "./event.registry.js";
import { marketActivityListeners } from "../market-activity/marketActivity.listener-map.js";
import { handleMarketActivityEvent } from "../market-activity/marketActivity.listeners.js";

export const registerEventListeners = () => {
  for (const eventType of marketActivityListeners) {
    registerEventListener(eventType, handleMarketActivityEvent);
  }
};
