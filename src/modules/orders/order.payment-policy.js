export const getPaymentExpiryMinutes = (envValue = process.env.ORDER_PAYMENT_EXPIRY_MINUTES) => {
  const minutes = Number(envValue ?? 30);
  return Number.isInteger(minutes) && minutes >= 5 && minutes <= 120 ? minutes : 30;
};

export const calculatePaymentExpiresAt = (now = new Date(), minutes = getPaymentExpiryMinutes()) => {
  return new Date(now.getTime() + minutes * 60 * 1000);
};
