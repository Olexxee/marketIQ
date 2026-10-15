import {
  createCommercialActivity,
  findCommercialActivityBySourceEvent,
} from "./commercialActivity.db.js";

const assertValidActivity = (activity) => {
  if (!activity) {
    throw new Error("Commercial activity is required");
  }

  if (!activity.activityType) {
    throw new Error("Commercial activity type is required");
  }

  if (!activity.source?.integrationId) {
    throw new Error("Commercial activity source is required");
  }

  if (!activity.source?.externalEventId) {
    throw new Error("Commercial activity external event ID is required");
  }

  if (!activity.occurredAt) {
    throw new Error("Commercial activity occurredAt is required");
  }
};

export const ingestCommercialActivity = async (activity, tx) => {
  assertValidActivity(activity);

  const sourceId = activity.source.integrationId;
  const externalEventId = activity.source.externalEventId;

  const existing = await findCommercialActivityBySourceEvent(
    {
      sourceId,
      externalEventId,
    },
    tx,
  );

  if (existing) {
    return {
      activity: existing,
      created: false,
    };
  }

  const created = await createCommercialActivity(
    {
      activityType: activity.activityType,

      sourceId,
      externalEventId,

      userId: activity.actor?.userId ?? null,

      productId: activity.entity?.productId ?? null,
      variantId: activity.entity?.variantId ?? null,
      sellerId: activity.entity?.sellerId ?? null,
      categoryId: activity.entity?.categoryId ?? null,
      brandId: activity.entity?.brandId ?? null,
      collectionId: activity.entity?.collectionId ?? null,

      countryId: activity.geography?.countryId ?? null,
      stateId: activity.geography?.stateId ?? null,
      lgaId: activity.geography?.lgaId ?? null,
      cityId: activity.geography?.cityId ?? null,

      quantity: activity.quantity ?? null,

      occurredAt: new Date(activity.occurredAt),

      metadata: activity.metadata ?? null,
    },
    tx,
  );

  return {
    activity: created,
    created: true,
  };
};
