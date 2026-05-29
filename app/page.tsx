"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [announcements, setAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("announcements").select("*").eq("is_active", true).in("target", ["all", "customer"]).order("created_at", { ascending: false }).limit(3).then(({ data }: any) => {
      if (data) setAnnouncements(data);
    });
  }, []);
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUser(session.user);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#1A1A1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#fff", fontSize: 14 }}>載入中...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#1A1A1A", display: "flex", justifyContent: "center", alignItems: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 390, display: "flex", flexDirection: "column", alignItems: "center", border: "1.5px solid #fff", borderRadius: 24, padding: "40px 24px" }}>

        {/* LOGO */}
        <img src="/logo.png" alt="logo" style={{ width: 100, height: 100, borderRadius: "50%", objectFit: "cover", marginBottom: 20, border: "2px solid #fff" }} />

        {/* 店名 */}
        <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 6, textAlign: "center" }}>Bing Cherry Hair Salon</div>
        <div style={{ fontSize: 13, color: "#888780", marginBottom: 40, textAlign: "center" }}>台南市中西區西門路二段10號</div>

        {/* 按鈕區 */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* 公告 */}
          {announcements.length > 0 && (
            <div style={{ width: "100%", marginBottom: 16 }}>
              {announcements.map((a: any) => (
                <div key={a.id} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px 14px", marginBottom: 8, borderLeft: "3px solid #C8C4F8", textAlign: "left" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#C8C4F8" }}>📢 {a.title}</div>
                  {a.content && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 3, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{a.content}</div>}
                </div>
              ))}
            </div>
          )}

          {/* 立即預約 */}
          <button
            onClick={() => {
              if (user) {
                router.push("/booking/step/1");
              } else {
                router.push("/member/login");
              }
            }}
            style={{ width: "100%", padding: "16px 0", background: "transparent", color: "#fff", border: "1.5px solid #fff", borderRadius: 14, fontSize: 18, fontWeight: 600, cursor: "pointer", letterSpacing: "0.05em" }}
          >
            立即預約
          </button>

          {user ? (
            <button
              onClick={() => router.push("/member/profile")}
              style={{ width: "100%", padding: "16px 0", background: "transparent", color: "#fff", border: "1.5px solid #fff", borderRadius: 14, fontSize: 18, fontWeight: 600, cursor: "pointer", letterSpacing: "0.05em" }}
            >
              {user.user_metadata?.full_name || "會員中心"}
            </button>
          ) : (
            <button
              onClick={() => router.push("/member/login")}
              style={{ width: "100%", padding: "16px 0", background: "transparent", color: "#fff", border: "1.5px solid #fff", borderRadius: 14, fontSize: 18, fontWeight: 600, cursor: "pointer", letterSpacing: "0.05em" }}
            >
              會員登入
            </button>
          )}

          <button
            onClick={() => router.push("/about")}
            style={{ width: "100%", padding: "16px 0", background: "transparent", color: "#fff", border: "1.5px solid #fff", borderRadius: 14, fontSize: 18, fontWeight: 600, cursor: "pointer", letterSpacing: "0.05em" }}
          >
            關於我們
          </button>
        </div>

        <div style={{ marginTop: 32, fontSize: 11, color: "#555", textAlign: "center" }}>
          © 2024 Bing Cherry Hair Salon
        </div>
      </div>
    </div>
  );
}
