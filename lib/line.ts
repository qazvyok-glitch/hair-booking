type LineTextMessage = {
  type: "text";
  text: string;
};

const linePushEndpoint = "https://api.line.me/v2/bot/message/push";

export function getLineBookingTargetId() {
  return process.env.LINE_BOOKING_NOTIFY_TO || process.env.LINE_NOTIFY_TARGET_ID || "";
}

export function hasLinePushConfig() {
  return Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && getLineBookingTargetId());
}

export async function pushLineText(to: string, text: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
  }
  if (!to) {
    throw new Error("LINE notify target is not configured");
  }

  const response = await fetch(linePushEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to,
      messages: [{ type: "text", text } satisfies LineTextMessage],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`LINE push failed: ${response.status}${detail ? ` ${detail}` : ""}`);
  }
}

