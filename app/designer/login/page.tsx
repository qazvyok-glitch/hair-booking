"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function DesignerLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!username || !password) { setError("請填寫帳號與密碼"); return; }
    setLoading(true);
    setError("");
    const { data, error: dbError } = await supabase
      .from("designer_auth")
      .select("*, designers(*)")
      .eq("username", username)
      .eq("password_hash", password)
      .single();
    if (dbError || !data) {
      setError("帳號或密碼錯誤");
      setLoading(false);
      return;
    }
    sessionStorage.setItem("designerSession", JSON.stringify({
      id: data.designer_id,
      name: data.designers.name,
      nickname: data.designers.nickname,
    }));
    router.push("/designer/dashboard");
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#1A1A1A",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: "24px 16px",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 360,
        border: "1.5px solid #fff",
        borderRadius: 20,
        padding: "36px 24px",
        background: "#fff",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <img
            src="/logo.png"
            alt="logo"
            style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", marginBottom: 14, display: "block", margin: "0 auto 14px" }}
          />
          <div style={{ fontSize: 18, fontWeight: 600, color: "#2C2C2A" }}>設計師登入</div>
          <div style={{ fontSize: 12, color: "#888780", marginTop: 4 }}>Bing Cherry Hair Salon</div>
        </div>

        {/* 帳號 */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#888780", marginBottom: 6 }}>帳號</div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="輸入帳號"
            style={{
              width: "100%", padding: "11px 14px", borderRadius: 10,
              border: "1px solid #D3D1C7", fontSize: 14, outline: "none",
              background: "#fff", color: "#2C2C2A", boxSizing: "border-box",
            }}
          />
        </div>

        {/* 密碼 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: "#888780", marginBottom: 6 }}>密碼</div>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="輸入密碼"
            type="password"
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            style={{
              width: "100%", padding: "11px 14px", borderRadius: 10,
              border: "1px solid #D3D1C7", fontSize: 14, outline: "none",
              background: "#fff", color: "#2C2C2A", boxSizing: "border-box",
            }}
          />
        </div>

        {/* 錯誤訊息 */}
        {error && (
          <div style={{
            background: "#3A1A1A", color: "#F09595",
            borderRadius: 8, padding: "8px 12px",
            fontSize: 12, marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {/* 登入按鈕 */}
        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: "100%", padding: "13px 0",
            background: loading ? "#444" : "#534AB7",
            color: "#fff", border: "none", borderRadius: 12,
            fontSize: 15, fontWeight: 600,
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "登入中..." : "登入"}
        </button>
      </div>
    </div>
  );
}
