"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { appRoutes } from "../../../../lib/appRoutes";
import { supabase } from "../../../../lib/supabase";
import { useBookingStore } from "../../../../store/bookingStore";
import { useLanguageStore } from "../../../../store/languageStore";

type Designer = {
  id: number;
  name: string;
  nickname: string;
  nickname_en?: string;
  initials: string;
  style: string;
  style_en?: string;
  ig: string;
  bg_color: string;
  text_color: string;
  work_hours: string[];
  avatar_url: string;
  sort_order?: number | null;
};

type PriceItem = {
  id: number;
  designer_id?: number | null;
  category: string;
  name: string;
  price_range: string;
  sort_order?: number | null;
  is_active?: boolean | null;
};

const DESIGNER_NICKNAME_EN: Record<string, string> = {
  扁頭救星: "Flat Head Specialist",
  米拉夫人: "Madame Mira",
};

const STYLE_EN: Record<string, string> = {
  日系: "Japanese Style",
  剪髮: "Cut",
  染髮: "Color",
  燙髮: "Perm",
  護髮: "Treatment",
};

const DESIGNER_PORTFOLIO_FALLBACK: Record<string, string> = {
  Mira: "https://www.instagram.com/bing_miramira?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==",
};

function translateStyle(style: string) {
  return style
    .split("、")
    .map((item) => STYLE_EN[item.trim()] || item.trim())
    .join(", ");
}

