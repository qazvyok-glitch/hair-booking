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
              }}
            >
              <div style={{
                width: 60, height: 60, borderRadius: "50%",
                background: d.bg_color, color: d.text_color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, fontWeight: 600, margin: "0 auto 10px",
              }}>
                {d.initials}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#2C2C2A" }}>{d.name}</div>
              {d.nickname ? (
                <div style={{ fontSize: 11, color: "#7B6FD4", margin: "3px 0" }}>{d.nickname}</div>
              ) : null}
              <div style={{ fontSize: 11, color: "#888780", margin: "4px 0 8px" }}>{d.style}</div>
              {isSelected ? (
                <div style={{
                  marginTop: 8, background: "#534AB7", color: "#fff",
                  borderRadius: 20, padding: "3px 12px", fontSize: 11, display: "inline-block",
                }}>已選擇</div>
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