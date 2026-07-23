"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function Step1() {
  const router = useRouter();
  const { designer: selected, setDesigner, customerName, contactValue, setCustomerName, setContact } = useBookingStore();
  const { language } = useLanguageStore();
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState(customerName || "");
  const [profilePhone, setProfilePhone] = useState(contactValue || "");
  const [profileEmail, setProfileEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
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
    supabase
      .from("designers")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { nullsFirst: false })
      .order("id")
      .then(({ data }) => {
        if (data) setDesigners(data);
        setLoading(false);
      });
  }, []);

  async function handleSaveProfile() {
    if (!profileName.trim() || !profilePhone.trim()) {
      alert(isEnglish ? "Please enter your name and phone number" : "請填寫姓名與手機號碼");
      return;
    }
    setSavingProfile(true);
    await supabase.from("customers").insert({
      id: crypto.randomUUID(),
      name: profileName.trim(),
      phone: profilePhone.trim(),
      email: profileEmail.trim() || null,
    });
    setCustomerName(profileName.trim());
    setContact("phone", profilePhone.trim());
    setSavingProfile(false);
  }

  if (loading) {
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
            <button onClick={handleSaveProfile} disabled={savingProfile} style={{ width: "100%", padding: "13px 0", background: savingProfile ? "#D3D1C7" : "#534AB7", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: savingProfile ? "default" : "pointer" }}>
              {savingProfile ? (isEnglish ? "Saving..." : "儲存中...") : (isEnglish ? "Start Choosing Stylist" : "開始選擇設計師")}
            </button>
          </div>
        </>
      ) : (
        <div style={{ background: "#EEEDFE", border: "0.5px solid #AFA9EC", borderRadius: 16, padding: "14px 16px", marginBottom: 18 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#2C2C2A", marginBottom: 4 }}>
            {isEnglish ? `Hello, ${customerName}! 👋` : `您好，${customerName}！👋`}
          </div>
          <div style={{ fontSize: 12, color: "#5F5E5A", lineHeight: 1.6 }}>
            {isEnglish ? "Welcome back. Please choose the stylist you would like to book with." : "歡迎回來，請選擇這次想預約的設計師。"}
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
              <div style={{ minHeight: 24, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 6 }}>
                {portfolio ? (
                  <a href={portfolio} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="6" fill="#E1306C" /><circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.8" fill="none" /><circle cx="17.5" cy="6.5" r="1.2" fill="white" /></svg>
                    <span style={{ fontSize: 11, color: "#888780" }}>{isEnglish ? "Portfolio" : "作品集"}</span>
                  </a>
                ) : null}
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
          onClick={() => { if (canContinue) router.push("/booking/step/2"); }}
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
        </>
      )}
    </div>
  );
}