function portfolioUrl(designer: Designer) {
  const value = (designer.ig || DESIGNER_PORTFOLIO_FALLBACK[designer.name] || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const handle = value.replace(/^@/, "").replace(/^instagram\.com\//i, "").replace(/^www\.instagram\.com\//i, "");
  return `https://www.instagram.com/${handle}`;
}

function phoneLookupCandidates(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  return Array.from(new Set([trimmed, digits].filter(Boolean)));
}

function pickExistingCustomer(customers?: { id?: string | null; name?: string | null; phone?: string | null; official_line_user_id?: string | null }[] | null) {
  if (!customers?.length) return null;
  return customers.find((customer) => customer.official_line_user_id) || customers[0];
}

function groupedPriceItems(items: PriceItem[]) {
  return items.reduce<Record<string, PriceItem[]>>((groups, item) => {
    const category = item.category || "其他服務";
    groups[category] = [...(groups[category] || []), item].sort((a, b) => (a.sort_order || a.id) - (b.sort_order || b.id));
    return groups;
  }, {});
}

function displayPriceItemPrice(priceRange: string) {
  return priceRange ? priceRange.replace(/\$/g, "$") : "現場確認";
}

export default function Step1() {
  const router = useRouter();
  const { designer: selected, setDesigner, customerName, contactValue, setCustomerName, setContact } = useBookingStore();
  const { language } = useLanguageStore();
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [designerPriceItems, setDesignerPriceItems] = useState<PriceItem[]>([]);
  const [publicPriceItems, setPublicPriceItems] = useState<PriceItem[]>([]);
  const [priceDesigner, setPriceDesigner] = useState<Designer | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState(customerName || "");
  const [profilePhone, setProfilePhone] = useState(contactValue || "");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileReferrer, setProfileReferrer] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(Boolean(contactValue && !customerName));
  const canContinue = selected !== null && selected.id !== 0;
  const isEnglish = language === "en";
  const needsProfile = !customerName;

  function getDesignerNickname(designer: Designer) {
    if (!designer.nickname) return "";
    if (!isEnglish) return designer.nickname;
    return designer.nickname_en || DESIGNER_NICKNAME_EN[designer.nickname] || designer.nickname;
  }

  function getDesignerStyle(designer: Designer) {
    if (!designer.style) return "";
    if (!isEnglish) return designer.style;
    return designer.style_en || translateStyle(designer.style);
  }

  useEffect(() => {
    Promise.all([
      supabase
        .from("designers")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { nullsFirst: false })
        .order("id"),
      supabase
        .from("designer_price_items")
        .select("id, designer_id, category, name, price_range, sort_order, is_active")
        .eq("is_active", true)
        .order("category")
        .order("sort_order"),
      supabase
        .from("price_items")
        .select("id, category, name, price_range, sort_order")
        .order("category")
        .order("sort_order"),
    ]).then(([{ data: designerData }, { data: designerPrices }, { data: publicPrices }]) => {
        if (designerData) setDesigners(designerData);
        setDesignerPriceItems((designerPrices || []) as PriceItem[]);
        setPublicPriceItems((publicPrices || []) as PriceItem[]);
        setLoading(false);
      });
  }, []);

  function getDesignerPriceItems(designer: Designer) {
    const specificItems = designerPriceItems.filter((item) => item.designer_id === designer.id && item.is_active !== false);
    return specificItems.length > 0 ? specificItems : publicPriceItems;
  }

  useEffect(() => {
    if (!contactValue || customerName) {
      setCheckingProfile(false);
      return;
    }

    const phoneCandidates = phoneLookupCandidates(contactValue);
    if (phoneCandidates.length === 0) {
      setCheckingProfile(false);
      return;
    }

    let cancelled = false;
    setCheckingProfile(true);

    supabase
      .from("customers")
      .select("id, name, phone, official_line_user_id")
      .in("phone", phoneCandidates)
      .order("updated_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (cancelled) return;
        const customer = pickExistingCustomer(data);
        if (customer?.name) {
          setCustomerName(customer.name);
          setContact("phone", customer.phone || contactValue);
        }
      })
      .finally(() => {
        if (!cancelled) setCheckingProfile(false);
      });

    return () => {
      cancelled = true;
    };
  }, [contactValue, customerName, setContact, setCustomerName]);

  async function handleSaveProfile() {
    if (!profileName.trim() || !profilePhone.trim()) {
      alert(isEnglish ? "Please enter your name and phone number" : "請填寫姓名與手機號碼");
      return;
    }
    setSavingProfile(true);
    const phoneCandidates = phoneLookupCandidates(profilePhone);
    const { data: existingCustomers } = await supabase
      .from("customers")
      .select("id, name, phone, official_line_user_id")
      .in("phone", phoneCandidates)
      .order("updated_at", { ascending: false })
      .limit(5);

    const existingCustomer = pickExistingCustomer(existingCustomers);
    if (existingCustomer?.name) {
      setCustomerName(existingCustomer.name);
      setContact("phone", existingCustomer.phone || profilePhone.trim());
      alert(isEnglish ? "We found an existing profile for this phone number and loaded it for you." : "此手機號碼已有會員資料，已為您直接帶入。");
      setSavingProfile(false);
      return;
    }

    const payload = {
      name: profileName.trim(),
      phone: profilePhone.trim(),
      email: profileEmail.trim() || null,
      referrer: profileReferrer.trim() || null,
    };
    if (existingCustomer?.id) {
      await supabase.from("customers").update(payload).eq("id", existingCustomer.id);
    } else {
      await supabase.from("customers").insert({
        id: crypto.randomUUID(),
        ...payload,
      });
    }
    setCustomerName(profileName.trim());
    setContact("phone", profilePhone.trim());
    setSavingProfile(false);
  }

  if (loading || checkingProfile) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
        <div style={{ color: "#534AB7", fontSize: 14 }}>{isEnglish ? "Loading" : "載入中"}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px 120px" }}>
      {needsProfile ? (
        <>
          <div style={{ background: "#fff", border: "0.5px solid #D3D1C7", borderRadius: 16, padding: "18px 16px", marginBottom: 18 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#2C2C2A", marginBottom: 4 }}>
              {isEnglish ? "First time booking?" : "第一次預約嗎？"}
            </div>
            <div style={{ fontSize: 12, color: "#888780", lineHeight: 1.7, marginBottom: 18 }}>
              {isEnglish ? "Please create your basic profile first. We will use it to confirm your appointment." : "先建立您的基本資料，方便我們確認預約與聯絡。"}
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 6 }}>{isEnglish ? "Name *" : "姓名 *"}</div>
              <input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder={isEnglish ? "Your name" : "王小明"} style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #D3D1C7", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 6 }}>{isEnglish ? "Phone Number *" : "手機號碼 *"}</div>
              <input value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} placeholder="0912-345-678" type="tel" style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #D3D1C7", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 6 }}>{isEnglish ? "Email (optional)" : "Email（選填）"}</div>
              <input value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} placeholder="example@email.com" type="email" style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #D3D1C7", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 6 }}>{isEnglish ? "Referrer (optional)" : "介紹人（選填）"}</div>
              <input value={profileReferrer} onChange={(e) => setProfileReferrer(e.target.value)} placeholder={isEnglish ? "Who referred you?" : "例如：Cherry、朋友小美"} style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #D3D1C7", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            </div>
            <button onClick={handleSaveProfile} disabled={savingProfile} style={{ width: "100%", padding: "13px 0", background: savingProfile ? "#D3D1C7" : "#534AB7", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: savingProfile ? "default" : "pointer" }}>
              {savingProfile ? (isEnglish ? "Saving..." : "儲存中...") : (isEnglish ? "Start Choosing Stylist" : "開始選擇設計師")}
            </button>
          </div>
        </>
      ) : (
        <div style={{ background: "#EEEDFE", border: "0.5px solid #AFA9EC", borderRadius: 16, padding: "14px 16px", marginBottom: 18 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#2C2C2A", marginBottom: 10 }}>
            {isEnglish ? `Hello, ${customerName}! 👋` : `您好，${customerName}！👋`}
          </div>
          <div style={{ borderTop: "0.5px solid rgba(83,74,183,0.22)", paddingTop: 10, fontSize: 12, color: "#4B466E", lineHeight: 1.7, fontWeight: 600 }}>
            {isEnglish
              ? "Each stylist has independent services and pricing. Prices vary depending on the stylist you choose. Please select a stylist to view their dedicated price list."
              : "每位設計師皆有獨立的服務項目與收費標準，價格依指定設計師而有所不同，請點選設計師查看各設計師專屬價目表。"}
          </div>
        </div>
      )}

      {!needsProfile && (
        <>
      <div style={{ fontSize: 20, fontWeight: 600, color: "#2C2C2A", marginBottom: 4 }}>{isEnglish ? "Choose a Stylist" : "選擇設計師"}</div>
      <div style={{ fontSize: 12, color: "#888780", marginBottom: 20 }}>{isEnglish ? "Please choose the stylist you would like to book with." : "請選擇您想預約的設計師"}</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {designers.map((d) => {
          const isSelected = selected?.id === d.id;
          const portfolio = portfolioUrl(d);
          return (
            <div
              key={d.id}
              onClick={() => setDesigner(d)}
              style={{
                position: "relative",
                background: isSelected ? "#EEEDFE" : "#fff",
                border: "1.5px solid " + (isSelected ? "#534AB7" : "#D3D1C7"),
                borderRadius: 14,
                padding: "16px 12px",
                textAlign: "center",
                cursor: "pointer",
                boxShadow: isSelected ? "0 4px 16px rgba(83,74,183,0.15)" : "none",
              }}
            >
              {isSelected && (
                <div
                  aria-label={isEnglish ? "Selected" : "已選擇"}
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: "#534AB7",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 15,
                    fontWeight: 800,
                    boxShadow: "0 3px 8px rgba(83,74,183,0.24)",
                  }}
                >
                  ✓
                </div>
              )}
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: d.bg_color, color: d.text_color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 600, margin: "0 auto 10px", border: isSelected ? "2.5px solid #534AB7" : "2px solid transparent", overflow: "hidden" }}>
                {d.avatar_url ? (
                  <img src={d.avatar_url} alt={d.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : d.initials}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#2C2C2A" }}>{d.name}</div>
              {getDesignerNickname(d) ? <div style={{ fontSize: 11, color: "#7B6FD4", margin: "3px 0" }}>{getDesignerNickname(d)}</div> : null}
              <div style={{ fontSize: 11, color: "#888780", lineHeight: 1.5, margin: "4px 0 8px" }}>{getDesignerStyle(d)}</div>
              <div style={{ minHeight: 28, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                {portfolio ? (
                  <a href={portfolio} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none", padding: "5px 7px", borderRadius: 999, background: "#fff7fb", border: "0.5px solid #f3c4d5" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="6" fill="#E1306C" /><circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.8" fill="none" /><circle cx="17.5" cy="6.5" r="1.2" fill="white" /></svg>
                    <span style={{ fontSize: 11, color: "#8C5C6D", fontWeight: 700 }}>{isEnglish ? "Portfolio" : "作品集"}</span>
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPriceDesigner(d);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "5px 7px",
                    borderRadius: 999,
                    border: "0.5px solid #e7d4cc",
                    background: "#fffaf7",
                    color: "#7a1f1f",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {isEnglish ? "Prices" : "價目表"}
                </button>
              </div>
            </div>
          );
        })}
        {designers.length === 0 && (
          <div style={{ gridColumn: "1 / -1", background: "#fff", border: "1px solid #D3D1C7", borderRadius: 14, padding: "28px 16px", textAlign: "center", color: "#888780", fontSize: 13 }}>
            {isEnglish ? "No stylists are available for booking at the moment." : "目前沒有可預約的設計師"}
          </div>
        )}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 390, background: "#fff", borderTop: "0.5px solid #D3D1C7", padding: "12px 16px 24px" }}>
        <button
          onClick={() => { if (canContinue) router.push(appRoutes.customer.bookingStep2); }}
          disabled={!canContinue}
          style={{
            width: "100%", padding: "13px 0",
            background: canContinue ? "#534AB7" : "#D3D1C7",
            color: "#fff", border: "none", borderRadius: 12,
            fontSize: 15, fontWeight: 600,
            cursor: canContinue ? "pointer" : "default",
          }}
        >
          {canContinue ? (isEnglish ? "Next: Choose Service" : "下一步：選擇服務") : (isEnglish ? "Please choose a stylist first" : "請先選擇設計師")}
        </button>
      </div>
      {priceDesigner ? (
        <PriceSheet
          designer={priceDesigner}
          items={getDesignerPriceItems(priceDesigner)}
          isEnglish={isEnglish}
          isSelected={selected?.id === priceDesigner.id}
          onClose={() => setPriceDesigner(null)}
          onSelect={() => {
            setDesigner(priceDesigner);
            setPriceDesigner(null);
          }}
        />
      ) : null}
        </>
      )}
    </div>
  );
}

