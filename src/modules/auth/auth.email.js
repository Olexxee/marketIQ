import { env } from "../../config/env.js";

export const sendAuthEmail = async ({ to, subject, html, text }) => {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    if (env.NODE_ENV === "production") {
      throw new Error("Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM.");
    }
    console.info("[MarketIQ auth email - development only]", { to, subject, text });
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html, text }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Auth email provider rejected the request", response.status, detail);
    throw new Error("Unable to send account email. Please try again later.");
  }
};

export const buildFrontendUrl = (path, params = {}) => {
  if (!env.FRONTEND_URL) {
    if (env.NODE_ENV === "production") {
      throw new Error("FRONTEND_URL must be configured in production.");
    }
    const url = new URL("http://localhost:5173");
    url.pathname = path;
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url.toString();
  }

  const base = new URL(env.FRONTEND_URL);
  if (env.NODE_ENV === "production" && base.protocol !== "https:") {
    throw new Error("FRONTEND_URL must use HTTPS in production.");
  }
  base.pathname = path.startsWith("/") ? path : `/${path}`;
  base.search = "";
  for (const [key, value] of Object.entries(params)) base.searchParams.set(key, value);
  return base.toString();
};
