"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { useBookingStore } from "../../../../store/bookingStore";
import { useLanguageStore, type Language } from "../../../../store/languageStore";

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

const categoryNameEn: Record<string, string> = {
  shampoo: "Shampoo & Styling",
  cut: "Haircut",
  perm: "Perm",
  color: "Color",
  treatment: "Treatment",
  scalp: "Scalp Care",
};

const serviceNameEn: Record<string, string> = {
  "精油髮浴洗": "Essential Oil Hair Bath",
  "接髮": "Hair Extensions",
  "造型": "Styling",
  "增色洗": "Color Refresh Shampoo",
  "剪髮（含髮浴）": "Haircut with Hair Bath",
  "剪髮（含髮浴）孩童": "Kids Haircut with Hair Bath",
  "單剪髮（不含髮浴）": "Haircut Only",
  "單剪髮（不含髮浴）孩童": "Kids Haircut Only",
  "修瀏海": "Bang Trim",
  "質感燙＋剪髮": "Texture Perm + Haircut",
  "熱/溫塑＋結構剪髮": "Digital / Thermal Perm + Haircut",
  "瀏海設計燙": "Bang Perm",
  "瀏海設計燙（不含洗）": "Bang Perm (shampoo not included)",
  "髮根燙（2cm內）": "Root Perm (within 2 cm)",
  "設計染（單色）": "Single Color",
  "補染髮根（2cm內）": "Root Touch-up (within 2 cm)",
  "HHN深層結構護髮": "HHN Deep Structural Treatment",
  "快速護髮": "Express Treatment",
  "深層護髮（自產）": "Deep Treatment",
  "髮質淨化": "Hair Detox",
  "高階頭皮深呼吸": "Advanced Scalp Therapy",
  "頭皮隔離": "Scalp Protection",
  "深層淨化髮浴（含基本吹乾）": "Deep Cleansing Hair Bath with Basic Blow-dry",
  "深層淨化髮浴（含基本造型）": "Deep Cleansing Hair Bath with Basic Styling",
};

const noteEn: Record<string, string> = {
  "耳上": "Above ears",
  "下巴上": "Above chin",
  "胸上": "Above chest",
  "胸下": "Below chest",
  "國小以下": "Elementary school age or younger",
  "含洗髮及基礎頭皮隔離": "Includes shampoo and basic scalp protection",
};

function baseServiceName(name: string) {
  return name.replace(/\s*[\(（][SMLX]+[\)）]$/, "").trim();
}

function serviceSize(name: string) {
  return name.match(/[\(（]([SMLX]+)[\)）]$/)?.[1] || "";
}

function displayServiceName(name: string, language: Language) {
  if (language === "zh") return name;
  const base = baseServiceName(name);
  const size = serviceSize(name);
  const translated = serviceNameEn[base] || base;
  return size ? `${translated} (${size})` : translated;
}

function displayDuration(duration: string, language: Language) {
  if (language === "zh" || !duration) return duration;
  return duration.replace("分鐘", "min");
}

function displayNote(note: string, language: Language) {
  if (language === "zh" || !note) return note;
  return noteEn[note] || note.replace("耳上", "Above ears").replace("下巴上", "Above chin").replace("胸上", "Above chest").replace("胸下", "Below chest");
}

function displayPriceRange(priceRange: string, language: Language) {
  if (language === "zh") return priceRange;
  return priceRange
    .replace("孩童", "Kids")
    .replace("國小以下", "elementary school age or younger")
    .replace("含洗髮及基礎頭皮隔離", "includes shampoo and basic scalp protection")
    .replace("造型", "styling");
}

function normalizePriceName(name: string) {
  return baseServiceName(name).replace(/\s+/g, "").toLowerCase();
}

function getServicePriceRange(serviceName: string, priceData: PriceItem[], language: Language) {
  const target = normalizePriceName(serviceName);
  const matched = priceData.find((p) => {
    const priceName = normalizePriceName(p.name);
    return priceName === target || priceName.includes(target) || target.includes(priceName);
  });
  return matched ? displayPriceRange(matched.price_range, language) : "";
}

