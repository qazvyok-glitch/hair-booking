"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { useBookingStore } from "../../../../store/bookingStore";

type Service = {
  id: number;
  name: string;
  duration: string;
  note: string;
  category_id: number;
};

type ServiceCategory = {
  id: number;
  name: string;
  label: string;
  color: string;
  text_color: string;
  items: Service[];
};

type PriceItem = {
  id: number;
  category: string;
  name: string;
  price_range: string;
};

function PriceSheet({ onClose, priceData }: { onClose: () => void; priceData: PriceItem[] }) {
  const categories = [...new Set(priceData.map((p) => p.category))];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 390, background: "#fff", borderRadius: "20px 20px 0 0", maxHeight: "85vh", overflowY: "auto", padding: "20px 16px 32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#2C2C2A" }}>價目表</div>
            <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>染、燙、護髮依髮長及髮量收費</div>
          </div>
          <button onClick={onClose} style={{ background: "#F1EFE8", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ marginBottom: 14 }}>
          <img src="/hair-length.png" alt="髮長示意圖" style={{ width: "100%", borderRadius: 10, objectFit: "contain" }} />
        </div>
        <div style={{ background: "#FAEEDA", border: "0.5px solid #FAC775", borderRadius: 10, padding: "8px 12px", marginBottom: 14, fontSize: 11, color: "#633806" }}>
          S 耳上 ／ M 下巴上 ／ L 胸上 ／ XL 胸下<br/>
          長度超過肚臍以下，由設計師現場諮詢報價。
        </div>
        {categories.map((cat) => (
          <div key={cat} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 600, borderBottom: "1px solid #D3D1C7", paddingBottom: 6, marginBottom: 8, color: "#2C2C2A" }}>{cat}</div>
            {priceData.filter((p) => p.category === cat).map((item) => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "0.5px solid #F1EFE8" }}>
                <div style={{ fontSize: 12, color: "#2C2C2A", flex: 1 }}>{item.name}</div>
                <div style={{ fontSize: 12, color: "#534AB7", fontWeight: 500, marginLeft: 8 }}>{item.price_range}</div>
              </div>
            ))}
          </div>
        ))}
        <div style={{ textAlign: "center", fontSize: 11, color: "#888780" }}>消費滿 $2000 以上，歡迎使用 LINE PAY</div>
      </div>
    </div>
  );
}

export default function Step2() {
  const router = useRouter();
  const { designer, serviceIds, toggleService } = useBookingStore();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPrice, setShowPrice] = useState(false);
  const [priceData, setPriceData] = useState<PriceItem[]>([]);

  useEffect(() => {
    if (!designer) { router.push("/booking/step/1"); return; }
    Promise.all([
      supabase.from("service_categories").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("services").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("price_items").select("*").order("sort_order"),
    ]).then(([{ data: cats }, { data: svcs }, { data: prices }]) => {
      if (cats && svcs) {
        setCategories(cats.map((c: ServiceCategory) => {
          const allItems = svcs.filter((s: Service) => s.category_id === c.id);
          // 合併 S/M/L/XL 變體，只顯示基本名稱
          const seen = new Set<string>();
          const dedupedItems = allItems.reduce((acc: Service[], item: Service) => {
            const baseName = item.name.replace(/\s*\([SMLX]+\)$/, '').trim();
            if (!seen.has(baseName)) {
              seen.add(baseName);
              acc.push({ ...item, name: baseName });
            }
            return acc;
          }, []);
          return { ...c, items: dedupedItems };
        }));
      }
      if (prices) setPriceData(prices);
      setLoading(false);
    });
  }, [designer, router]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
        <div style={{ color: "#534AB7", fontSize: 14 }}>載入中...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px 120px" }}>
      {showPrice && <PriceSheet onClose={() => setShowPrice(false)} priceData={priceData} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: "#2C2C2A" }}>選擇服務</div>
        <button onClick={() => setShowPrice(true)} style={{ fontSize: 11, color: "#534AB7", background: "#EEEDFE", border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>查看價目表 →</button>
      </div>
      <div style={{ fontSize: 12, color: "#888780", marginBottom: 20 }}>可複選多項服務</div>

      {categories.map((cat) => {
        const pickedCount = cat.items.filter((i) => serviceIds.includes(i.id)).length;
        const isOpen = openCategory === cat.name;
        return (
          <div key={cat.id} style={{ marginBottom: 6 }}>
            <div
              onClick={() => setOpenCategory(isOpen ? null : cat.name)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 14px",
                background: pickedCount > 0 ? cat.color : "#fff",
                border: "0.5px solid " + (pickedCount > 0 ? cat.text_color + "40" : "#D3D1C7"),
                borderRadius: isOpen ? "10px 10px 0 0" : 10,
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: "#2C2C2A" }}>
                  {cat.label.replace(/^.\s/, "")}
                  <span style={{ fontSize: 11, color: "#888780", marginLeft: 6, textTransform: "capitalize" }}>
                    {cat.name}
                  </span>
                </span>
                {pickedCount > 0 ? (
                  <span style={{ fontSize: 10, background: cat.text_color, color: "#fff", borderRadius: 10, padding: "1px 8px" }}>
                    {pickedCount} 項
                  </span>
                ) : null}
              </div>
              <span style={{ fontSize: 12, color: "#888780" }}>{isOpen ? "▲" : "▼"}</span>
            </div>

            {isOpen ? (
              <div style={{ border: "0.5px solid #D3D1C7", borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
                {cat.items.map((item) => {
                  const picked = serviceIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleService(item.id)}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "11px 14px",
                        background: picked ? cat.color : "#fff",
                        borderTop: "0.5px solid #F1EFE8",
                        cursor: "pointer",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: picked ? 500 : 400, color: "#2C2C2A" }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>
                          {item.duration}{item.note ? "・" + item.note : ""}
                        </div>
                      </div>
                      <div style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        border: "1.5px solid " + (picked ? cat.text_color : "#D3D1C7"),
                        background: picked ? cat.text_color : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        {picked ? <span style={{ color: "#fff", fontSize: 13 }}>✓</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}

      {/* 下方按鈕 */}
      <div style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 390,
        background: "#fff",
        borderTop: "0.5px solid #D3D1C7",
        padding: "12px 16px 24px",
        display: "flex",
        gap: 10,
      }}>
        <button
          onClick={() => router.push("/booking/step/1")}
          style={{
            padding: "13px 18px",
            background: "#F1EFE8",
            color: "#5F5E5A",
            border: "none",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ← 上一步
        </button>
        <button
          onClick={() => { if (serviceIds.length > 0) router.push("/booking/step/3"); }}
          disabled={serviceIds.length === 0}
          style={{
            flex: 1,
            padding: "13px 0",
            background: serviceIds.length > 0 ? "#534AB7" : "#D3D1C7",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 600,
            cursor: serviceIds.length > 0 ? "pointer" : "default",
          }}
        >
          {serviceIds.length > 0 ? "下一步：選擇時間 →" : "請選擇至少一項服務"}
        </button>
      </div>
    </div>
  );
}
