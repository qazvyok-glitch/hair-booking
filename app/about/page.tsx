"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function About() {
  const router = useRouter();
  const [info, setInfo] = useState<Record<string, string>>({});
  const [notices, setNotices] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from("shop_info")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }: { data: { key: string; value: string }[] | null }) => {
        if (!data) return;
        const map: Record<string, string> = {};
        const ns: string[] = [];
        data.forEach((row) => {
          map[row.key] = row.value;
          if (row.key.startsWith("notice_")) ns.push(row.value);
        });
        setInfo(map);
        setNotices(ns);
      });
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 390, background: "#fff", minHeight: "100vh", paddingBottom: 80 }}>

        {/* 深色頂部 Hero */}
        <div style={{ background: "#1A1A1A", padding: "0 0 32px", position: "relative" }}>
          {/* 返回按鈕 */}
          <div style={{ padding: "14px 16px", display: "flex", alignItems: "center" }}>
            <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer", color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
          </div>

          {/* Logo + 名稱 */}
          <div style={{ textAlign: "center", padding: "0 20px" }}>
            <div style={{ width: 88, height: 88, borderRadius: "50%", overflow: "hidden", margin: "0 auto 16px", border: "2px solid rgba(255,255,255,0.15)" }}>
              <img src="/logo.png" alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: "0.02em" }}>
              {info.name || "Bing Cherry Hair Salon"}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4, letterSpacing: "0.14em" }}>
              HAIR SALON · 台南
            </div>

            {/* 社群連結 */}
            <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 20 }}>
              {info.ig ? (
                <a href={"https://www.instagram.com/" + info.ig} target="_blank" rel="noopener noreferrer" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, textDecoration: "none" }}>
                  <div style={{ width: 46, height: 46, borderRadius: 14, background: "linear-gradient(135deg, #f09433, #dc2743, #bc1888)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <rect x="2" y="2" width="20" height="20" rx="6" fill="rgba(255,255,255,0.15)" />
                      <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.8" fill="none" />
                      <circle cx="17.5" cy="6.5" r="1.2" fill="white" />
                    </svg>
                  </div>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>Instagram</span>
                </a>
              ) : null}
              {info.facebook ? (
                <a href={info.facebook} target="_blank" rel="noopener noreferrer" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, textDecoration: "none" }}>
                  <div style={{ width: 46, height: 46, borderRadius: 14, background: "#1877F2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: "white", fontSize: 24, fontWeight: 700, lineHeight: 1 }}>f</span>
                  </div>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>Facebook</span>
                </a>
              ) : null}
              {info.website ? (
                <a href={info.website} target="_blank" rel="noopener noreferrer" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, textDecoration: "none" }}>
                  <div style={{ width: 46, height: 46, borderRadius: 14, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 20 }}>🌐</span>
                  </div>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>官網</span>
                </a>
              ) : null}
            </div>
          </div>
        </div>

        {/* 內容區 */}
        <div style={{ padding: "20px 16px" }}>

          {/* 地址 */}
          {info.address ? (
            <div style={{ background: "#F8F7F3", borderRadius: 16, padding: "16px", marginBottom: 10, display: "flex", gap: 14, alignItems: "flex-start", border: "1px solid #EDEBE4" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "#FFE8E0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 20 }}>📍</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "#888780", marginBottom: 4, letterSpacing: "0.08em", fontWeight: 600 }}>地址</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#2C2C2A", lineHeight: 1.5 }}>{info.address}</div>
                <a href={info.maps_url || "https://maps.google.com/?q=" + encodeURIComponent(info.address)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#534AB7", textDecoration: "none", marginTop: 6, display: "inline-flex", alignItems: "center", gap: 3 }}>
                  點此開啟 Google Maps ↗
                </a>
              </div>
            </div>
          ) : null}

          {/* 電話 */}
          {info.phone ? (
            <div style={{ background: "#F8F7F3", borderRadius: 16, padding: "16px", marginBottom: 20, display: "flex", gap: 14, alignItems: "flex-start", border: "1px solid #EDEBE4" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "#E8E0FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 20 }}>📞</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "#888780", marginBottom: 4, letterSpacing: "0.08em", fontWeight: 600 }}>電話</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#2C2C2A" }}>{info.phone}</div>
                <a href={"tel:" + info.phone.replace(/-/g, "")} style={{ fontSize: 12, color: "#534AB7", textDecoration: "none", marginTop: 6, display: "inline-flex", alignItems: "center", gap: 3 }}>
                  點此撥打電話 ↗
                </a>
              </div>
            </div>
          ) : null}

          {/* 分隔線 */}
          {notices.length > 0 ? (
            <div style={{ borderTop: "1px solid #F0EEE8", marginBottom: 20 }} />
          ) : null}

          {/* 預約注意事項 */}
          {notices.length > 0 ? (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#888780", letterSpacing: "0.1em", marginBottom: 14, textTransform: "uppercase" }}>預約注意事項</div>
              {notices.map((note, i) => (
                <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start", background: "#F8F7F3", borderRadius: 12, padding: "12px 14px", border: "1px solid #EDEBE4" }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#534AB7", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    {i + 1}
                  </div>
                  <div style={{ fontSize: 13, color: "#5F5E5A", lineHeight: 1.7 }}>{note}</div>
                </div>
              ))}
            </div>
          ) : null}

        </div>

        {/* 底部導覽列 */}
        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 390, background: "#fff", borderTop: "0.5px solid #D3D1C7", display: "flex", zIndex: 50 }}>
          <a href="/" style={{ flex: 1, padding: "8px 0", textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
            <div style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 24 }}>🏠</span>
            </div>
            <span style={{ fontSize: 12, color: "#1500ff" }}>首頁</span>
          </a>
          <a href="/booking/step/1" style={{ flex: 1, padding: "8px 0", textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
            <div style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="18" rx="2" fill="#ffffff" stroke="#000000" strokeWidth="1.8"/>
                <path d="M16 2v4M8 2v4M3 10h18" stroke="#000000" strokeWidth="1.8" strokeLinecap="round"/>
                <circle cx="8" cy="14" r="1.2" fill="#000000"/>
                <circle cx="12" cy="14" r="1.2" fill="#000000"/>
                <circle cx="16" cy="14" r="1.2" fill="#000000"/>
                <circle cx="8" cy="18" r="1.2" fill="#000000"/>
                <circle cx="12" cy="18" r="1.2" fill="#000000"/>
              </svg>
            </div>
            <span style={{ fontSize: 12, color: "#1500ff" }}>預約</span>
          </a>
          <a href="/member/login" style={{ flex: 1, padding: "8px 0", textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
            <div style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="11" fill="#ffffff" stroke="#000000" strokeWidth="1.5"/>
                <circle cx="12" cy="9" r="3.5" fill="#000000"/>
                <path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" fill="#000000"/>
              </svg>
            </div>
            <span style={{ fontSize: 12, color: "#1500ff" }}>會員</span>
          </a>
          <a href="/about" style={{ flex: 1, padding: "8px 0", textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
              <img src="/logo.png" alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <span style={{ fontSize: 12, color: "#1500ff" }}>關於我們</span>
          </a>
        </div>

      </div>
    </div>
  );
}