import { EVENT_TYPES } from "./event.types.js";
import { registerEventListener } from "./event.registry.js";
import { handleOrderCreated } from "../modules/market-activity/marketActivity.listeners.js";

export const registerEventListeners = () => {
  registerEventListener(EVENT_TYPES.ORDER_CREATED, handleOrderCreated);
};
