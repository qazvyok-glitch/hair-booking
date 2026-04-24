"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

type ShopInfo = { key: string; label: string; value: string };

export default function About() {
  const [info, setInfo] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInfo() {
      const { data } = await supabase
        .from("shop_info")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((item: ShopInfo) => { map[item.key] = item.value; });
        setInfo(map);
      }
      setLoading(false);
    }
    fetchInfo();
  }, []);

  const notices = ["notice_1", "notice_2", "notice_3", "notice_4", "notice_5", "notice_6"]
    .map(k => info[k]).filter(Boolean);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#534AB7", fontSize: 14 }}>載入中...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", justifyContent: "center", padding: "24px 16px 100px" }}>
      <div style={{ width: "100%", maxWidth: 390 }}>

        <div style={{ background: "#fff", borderRadius: "16px 16px 0 0", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "0.5px solid #D3D1C7" }}>
          <a href="/" style={{ fontSize: 18, color: "#534AB7", textDecoration: "none" }}>‹</a>
          <span style={{ fontSize: 16, fontWeight: 500, color: "#2C2C2A" }}>關於我們</span>
        </div>

        <div style={{ background: "#fff", padding: "28px 16px 20px", textAlign: "center", borderBottom: "0.5px solid #D3D1C7" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#EEEDFE", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 32 }}>🍒</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#2C2C2A", marginBottom: 4 }}>{info.name || "Bing Cherry Hair Salon"}</div>
          {info.website && (
            <a href={info.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#7B6FD4", textDecoration: "none" }}>
              {info.website.replace("https://", "").replace(/\/$/, "")} ↗
            </a>
          )}
        </div>

        <div style={{ background: "#fff", marginTop: 8, borderRadius: 12, overflow: "hidden" }}>

          {info.address && (
            <a href={info.maps_url || "#"} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderBottom: "0.5px solid #F1EFE8" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#E1F5EE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📍</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "#888780", marginBottom: 2 }}>地址</div>
                  <div style={{ fontSize: 13, color: "#2C2C2A", fontWeight: 500 }}>{info.address}</div>
                  <div style={{ fontSize: 11, color: "#7B6FD4", marginTop: 2 }}>點此開啟 Google Maps ↗</div>
                </div>
              </div>
            </a>
          )}

          {info.phone && (
            <a href={"tel:" + info.phone.replace(/-/g, "")} style={{ textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderBottom: "0.5px solid #F1EFE8" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EEEDFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📞</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "#888780", marginBottom: 2 }}>電話</div>
                  <div style={{ fontSize: 13, color: "#2C2C2A", fontWeight: 500 }}>{info.phone}</div>
                  <div style={{ fontSize: 11, color: "#7B6FD4", marginTop: 2 }}>點此撥打電話 ↗</div>
                </div>
              </div>
            </a>
          )}

          {(info.hours_weekday || info.hours_closed) && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px", borderBottom: "0.5px solid #F1EFE8" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#FAEEDA", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🕐</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "#888780", marginBottom: 6 }}>營業時間</div>
                {info.hours_weekday && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: "#5F5E5A" }}>週二 ─ 週日</span>
                    <span style={{ fontSize: 12, color: "#2C2C2A" }}>{info.hours_weekday}</span>
                  </div>
                )}
                {info.hours_closed && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: "#5F5E5A" }}>{info.hours_closed}</span>
                    <span style={{ fontSize: 12, color: "#E24B4A", fontWeight: 500 }}>公休</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {info.ig && (
            <a href={"https://www.instagram.com/" + info.ig} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderBottom: "0.5px solid #F1EFE8" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#FCF0F8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📸</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "#888780", marginBottom: 2 }}>Instagram</div>
                  <div style={{ fontSize: 13, color: "#2C2C2A", fontWeight: 500 }}>@{info.ig}</div>
                  <div style={{ fontSize: 11, color: "#7B6FD4", marginTop: 2 }}>點此前往 IG ↗</div>
                </div>
              </div>
            </a>
          )}

          {info.website && (
            <a href={info.website} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#E6F1FB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🌐</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "#888780", marginBottom: 2 }}>官方網站</div>
                  <div style={{ fontSize: 13, color: "#2C2C2A", fontWeight: 500 }}>{info.website.replace("https://", "").replace(/\/$/, "")}</div>
                  <div style={{ fontSize: 11, color: "#7B6FD4", marginTop: 2 }}>點此前往官網 ↗</div>
                </div>
              </div>
            </a>
          )}
        </div>

        {notices.length > 0 && (
          <div style={{ background: "#fff", marginTop: 8, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#2C2C2A", marginBottom: 10 }}>預約注意事項</div>
            {notices.map((note, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                <span style={{ color: "#534AB7", fontWeight: 500, flexShrink: 0, fontSize: 12 }}>·</span>
                <span style={{ fontSize: 12, color: "#5F5E5A", lineHeight: 1.6 }}>{note}</span>
              </div>
            ))}
          </div>
        )}

        {/* 底部導覽列 */}
        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 390, background: "#fff", borderTop: "0.5px solid #D3D1C7", display: "flex", zIndex: 50 }}>
          <a href="/" style={{ flex: 1, padding: "10px 0", textAlign: "center", textDecoration: "none" }}>
            <div style={{ fontSize: 20 }}>✂</div>
            <div style={{ fontSize: 10, color: "#5F5E5A", marginTop: 2 }}>預約</div>
          </a>
          <a href="/about" style={{ flex: 1, padding: "10px 0", textAlign: "center", textDecoration: "none" }}>
            <div style={{ fontSize: 20 }}>🍒</div>
            <div style={{ fontSize: 10, color: "#534AB7", marginTop: 2 }}>關於我們</div>
          </a>
        </div>

      </div>
    </div>
  );
}