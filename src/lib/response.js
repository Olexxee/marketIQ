// lib/response.js

export const successResponse = ({
  res,
  statusCode = 200,
  message = "Success",
  data = null,
  meta = null,
  context = null,
}) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta !== null && { meta }),
    ...(context !== null && { context }),
  });
};