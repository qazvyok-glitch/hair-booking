"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("登入確認中...");

  useEffect(() => {
    async function completeLogin() {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const next = params.get("next") || "/member/setup";
      const error = params.get("error") || params.get("error_code") || hashParams.get("error");
      const errorDescription = params.get("error_description") || hashParams.get("error_description");

      if (error) {
        setMessage(errorDescription || "LINE 登入失敗，請重新登入。");
        setTimeout(() => router.replace("/member/login"), 1500);
        return;
      }

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          router.replace(next);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      setMessage("登入資訊尚未建立，請重新登入。");
      setTimeout(() => router.replace("/member/login"), 1800);
    }

    completeLogin();
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", background: "#1A1A1A", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>{message}</div>
    </div>
  );
}
