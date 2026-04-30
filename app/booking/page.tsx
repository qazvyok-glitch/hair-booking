"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useBookingStore } from "../../store/bookingStore";

export default function BookingPhone() {
  const router = useRouter();
  const { setPhone, setCustomerName } = useBookingStore();
  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  const isPhone = mode === "phone";
  const isValid = isPhone
    ? value.replace(/\D/g, "").length >= 8
    : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  async function handleContinue() {
    if (!isValid) {
      alert(isPhone ? "請輸入有效的手機號碼" : "請輸入有效的 Email");
      return;
    }

    setLoading(true);
    setPhone(value);

    // 查詢是否為回頭客（用電話或 email 查）
    const field = isPhone ? "customer_phone" : "customer_email";
    const { data } = await supabase
      .from("bookings")
      .select("customer_name")
      .eq(field, value)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    setCustomerName(data?.customer_name ?? "");
    setLoading(false);
    router.push("/booking/step/1");
  }

  function switchMode() {
    setMode(isPhone ? "email" : "phone");
    setValue("");
  }

  return (
    <div style={{ padding: "32px 20px 120px" }}>

      {/* Icon */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "#f2e8e6", display: "flex", alignItems: "center",
          justifyContent: "center", margin: "0 auto 14px", fontSize: 28,
        }}>
          {isPhone ? "📱" : "✉️"}
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>
          {isPhone ? "輸入手機號碼" : "輸入 Email"}
        </div>
        <div style={{ fontSize: 13, color: "#9a9188", lineHeight: 1.6 }}>
          我們將以此方式確認您的預約
        </div>
      </div>

      {/* Label */}
      <div style={{ fontSize: 12, fontWeight: 600, color: "#9a9188", letterSpacing: "0.08em", marginBottom: 8 }}>
        {isPhone ? "☎ 手機號碼 Phone Number" : "✉ 電子信箱 Email"}
      </div>

      {/* Input */}
      <input
        type={isPhone ? "tel" : "email"}
        inputMode={isPhone ? "tel" : "email"}
        placeholder={isPhone ? "0912-345-678" : "example@email.com"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && isValid) handleContinue(); }}
        style={{
          width: "100%", padding: "14px 16px",
          borderRadius: 12, fontSize: 18,
          border: "1.5px solid #e5dbd0",
          background: "#fdfaf7", outline: "none",
          letterSpacing: isPhone ? "0.06em" : "0",
          color: "#1a1a1a", marginBottom: 8,
        }}
      />

      {/* Switch mode link */}
      <div style={{ marginBottom: 20, textAlign: "right" }}>
        <button
          onClick={switchMode}
          style={{
            background: "none", border: "none", padding: 0,
            fontSize: 12, color: "#9a6060", cursor: "pointer",
            textDecoration: "underline", textUnderlineOffset: 2,
          }}
        >
          {isPhone ? "無台灣手機號碼？用 Email 登入" : "返回用手機號碼登入"}
        </button>
      </div>

      {/* Notice */}
      <div style={{
        background: "#f2e8e6", border: "0.5px solid #d9b8b0",
        borderRadius: 12, padding: "12px 14px", marginBottom: 24,
        fontSize: 12, color: "#7a1f1f", lineHeight: 1.7,
      }}>
        預約確認後，我們會以{isPhone ? "電話或簡訊" : "Email"}與您聯繫。<br/>
        <span style={{ color: "#9a9188" }}>CASH ONLY 僅收現金</span>
      </div>

      {/* Continue button */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 390, background: "#fdfaf7",
        borderTop: "0.5px solid #e5dbd0", padding: "12px 16px 24px",
      }}>
        <button
          onClick={handleContinue}
          disabled={!isValid || loading}
          style={{
            width: "100%", padding: "14px 0",
            background: isValid && !loading ? "#7a1f1f" : "#e5dbd0",
            color: "#fff", border: "none", borderRadius: 12,
            fontSize: 15, fontWeight: 600,
            cursor: isValid && !loading ? "pointer" : "default",
          }}
        >
          {loading ? "查詢中..." : "繼續 Continue →"}
        </button>
      </div>
    </div>
  );
}