function PriceSheet({
  designer,
  items,
  isEnglish,
  isSelected,
  onClose,
  onSelect,
}: {
  designer: Designer;
  items: PriceItem[];
  isEnglish: boolean;
  isSelected: boolean;
  onClose: () => void;
  onSelect: () => void;
}) {
  const groupedItems = groupedPriceItems(items);
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.42)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 390,
          maxHeight: "82vh",
          overflow: "hidden",
          background: "#fffaf7",
          borderRadius: "24px 24px 0 0",
          boxShadow: "0 -12px 40px rgba(0,0,0,0.18)",
          border: "0.5px solid #eaded6",
        }}
      >
        <div style={{ width: 46, height: 5, borderRadius: 999, background: "#d8cec6", margin: "10px auto 8px" }} />
        <div style={{ padding: "0 18px 12px", borderBottom: "0.5px solid #eaded6", position: "relative" }}>
          <button
            type="button"
            onClick={onClose}
            aria-label={isEnglish ? "Close" : "關閉"}
            style={{
              position: "absolute",
              right: 14,
              top: 0,
              width: 34,
              height: 34,
              borderRadius: 999,
              border: "none",
              background: "#f2e8e6",
              color: "#7a1f1f",
              fontSize: 20,
              cursor: "pointer",
            }}
          >
            ×
          </button>
          <div style={{ fontSize: 21, fontWeight: 800, color: "#2C2C2A", textAlign: "center", padding: "8px 36px 4px" }}>
            {isEnglish ? `${designer.name}'s Prices` : `${designer.name} 專屬價目表`}
          </div>
          <div style={{ fontSize: 12, color: "#6d625b", lineHeight: 1.7, textAlign: "center" }}>
            {isEnglish ? "Prices vary by stylist. Final pricing will be confirmed in person." : "每位設計師收費不同，實際金額以現場確認為主。"}
          </div>
        </div>
        <div style={{ maxHeight: "calc(82vh - 148px)", overflowY: "auto", padding: "14px 16px 92px" }}>
          {Object.keys(groupedItems).length > 0 ? (
            Object.entries(groupedItems).map(([category, categoryItems]) => (
              <section key={category} style={{ background: "#fff", border: "0.5px solid #eaded6", borderRadius: 16, padding: 14, marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#2C2C2A", marginBottom: 10 }}>
                  {category}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {categoryItems.map((item) => (
                    <div key={`${item.designer_id || "public"}-${item.id}`} style={{ background: "#fbf6f1", borderRadius: 12, padding: "10px 12px" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#2C2C2A", lineHeight: 1.45 }}>{item.name}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#7a1f1f", lineHeight: 1.45, marginTop: 5 }}>{displayPriceItemPrice(item.price_range)}</div>
                    </div>
                  ))}
                </div>
              </section>
            ))
          ) : (
            <div style={{ background: "#fff", border: "0.5px solid #eaded6", borderRadius: 16, padding: "24px 16px", textAlign: "center", color: "#888780", fontSize: 13 }}>
              {isEnglish ? "No price list is available yet." : "尚未設定價目表。"}
            </div>
          )}
        </div>
        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 390, background: "#fffaf7", borderTop: "0.5px solid #eaded6", padding: "12px 16px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, boxSizing: "border-box" }}>
          <button type="button" onClick={onClose} style={{ padding: "12px 0", borderRadius: 12, border: "1px solid #d9b8b0", background: "#fffaf7", color: "#7a1f1f", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            {isEnglish ? "Close" : "關閉"}
          </button>
          <button type="button" onClick={onSelect} style={{ padding: "12px 0", borderRadius: 12, border: "none", background: "#7a1f1f", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
            {isSelected ? (isEnglish ? "Selected" : "已選擇") : isEnglish ? `Choose ${designer.name}` : `選擇 ${designer.name}`}
          </button>
        </div>
      </div>
    </div>
  );
}
