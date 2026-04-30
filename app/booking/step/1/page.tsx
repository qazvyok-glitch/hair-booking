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

type PriceItem = { name: string; price: number };
type PriceCategory = { cat: string; items: PriceItem[] };

const defaultPrices: PriceCategory[] = [
  { cat: "洗髮", items: [{ name: "精油髮浴洗", price: 400 }] },
  { cat: "頭皮護理", items: [{ name: "頭皮深層護理", price: 800 }, { name: "頭皮保濕療程", price: 600 }] },
  { cat: "剪髮", items: [{ name: "女仕剪髮", price: 350 }, { name: "男仕剪髮", price: 250 }] },
  { cat: "燙髮", items: [{ name: "一般燙髮", price: 1800 }, { name: "數位燙", price: 2500 }] },
  { cat: "染髮", items: [{ name: "全頭染", price: 1500 }, { name: "挑染/漸層", price: 2000 }] },
];

export default function Step1() {
  const router = useRouter();
  const { designer: selected, setDesigner } = useBookingStore();
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [loading, setLoading] = useState(true);
  const [priceModal, setPriceModal] = useState<Designer | null>(null);

  useEffect(() => {
    supabase
      .from("designers")
      .select("*")
      .eq("is_active", true)
      .order("id")
      .then(({ data }) => {
        if (data) {
          const sorted = [...data].sort((a, b) => {
            if (a.name === "Alisa") return 1;
            if (b.name === "Alisa") return -1;
            return 0;
          });
          setDesigners(sorted);
        }
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
        <div style={{ color: "#7a1f1f", fontSize: 14 }}>載入中</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px 120px" }}>
      <div style={{ fontSize: 20, fontWeight: 600, color: "#1a1a1a", marginBottom: 4 }}>選擇設計師</div>
      <div style={{ fontSize: 12, color: "#9a9188", marginBottom: 20 }}>請選擇您想預約的設計師</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {/* 不指定選項 */}
        {(() => {
          const isSelected = selected?.id === 0;
          return (
            <div
              onClick={() => setDesigner({ id: 0, name: "不指定", nickname: "依時間安排", initials: "✦", style: "依照時間由店家安排", ig: "", bg_color: "#f0e9e0", text_color: "#4a4a4a", work_hours: ["10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"] })}
              style={{
                background: isSelected ? "#f2e8e6" : "#fdfaf7",
                border: "1.5px solid " + (isSelected ? "#7a1f1f" : "#e5dbd0"),
                borderRadius: 14,
                padding: "16px 12px",
                textAlign: "center",
                cursor: "pointer",
                boxShadow: isSelected ? "0 4px 16px rgba(122,31,31,0.12)" : "none",
                gridColumn: "1 / -1",
              }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                background: "#f0e9e0", color: "#4a4a4a",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, fontWeight: 600, margin: "0 auto 8px",
                border: isSelected ? "2.5px solid #7a1f1f" : "2px solid #e5dbd0",
              }}>✦</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>不指定設計師</div>
              <div style={{ fontSize: 11, color: "#9a9188", margin: "4px 0", lineHeight: 1.5 }}>
                依照我的時間，請店家幫我安排
              </div>
              {isSelected ? (
                <div style={{
                  marginTop: 8, background: "#7a1f1f", color: "#fff",
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
                background: isSelected ? "#f2e8e6" : "#fdfaf7",
                border: "1.5px solid " + (isSelected ? "#7a1f1f" : "#e5dbd0"),
                borderRadius: 14,
                padding: "16px 12px",
                textAlign: "center",
                cursor: "pointer",
                boxShadow: isSelected ? "0 4px 16px rgba(122,31,31,0.12)" : "none",
              }}
            >
              <div style={{
                width: 60, height: 60, borderRadius: "50%",
                background: d.bg_color, color: d.text_color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, fontWeight: 600, margin: "0 auto 10px",
                border: isSelected ? "2.5px solid #7a1f1f" : "2px solid transparent",
              }}>
                {d.initials}
              </div>

              <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{d.name}</div>

              {d.nickname ? (
                <div style={{ fontSize: 11, color: "#9a6060", margin: "3px 0" }}>{d.nickname}</div>
              ) : null}

              <div style={{ fontSize: 11, color: "#9a9188", lineHeight: 1.5, margin: "4px 0 8px" }}>
                {d.style}
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 6 }}>
                <a
                  href={"https://www.instagram.com/" + d.ig}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="2" y="2" width="20" height="20" rx="6" fill="#E1306C" />
                    <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.8" fill="none" />
                    <circle cx="17.5" cy="6.5" r="1.2" fill="white" />
                  </svg>
                  <span style={{ fontSize: 11, color: "#9a9188" }}>作品集</span>
                </a>

                <span style={{ color: "#e5dbd0", fontSize: 11 }}>|</span>

                <button
                  onClick={(e) => { e.stopPropagation(); setPriceModal(d); }}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 11, color: "#7a1f1f", fontWeight: 600, padding: 0,
                  }}
                >
                  💰 價目表
                </button>
              </div>

              {isSelected ? (
                <div style={{
                  marginTop: 8, background: "#7a1f1f", color: "#fff",
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

      {/* 價目表 Modal */}
      {priceModal && (
        <div
          onClick={() => setPriceModal(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fdfaf7", borderRadius: "22px 22px 0 0",
              padding: "24px 20px 40px", width: "100%", maxWidth: 390,
              maxHeight: "75vh", overflowY: "auto",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#1a1a1a" }}>{priceModal.name} 的價目表</div>
                {priceModal.nickname && (
                  <div style={{ fontSize: 12, color: "#9a6060", marginTop: 2 }}>{priceModal.nickname}</div>
                )}
              </div>
              <button
                onClick={() => setPriceModal(null)}
                style={{
                  width: 30, height: 30, borderRadius: "50%", background: "#f0e9e0",
                  border: "none", fontSize: 16, cursor: "pointer", color: "#4a4a4a",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >✕</button>
            </div>

            {/* Price List */}
            {defaultPrices.map((cat) => (
              <div key={cat.cat}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: "#9a9188",
                  textTransform: "uppercase", letterSpacing: "0.5px",
                  margin: "16px 0 8px", borderBottom: "1px solid #f0e9e0",
                  paddingBottom: 6,
                }}>
                  {cat.cat}
                </div>
                {cat.items.map((item) => (
                  <div
                    key={item.name}
                    style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "center", padding: "10px 0",
                      borderBottom: "1px solid #f5f0eb",
                    }}
                  >
                    <span style={{ fontSize: 14, color: "#1a1a1a" }}>{item.name}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#7a1f1f" }}>NT$ {item.price}</span>
                  </div>
                ))}
              </div>
            ))}

            <div style={{ fontSize: 11, color: "#9a9188", textAlign: "center", marginTop: 20 }}>
              ※ 實際價格依髮長、髮量調整
            </div>
          </div>
        </div>
      )}

      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 390, background: "#fdfaf7",
        borderTop: "0.5px solid #e5dbd0", padding: "12px 16px 24px",
      }}>
        <button
          onClick={() => { if (selected) router.push("/booking/step/2"); }}
          disabled={!selected}
          style={{
            width: "100%", padding: "13px 0",
            background: selected ? "#7a1f1f" : "#e5dbd0",
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
