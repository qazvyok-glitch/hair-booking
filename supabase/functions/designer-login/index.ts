import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  const allowed = origin === "https://bingcherryhair.com" || origin.startsWith("http://localhost:") || /^https:\/\/hair-booking-[a-z0-9-]+\.vercel\.app$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://bingcherryhair.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

async function hashUsername(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.toLowerCase()));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  const headers = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "操作失敗" }), { status: 405, headers });

  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 4096) throw new Error("invalid");
    const body = await request.json();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    if (!username || !password || username.length > 80 || password.length > 200) throw new Error("invalid");

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!);
    const email = `designer-${await hashUsername(username)}@bingcherry.invalid`;

    const signedIn = await authClient.auth.signInWithPassword({ email, password });
    if (!signedIn.error && signedIn.data.user) {
      const { data: activeProfile } = await service
        .from("designer_auth")
        .select("designer_id, designers!inner(is_active,status)")
        .eq("user_id", signedIn.data.user.id)
        .eq("designers.is_active", true)
        .eq("designers.status", "active")
        .maybeSingle();
      if (!activeProfile) throw new Error("inactive");
      return new Response(JSON.stringify({ email }), { headers });
    }

    const { data: legacy } = await service
      .from("designer_auth")
      .select("id, designer_id, username, designers!inner(is_active,status)")
      .eq("username", username)
      .eq("password_hash", password)
      .eq("designers.is_active", true)
      .eq("designers.status", "active")
      .maybeSingle();
    if (!legacy) throw new Error("invalid");

    const created = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { app_role: "designer", designer_id: legacy.designer_id },
    });
    if (created.error || !created.data.user) throw created.error || new Error("create failed");

    const saved = await service
      .from("designer_auth")
      .update({ user_id: created.data.user.id, password_hash: crypto.randomUUID() })
      .eq("id", legacy.id);
    if (saved.error) {
      await service.auth.admin.deleteUser(created.data.user.id);
      throw saved.error;
    }

    return new Response(JSON.stringify({ email }), { headers });
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 350));
    return new Response(JSON.stringify({ error: "帳號或密碼錯誤" }), { status: 401, headers });
  }
});
