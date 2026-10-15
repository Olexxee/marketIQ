import { mapMarketIqEventToCommercialActivity } from "./marketIqActivity.adapter.js";
import { ingestCommercialActivity } from "../commercial/activity/commercialActivity.service.js";

export const handleMarketIqCommercialActivity = async (event) => {
  const activity = mapMarketIqEventToCommercialActivity(event);

  return ingestCommercialActivity(activity);
};
