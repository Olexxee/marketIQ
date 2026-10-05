const RETRY_DELAYS = [5_000, 15_000, 60_000, 300_000, 900_000];

export const getRetryDelay = (attempts) => {
  const index = Math.min(Math.max(attempts - 1, 0), RETRY_DELAYS.length - 1);

  return RETRY_DELAYS[index];
};

export const getRetryDate = (attempts) => {
  return new Date(Date.now() + getRetryDelay(attempts));
};
