import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminPermission } from "./adminPermissions";

export type AdminRole = "owner" | "manager";

export type AdminSession = {
  username: string;
  role: AdminRole;
  role_name?: string;
  permissions?: AdminPermission[];
};

export function readAdminSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem("adminSession");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.username) return null;
    return {
      username: parsed.username,
      role: parsed.role === "manager" ? "manager" : "owner",
      role_name: parsed.role_name,
      permissions: Array.isArray(parsed.permissions) ? parsed.permissions : undefined,
    };
  } catch {
    return null;
  }
}

export async function refreshAdminSession(supabase: SupabaseClient): Promise<AdminSession | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.rpc("current_admin_profile");
  const profile = Array.isArray(data) ? data[0] : data;
  if (!profile?.username) return null;
  const session = { username: profile.username, role: profile.role, role_name: profile.role_name, permissions: profile.permissions } as AdminSession;
  sessionStorage.setItem("adminSession", JSON.stringify(session));
  return session;
}

export const adminRoleSettingKey = (username: string) => `admin_role_${username}`;
