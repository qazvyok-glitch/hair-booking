"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useBookingStore } from "../../store/bookingStore";

export default function BookingPhone() {
  const router = useRouter();
  const { setPhone, setCustomerName } = useBookingStore();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length < 8) { alert("請輸入有效的手機號碼"); return; }

    setLoading(true);
    setPhone(value);

    // 查詢是否為回頭客
    const { data } = await supabase
      .from("bookings")
      .select("customer_name")
      .eq("customer_phone", value)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (data?.customer_name) {
      setCustomerName(data.customer_name);
    } else {
      setCustomerName("");
    }

    setLoading(false);
    router.push("/booking/step/1");
  }

  const isValid = value.replace(/\D/g, "").length >= 8;

  return (
    <div style={{ padding: "32px 20px 120px" }}>

      {/* Icon */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "#f2e8e6", display: "flex", alignItems: "center",
          justifyContent: "center", margin: "0 auto 14px", fontSize: 28,
        }}>📱</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>
          輸入手機號碼
        </div>
        <div style={{ fontSize: 13, color: "#9a9188", lineHeight: 1.6 }}>
          我們將以電話或簡訊確認您的預約
        </div>
      </div>

      {/* Phone label */}
      <div style={{ fontSize: 12, fontWeight: 600, color: "#9a9188", letterSpacing: "0.08em", marginBottom: 8 }}>
        ☎ 手機號碼 Phone Number
      </div>

      {/* Input */}
      <input
        type="tel"
        inputMode="tel"
        placeholder="0912-345-678"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && isValid) handleContinue(); }}
        style={{
          width: "100%", padding: "14px 16px",
          borderRadius: 12, fontSize: 18,
          border: "1.5px solid #e5dbd0",
          background: "#fdfaf7", outline: "none",
          letterSpacing: "0.06em", color: "#1a1a1a",
          marginBottom: 16,
        }}
      />

      {/* SMS notice */}
      <div style={{
        background: "#f2e8e6", border: "0.5px solid #d9b8b0",
        borderRadius: 12, padding: "12px 14px", marginBottom: 24,
        fontSize: 12, color: "#7a1f1f", lineHeight: 1.7,
      }}>
        預約確認後，我們會以電話或簡訊與您聯繫。<br/>
        <span style={{ color: "#9a9188" }}>CASH ONLY 僅收現金</span>
      </div>

      {/* Continue button (fixed) */}
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
