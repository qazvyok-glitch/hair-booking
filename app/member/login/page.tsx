"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function MemberLogin() {
  const router = useRouter();
  const [mode, setMode] = useState<"select" | "email">("select");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push("/member/setup");
    });
  }, [router]);

  async function handleGoogleLogin() {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/member/setup` },
    });
  }

  async function handleEmailAuth() {
    if (!email || !password) { setError("請填寫Email與密碼"); return; }
    setLoading(true);
    setError("");
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/member/setup` },
      });
      if (error) { setError(error.message); setLoading(false); return; }
      setMessage("驗證信已寄出，請檢查您的信箱！");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError("Email或密碼錯誤"); setLoading(false); return; }
      router.push("/member/setup");
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#1A1A1A", display: "flex", justifyContent: "center", alignItems: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 360, border: "1.5px solid #fff", borderRadius: 20, padding: "36px 24px" }}>

        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <img src="/logo.png" alt="logo" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", display: "block", margin: "0 auto 14px" }} />
          <div style={{ fontSize: 18, fontWeight: 600, color: "#fff" }}>會員登入 / 註冊</div>
          <div style={{ fontSize: 12, color: "#888780", marginTop: 4 }}>登入後即可開始預約</div>
        </div>

        {message ? (
          <div style={{ background: "#1D9E75", color: "#fff", borderRadius: 10, padding: "12px 16px", fontSize: 13, textAlign: "center", marginBottom: 16 }}>
            {message}
          </div>
        ) : mode === "select" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button onClick={handleGoogleLogin} disabled={loading} style={{ width: "100%", padding: "13px 0", background: "#fff", color: "#2C2C2A", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              使用 Google 帳號登入
            </button>

            <button onClick={() => setMode("email")} style={{ width: "100%", padding: "13px 0", background: "transparent", color: "#fff", border: "1.5px solid #fff", borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
              使用 Email 登入 / 註冊
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", marginBottom: 16, background: "#2A2A2A", borderRadius: 10, padding: 4 }}>
              {[{ label: "登入", val: false }, { label: "註冊", val: true }].map((m) => (
                <button key={m.label} onClick={() => setIsSignUp(m.val)} style={{ flex: 1, padding: "8px 0", background: isSignUp === m.val ? "#534AB7" : "transparent", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: isSignUp === m.val ? 600 : 400, cursor: "pointer" }}>
                  {m.label}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 6 }}>Email</div>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" type="email" style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #444", fontSize: 14, outline: "none", background: "#2A2A2A", color: "#fff", boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 6 }}>密碼</div>
              <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少6位數" type="password" onKeyDown={(e) => e.key === "Enter" && handleEmailAuth()} style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #444", fontSize: 14, outline: "none", background: "#2A2A2A", color: "#fff", boxSizing: "border-box" }} />
            </div>

            {error && <div style={{ background: "#3A1A1A", color: "#F09595", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>{error}</div>}

            <button onClick={handleEmailAuth} disabled={loading} style={{ width: "100%", padding: "13px 0", background: loading ? "#444" : "#534AB7", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: loading ? "default" : "pointer", marginBottom: 10 }}>
              {loading ? "處理中..." : isSignUp ? "建立帳號" : "登入"}
            </button>

            <button onClick={() => setMode("select")} style={{ width: "100%", padding: "10px 0", background: "transparent", color: "#888780", border: "none", fontSize: 13, cursor: "pointer" }}>
              ← 返回
            </button>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <a href="/" style={{ fontSize: 12, color: "#555", textDecoration: "none" }}>← 回到首頁</a>
        </div>
      </div>
    </div>
  );
}
