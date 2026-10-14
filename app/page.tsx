"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { appRoutes } from "../lib/appRoutes";
import { supabase } from "../lib/supabase";
import { useBookingStore } from "../store/bookingStore";
import { useLanguageStore } from "../store/languageStore";

type CustomerLookup = {
  name?: string | null;
  official_line_user_id?: string | null;
};

type LiffClient = {
  init: (options: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  isInClient: () => boolean;
  login: (options?: { redirectUri?: string }) => void;
  getAccessToken: () => string | null;
};

declare global {
  interface Window {
    liff?: LiffClient;
  }
}

function pickBestCustomer(customers?: CustomerLookup[] | null) {
  if (!customers?.length) return null;
  return customers.find((customer) => customer.official_line_user_id) || customers[0];
}

function phoneLookupCandidates(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  return Array.from(new Set([trimmed, digits].filter(Boolean)));
}

export default function Home() {
  const { language, toggleLanguage } = useLanguageStore();
  const { setContact, setCustomerName } = useBookingStore();
  const isEnglish = language === "en";
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [lineConnected, setLineConnected] = useState(false);
  const isValid = phone.replace(/\D/g, "").length >= 8;

  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID;
    if (!liffId || typeof window === "undefined") return;

    let cancelled = false;

    async function loadLiff() {
      try {
        if (!window.liff) {
          await new Promise<void>((resolve, reject) => {
            const existingScript = document.querySelector<HTMLScriptElement>("script[data-line-liff]");
            if (existingScript) {
              existingScript.addEventListener("load", () => resolve(), { once: true });
              existingScript.addEventListener("error", () => reject(new Error("LIFF SDK load failed")), { once: true });
              return;
            }

            const script = document.createElement("script");
            script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
            script.async = true;
            script.dataset.lineLiff = "true";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("LIFF SDK load failed"));
            document.head.appendChild(script);
          });
        }

        await window.liff?.init({ liffId });
        if (cancelled || !window.liff) return;

        if (!window.liff.isLoggedIn()) {
          if (window.liff.isInClient()) window.liff.login({ redirectUri: window.location.href });
          return;
        }

        const accessToken = window.liff.getAccessToken();
        if (accessToken) {
          sessionStorage.setItem("lineLiffAccessToken", accessToken);
          setLineConnected(true);
        }
      } catch (error) {
        console.warn("LIFF init failed", error);
      }
    }

    loadLiff();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleBookingStart() {
    if (!isValid) {
      alert(isEnglish ? "Please enter a valid phone number" : "請輸入有效的手機號碼");
      return;
    }

    setLoading(true);
    setContact("phone", phone);

    try {
      const phoneCandidates = phoneLookupCandidates(phone);
      const { data: customers } = await supabase
        .from("customers")
        .select("name, official_line_user_id")
        .eq("is_active", true)
        .in("phone", phoneCandidates)
        .order("updated_at", { ascending: false })
        .limit(5);

      const customer = pickBestCustomer(customers);
      const { data: booking } = customer?.name ? { data: null } : await supabase
        .from("bookings")
        .select("customer_name")
        .in("customer_phone", phoneCandidates)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setCustomerName(customer?.name || booking?.customer_name || "");
      router.push(appRoutes.customer.bookingStart);
    } catch (error) {
      console.warn("Phone lookup failed", error);
      router.push(appRoutes.customer.bookingStart);
    } finally {
      setLoading(false);
    }
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
          <div style={{
            width: "100%",
            borderRadius: 16,
            border: "1px solid rgba(6, 199, 85, 0.45)",
            background: "rgba(6, 199, 85, 0.1)",
            color: "#BFF5D1",
            padding: "12px 14px",
            boxSizing: "border-box",
            fontSize: 12,
            lineHeight: 1.7,
          }}>
            <div style={{ color: "#06C755", fontSize: 14, fontWeight: 900, marginBottom: 4 }}>
              {isEnglish ? "LINE booking notifications" : "LINE 預約通知"}
            </div>
            {lineConnected
              ? (isEnglish
                ? "LINE is connected. This booking will automatically enable LINE notifications."
                : "LINE 已連線。本次預約會自動綁定通知，之後同電話預約會收到 LINE 通知。")
              : (isEnglish
                ? "After booking, send the binding code shown on the success page to our official LINE account. You only need to bind once."
                : "預約送出後，將成功頁顯示的綁定碼傳到官方 LINE。第一次綁定後，之後同電話預約會自動收到 LINE 通知。")}
          </div>
          <button
            onClick={() => router.push(appRoutes.customer.myBookings)}
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
