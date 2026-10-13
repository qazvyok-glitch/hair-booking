type SupabaseIdentity = {
  provider?: string;
  provider_id?: string | null;
  identity_data?: Record<string, unknown> | null;
};

type SupabaseAuthUser = {
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
  identities?: SupabaseIdentity[] | null;
};

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function isLineProvider(provider: unknown) {
  return provider === "line" || provider === "custom:line" || provider === "custom:line-oauth";
}

export function getLineUserIdFromAuthUser(user?: SupabaseAuthUser | null) {
  if (!user) return "";

  const lineIdentity = user.identities?.find((identity) => isLineProvider(identity.provider));
  if (lineIdentity) {
    const identityData = lineIdentity.identity_data || {};
    return (
      stringValue(identityData.sub) ||
      stringValue(identityData.user_id) ||
      stringValue(lineIdentity.provider_id)
    );
  }

  if (isLineProvider(user.app_metadata?.provider) || isLineProvider(user.user_metadata?.provider)) {
    return (
      stringValue(user.user_metadata?.sub) ||
      stringValue(user.user_metadata?.user_id) ||
      stringValue(user.user_metadata?.provider_id)
    );
  }

  return "";
}
