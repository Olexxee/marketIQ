export const getAutoCompletionDays = ({
  envValue = process.env.FULFILLMENT_AUTO_COMPLETION_DAYS,
  configValue = 7,
} = {}) => {
  const candidate = envValue ?? configValue ?? 7;
  const days = Number(candidate);
  return Number.isInteger(days) && days >= 1 && days <= 90 ? days : 7;
};

export const calculateCompletionDueAt = (now = new Date(), days = getAutoCompletionDays()) => {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
};