function getLengthPriceOptions(priceRange: string, language: Language) {
  const parts = priceRange.split("/").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return null;
  if (!parts.every((part) => /^\$[\d,]+$/.test(part))) return null;

  const labels = ["S", "M", "L", "XL"];

  return parts.map((price, index) => ({ label: labels[index], price }));
}

export default function Step2() {
  const router = useRouter();
  const { designer, serviceIds, toggleService } = useBookingStore();
  const { language } = useLanguageStore();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [showHairLengthGuide, setShowHairLengthGuide] = useState(false);
  const [loading, setLoading] = useState(true);
  const [priceData, setPriceData] = useState<PriceItem[]>([]);
  const isEnglish = language === "en";

  useEffect(() => {
    if (!designer) { router.push("/booking/step/1"); return; }
    Promise.all([
      supabase.from("service_categories").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("services").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("price_items").select("*").order("sort_order"),
      supabase.from("designer_price_items").select("*").eq("designer_id", designer.id).eq("is_active", true).order("sort_order"),
    ]).then(([{ data: cats }, { data: svcs }, { data: prices }, { data: designerPrices }]) => {
      if (cats && svcs) {
        setCategories(cats.map((c: ServiceCategory) => {
          const allItems = svcs.filter((s: Service) => s.category_id === c.id);
          // 合併 S/M/L/XL 變體，只顯示基本名稱
          const seen = new Set<string>();
          const dedupedItems = allItems.reduce((acc: Service[], item: Service) => {
            const baseName = item.name.replace(/\s*[\(（][SMLX]+[\)）]$/, '').trim();
            if (!seen.has(baseName)) {
              seen.add(baseName);
              acc.push({ ...item, name: baseName });
            }
            return acc;
          }, []);
          return { ...c, items: dedupedItems };
        }));
      }
      if (designerPrices && designerPrices.length > 0) setPriceData(designerPrices);
      else if (prices) setPriceData(prices);
      setLoading(false);
    });
  }, [designer, router]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
        <div style={{ color: "#7a1f1f", fontSize: 14 }}>{isEnglish ? "Loading..." : "載入中..."}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px 120px" }}>
      <button
        onClick={() => router.push("/booking/step/1")}
        style={{
          background: "transparent",
          border: "none",
          color: "#7a1f1f",
          fontSize: 13,
          fontWeight: 700,
          padding: "0 0 14px",
          cursor: "pointer",
        }}
      >
        {isEnglish ? "⬅︎ Back" : "⬅︎返回"}
      </button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#1a1a1a", marginBottom: 4 }}>{isEnglish ? "Choose Services" : "選擇服務"}</div>
          <div style={{ fontSize: 12, color: "#9a9188" }}>{isEnglish ? "You may select multiple services." : "可複選多項服務"}</div>
        </div>
        <button
          onClick={() => setShowHairLengthGuide(true)}
          aria-label={isEnglish ? "Open hair length guide" : "放大髮長標示圖"}
          style={{
            width: 76,
            height: 76,
            padding: 0,
            border: "0.5px solid #e5dbd0",
            borderRadius: 12,
            background: "#fff",
            overflow: "hidden",
            cursor: "pointer",
            flexShrink: 0,
            boxShadow: "0 2px 8px rgba(122,31,31,0.08)",
          }}
        >
          <img
            src="/hair-length.png"
            alt={isEnglish ? "Hair length guide" : "髮長標示圖"}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </button>
      </div>
      <div style={{ background: "#f2e8e6", border: "0.5px solid #d9b8b0", borderRadius: 10, padding: "8px 10px", fontSize: 11, color: "#7a1f1f", lineHeight: 1.6, marginBottom: 16 }}>
        {isEnglish ? "Prices are for reference only. Final pricing will be confirmed by the stylist in person." : "價格僅供參考，實際金額皆以設計師現場報價為主。"}
      </div>
      {showHairLengthGuide && (
        <div
          onClick={() => setShowHairLengthGuide(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{ position: "relative", width: "100%", maxWidth: 420, background: "#fff", borderRadius: 16, padding: 12 }}
          >
            <button
              onClick={() => setShowHairLengthGuide(false)}
              aria-label={isEnglish ? "Close" : "關閉"}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                width: 34,
                height: 34,
                borderRadius: 999,
                border: "none",
                background: "rgba(26,26,26,0.72)",
                color: "#fff",
                fontSize: 18,
                cursor: "pointer",
              }}
            >
              ×
            </button>
            <img
              src="/hair-length.png"
              alt={isEnglish ? "Hair length guide" : "髮長標示圖"}
              style={{ width: "100%", borderRadius: 12, display: "block" }}
            />
          </div>
        </div>
      )}

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
                background: pickedCount > 0 ? "#f2e8e6" : "#fdfaf7",
                border: "0.5px solid " + (pickedCount > 0 ? "#d9b8b0" : "#e5dbd0"),
                borderRadius: isOpen ? "10px 10px 0 0" : 10,
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: "#1a1a1a" }}>
                  {isEnglish ? (categoryNameEn[cat.name] || cat.label.replace(/^.\s/, "")) : cat.label.replace(/^.\s/, "")}
                  <span style={{ fontSize: 11, color: "#9a9188", marginLeft: 6, textTransform: "capitalize" }}>
                    {cat.name}
                  </span>
                </span>
                {pickedCount > 0 ? (
                  <span style={{ fontSize: 10, background: "#7a1f1f", color: "#fff", borderRadius: 10, padding: "1px 8px" }}>
                    {isEnglish ? `${pickedCount} selected` : `${pickedCount} 項`}
                  </span>
                ) : null}
              </div>
              <span style={{ fontSize: 12, color: "#9a9188" }}>{isOpen ? "▲" : "▼"}</span>
            </div>

            {isOpen ? (
              <div style={{ border: "0.5px solid #e5dbd0", borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
                {cat.items.map((item) => {
                  const picked = serviceIds.includes(item.id);
                  const priceRange = getServicePriceRange(item.name, priceData, language);
                  const lengthPriceOptions = getLengthPriceOptions(priceRange, language);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleService(item.id)}
                      style={{
                        padding: "11px 14px",
                        background: picked ? "#f2e8e6" : "#fdfaf7",
                        borderTop: "0.5px solid #f0e9e0",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: picked ? 600 : 500, color: "#1a1a1a", lineHeight: 1.45 }}>{displayServiceName(item.name, language)}</div>
                          <div style={{ fontSize: 11, color: "#9a9188", marginTop: 3, lineHeight: 1.45 }}>
                            {displayDuration(item.duration, language)}{item.note ? "・" + displayNote(item.note, language) : ""}
                          </div>
                        </div>
                        <div style={{
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          border: "1.5px solid " + (picked ? "#7a1f1f" : "#e5dbd0"),
                          background: picked ? "#7a1f1f" : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          marginTop: 2,
                        }}>
                          {picked ? <span style={{ color: "#fff", fontSize: 13 }}>✓</span> : null}
                        </div>
                      </div>
                      {lengthPriceOptions ? (
                        <div style={{ fontSize: 13, color: "#7a1f1f", fontWeight: 800, lineHeight: 1.55, marginTop: 7, paddingRight: 32 }}>
                          {lengthPriceOptions.map((option) => `${option.label} ${option.price}`).join(" / ")}
                        </div>
                      ) : priceRange ? (
                        <div style={{ fontSize: 13, color: "#7a1f1f", fontWeight: 700, lineHeight: 1.45, marginTop: 7, paddingRight: 32 }}>
                          {priceRange}
                        </div>
                      ) : null}
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
        background: "#fdfaf7",
        borderTop: "0.5px solid #e5dbd0",
        padding: "12px 16px 24px",
        display: "flex",
        gap: 10,
      }}>
        <button
          onClick={() => { if (serviceIds.length > 0) router.push("/booking/step/3"); }}
          disabled={serviceIds.length === 0}
          style={{
            flex: 1,
            padding: "13px 0",
            background: serviceIds.length > 0 ? "#7a1f1f" : "#e5dbd0",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 600,
            cursor: serviceIds.length > 0 ? "pointer" : "default",
          }}
        >
          {serviceIds.length > 0 ? (isEnglish ? "Next: Choose Time →" : "下一步：選擇時間 →") : (isEnglish ? "Please select at least one service" : "請選擇至少一項服務")}
        </button>
      </div>
    </div>
  );
}
