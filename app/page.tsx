"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useBookingStore } from "../store/bookingStore";
import { useLanguageStore } from "../store/languageStore";

export default function Home() {
  const { language, toggleLanguage } = useLanguageStore();
  const { setContact, setCustomerName } = useBookingStore();
  const isEnglish = language === "en";
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const isValid = phone.replace(/\D/g, "").length >= 8;

  async function handleBookingStart() {
    if (!isValid) {
      alert(isEnglish ? "Please enter a valid phone number" : "請輸入有效的手機號碼");
      return;
    }

    setLoading(true);
    setContact("phone", phone);

    const { data: customer } = await supabase
      .from("customers")
      .select("name")
      .eq("phone", phone)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    const { data: booking } = customer?.name ? { data: null } : await supabase
      .from("bookings")
      .select("customer_name")
      .eq("customer_phone", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    setCustomerName(customer?.name || booking?.customer_name || "");
    setLoading(false);
    router.push("/booking/step/1");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#121212", display: "flex", justifyContent: "center", alignItems: "center", padding: "20px 14px" }}>
      <main style={{
        width: "100%",
        maxWidth: 430,
        border: "1.5px solid rgba(255,255,255,0.78)",
        borderRadius: 28,
        padding: "26px 22px 28px",
        background: "linear-gradient(180deg, #191919 0%, #141414 100%)",
        color: "#fff",
        boxSizing: "border-box",
      }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
          <button onClick={toggleLanguage} style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.36)", borderRadius: 999, padding: "7px 13px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
            {isEnglish ? "中文" : "EN"}
          </button>
        </div>

        <section style={{ textAlign: "center", padding: "8px 0 28px" }}>
          <img
            src="/logo.png"
            alt="Bing Cherry Hair Salon logo"
            style={{ display: "block", width: 118, height: 118, borderRadius: "50%", objectFit: "cover", margin: "0 auto 22px", border: "2px solid rgba(255,255,255,0.94)" }}
          />
          <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", lineHeight: 1.12, letterSpacing: "-0.02em" }}>
            Bing Cherry Hair Salon
          </div>
          <button
            onClick={() => router.push("/about")}
            style={{ background: "transparent", color: "#fff", border: "none", padding: "18px 0 0", fontSize: 13, fontWeight: 800, cursor: "pointer" }}
          >
            {isEnglish ? "Shop Information →" : "店家資訊 →"}
          </button>
        </section>

        <section style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div style={{ width: "100%" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.62)", letterSpacing: "0.08em", marginBottom: 8 }}>
              {isEnglish ? "☎ Phone Number" : "☎ 手機號碼 Phone Number"}
            </div>
            <input
              type="tel"
              inputMode="tel"
              placeholder="0912-345-678"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter" && isValid) handleBookingStart(); }}
              style={{
                width: "100%",
                padding: "15px 16px",
                borderRadius: 16,
                fontSize: 18,
                border: "1.5px solid rgba(255,255,255,0.64)",
                background: "rgba(255,255,255,0.06)",
                outline: "none",
                letterSpacing: "0.06em",
                color: "#fff",
                boxSizing: "border-box",
              }}
            />
          </div>
          <button
            onClick={handleBookingStart}
            disabled={!isValid || loading}
            style={{
              width: "100%",
              padding: "20px 0",
              background: "transparent",
              color: isValid && !loading ? "#fff" : "rgba(255,255,255,0.42)",
              border: "2px solid " + (isValid && !loading ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.24)"),
              borderRadius: 18,
              fontSize: 22,
              fontWeight: 900,
              cursor: isValid && !loading ? "pointer" : "default",
              letterSpacing: "0.1em",
            }}
          >
            {loading ? (isEnglish ? "Checking..." : "查詢中...") : (isEnglish ? "Book Now" : "立即預約")}
          </button>
          <button
            onClick={() => router.push("/booking/my-bookings")}
            style={{ background: "transparent", color: "#fff", border: "none", padding: "2px 0 0", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
          >
            {isEnglish ? "👤 View my profile and bookings →" : "👤 查看我的個人資料及預約 →"}
          </button>
        </section>

        <div style={{ marginTop: 34, fontSize: 11, color: "#666", textAlign: "center" }}>
          © Bing Cherry Hair Salon
        </div>
      </main>
    </div>
  );
}
