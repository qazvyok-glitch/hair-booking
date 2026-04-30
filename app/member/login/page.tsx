"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function MemberLogin() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push("/member/profile");
    });
  }, [router]);

  async function handleGoogleLogin() {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/member/profile`,
      },
    });
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", justifyContent: "center", alignItems: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src="/logo.png" alt="logo" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", marginBottom: 14, display: "block", margin: "0 auto 14px" }} />
          <div style={{ fontSize: 20, fontWeight: 600, color: "#2C2C2A", marginBottom: 4 }}>會員登入</div>
          <div style={{ fontSize: 12, color: "#888780" }}>登入後可查看預約紀錄與個人資料</div>
        </div>

        <div style={{ background: "#fff", borderRadius: 16, padding: "24px 20px", border: "0.5px solid #D3D1C7" }}>
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{ width: "100%", padding: "13px 0", background: loading ? "#D3D1C7" : "#fff", color: "#2C2C2A", border: "1.5px solid #D3D1C7", borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: loading ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? "登入中..." : "使用 Google 帳號登入"}
          </button>

          <div style={{ textAlign: "center", fontSize: 11, color: "#888780", marginTop: 16, lineHeight: 1.6 }}>
            登入即代表您同意我們的服務條款<br/>您的資料僅用於預約管理
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <a href="/" style={{ fontSize: 12, color: "#534AB7", textDecoration: "none" }}>← 回到預約頁面</a>
        </div>
      </div>
    </div>
  );
}
