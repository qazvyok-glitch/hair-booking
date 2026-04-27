"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { useBookingStore } from "../../../../store/bookingStore";

type Designer = {
  id: number;
  name: string;
  nickname: string;
  initials: string;
  style: string;
  ig: string;
  bg_color: string;
  text_color: string;
  work_hours: string[];
};

export default function Step1() {
  const router = useRouter();
  const { designer: selected, setDesigner } = useBookingStore();
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("designers")
      .select("*")
      .eq("is_active", true)
      .order("id")
      .then(({ data }) => {
        if (data) setDesigners(data);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
        <div style={{ color: "#534AB7", fontSize: 14 }}>載入中</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px 120px" }}>
      <div style={{ fontSize: 20, fontWeight: 600, color: "#2C2C2A", marginBottom: 4 }}>選擇設計師</div>
      <div style={{ fontSize: 12, color: "#888780", marginBottom: 20 }}>請選擇您想預約的設計師</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {/* 不指定選項 */}
        {(() => {
          const isSelected = selected?.id === 0;
          return (
            <div
              onClick={() => setDesigner({ id: 0, name: "不指定", nickname: "依時間安排", initials: "✦", style: "依照時間由店家安排", ig: "", bg_color: "#F1EFE8", text_color: "#5F5E5A", work_hours: [] })}
              style={{
                background: isSelected ? "#EEEDFE" : "#fff",
                border: "1.5px solid " + (isSelected ? "#534AB7" : "#D3D1C7"),
                borderRadius: 14,
                padding: "16px 12px",
                textAlign: "center",
                cursor: "pointer",
                boxShadow: isSelected ? "0 4px 16px rgba(83,74,183,0.15)" : "none",
                gridColumn: "1 / -1",
              }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                background: "#F1EFE8", color: "#5F5E5A",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, fontWeight: 600, margin: "0 auto 8px",
                border: isSelected ? "2.5px solid #534AB7" : "2px solid #D3D1C7",
              }}>✦</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#2C2C2A" }}>不指定設計師</div>
              <div style={{ fontSize: 11, color: "#888780", margin: "4px 0", lineHeight: 1.5 }}>
                依照我的時間，請店家幫我安排
              </div>
              {isSelected ? (
                <div style={{
                  marginTop: 8, background: "#534AB7", color: "#fff",
                  borderRadius: 20, padding: "3px 12px",
                  fontSize: 11, fontWeight: 600, display: "inline-block",
                }}>
                  已選擇 ✓
                </div>
              ) : null}
            </div>
          );
        })()}

        {designers.map((d) => {
          const isSelected = selected?.id === d.id;
          return (
            <div
              key={d.id}
              onClick={() => setDesigner(d)}
              style={{
                background: isSelected ? "#EEEDFE" : "#fff",
                border: "1.5px solid " + (isSelected ? "#534AB7" : "#D3D1C7"),
                borderRadius: 14,
                padding: "16px 12px",
                textAlign: "center",
                cursor: "pointer",
                boxShadow: isSelected ? "0 4px 16px rgba(83,74,183,0.15)" : "none",
              }}
            >
              <div style={{
                width: 60, height: 60, borderRadius: "50%",
                background: d.bg_color, color: d.text_color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, fontWeight: 600, margin: "0 auto 10px",
                border: isSelected ? "2.5px solid #534AB7" : "2px solid transparent",
              }}>
                {d.initials}
              </div>

              <div style={{ fontSize: 14, fontWeight: 600, color: "#2C2C2A" }}>{d.name}</div>

              {d.nickname ? (
                <div style={{ fontSize: 11, color: "#7B6FD4", margin: "3px 0" }}>{d.nickname}</div>
              ) : null}

              <div style={{ fontSize: 11, color: "#888780", lineHeight: 1.5, margin: "4px 0 8px" }}>
                {d.style}
              </div>

              <a href={"https://www.instagram.com/" + d.ig} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, textDecoration: "none" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="2" width="20" height="20" rx="6" fill="#E1306C" />
                  <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.8" fill="none" />
                  <circle cx="17.5" cy="6.5" r="1.2" fill="white" />
                </svg>
                <span style={{ fontSize: 11, color: "#888780" }}>作品集</span>
              </a>

              {isSelected ? (
                <div style={{
                  marginTop: 8, background: "#534AB7", color: "#fff",
                  borderRadius: 20, padding: "3px 12px",
                  fontSize: 11, fontWeight: 600, display: "inline-block",
                }}>
                  已選擇 ✓
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 390, background: "#fff",
        borderTop: "0.5px solid #D3D1C7", padding: "12px 16px 24px",
      }}>
        <button
          onClick={() => { if (selected) router.push("/booking/step/2"); }}
          disabled={!selected}
          style={{
            width: "100%", padding: "13px 0",
            background: selected ? "#534AB7" : "#D3D1C7",
            color: "#fff", border: "none", borderRadius: 12,
            fontSize: 15, fontWeight: 600,
            cursor: selected ? "pointer" : "default",
          }}
        >
          {selected ? "下一步：選擇服務" : "請先選擇設計師"}
        </button>
      </div>
    </div>
  );
}