type LineTextMessage = {
  type: "text";
  text: string;
};

type LineTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
};

const lineTokenEndpoint = "https://api.line.me/oauth2/v3/token";
const linePushEndpoint = "https://api.line.me/v2/bot/message/push";
const lineReplyEndpoint = "https://api.line.me/v2/bot/message/reply";

export function getLineEnvTargetId() {
  return process.env.LINE_BOOKING_NOTIFY_TO || process.env.LINE_NOTIFY_TARGET_ID || "";
}

export function hasLineTokenConfig() {
  return Boolean(process.env.LINE_MESSAGING_CHANNEL_ID && process.env.LINE_MESSAGING_CHANNEL_SECRET);
}

function getLineMessagingConfig() {
  const channelId = process.env.LINE_MESSAGING_CHANNEL_ID;
  const channelSecret = process.env.LINE_MESSAGING_CHANNEL_SECRET;

  if (!channelId || !channelSecret) {
    throw new Error("LINE Messaging API channel config is not configured");
  }

  return { channelId, channelSecret };
}

export function getLineMessagingChannelSecret() {
  return process.env.LINE_MESSAGING_CHANNEL_SECRET || process.env.LINE_CHANNEL_SECRET || "";
}

export async function getLineStatelessAccessToken() {
  const { channelId, channelSecret } = getLineMessagingConfig();
  const response = await fetch(lineTokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: channelId,
      client_secret: channelSecret,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`LINE token issue failed: ${response.status}${detail ? ` ${detail}` : ""}`);
  }

  const data = (await response.json()) as LineTokenResponse;
  if (!data.access_token) {
    throw new Error("LINE token issue failed: access token missing");
  }

  return data.access_token;
}

export async function pushLineText(to: string, text: string) {
  if (!to) {
    throw new Error("LINE notify target is not configured");
  }
  const token = await getLineStatelessAccessToken();

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

export async function sendLineMessage(userId: string, message: string) {
  return pushLineText(userId, message);
}

export async function replyLineText(replyToken: string, text: string) {
  if (!replyToken) {
    throw new Error("LINE reply token is missing");
  }
  const token = await getLineStatelessAccessToken();

  const response = await fetch(lineReplyEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text } satisfies LineTextMessage],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`LINE reply failed: ${response.status}${detail ? ` ${detail}` : ""}`);
  }
}
