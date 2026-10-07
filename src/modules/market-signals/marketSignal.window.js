export const getLastDaysWindow = (
  days = 7,
  { endDate = new Date(), alignToDayBoundary = false } = {},
) => {
  const windowEnd = new Date(endDate);

  if (alignToDayBoundary) {
    windowEnd.setUTCHours(0, 0, 0, 0);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 1);
  }

  const windowStart = new Date(windowEnd);
  windowStart.setUTCDate(windowStart.getUTCDate() - days);

  return { windowStart, windowEnd };
};
