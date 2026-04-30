"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "../../../../lib/supabase";
import { useBookingStore } from "../../../../store/bookingStore";

export default function Step4() {
  const router = useRouter();
  const { phone, designer, serviceIds, date, time, reset } = useBookingStore();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!designer || !date || !time) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <div style={{ color: "#9a9188", fontSize: 14, marginBottom: 16 }}>請從第一步開始預約</div>
        <button
          onClick={() => router.push("/booking")}
          style={{ background: "#7a1f1f", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontSize: 14, cursor: "pointer" }}
        >
          重新開始
        </button>
      </div>
    );
  }

  async function handleSubmit() {
    if (!name) { alert("請填寫姓名"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("bookings").insert({
      designer_id: designer!.id === 0 ? null : designer!.id,
      service_ids: serviceIds,
      booking_date: date,
      booking_time: time,
      customer_name: name,
      customer_phone: phone,
      note: note,
    });
    if (error) {
      alert("預約失敗，請再試一次");
      setSubmitting(false);
      return;
    }
    sessionStorage.setItem("lastBooking", JSON.stringify({
      designerName: designer!.name,
      designerNickname: designer!.nickname,
      date,
      time,
    }));
    router.push("/booking/success");
    setTimeout(() => reset(), 1000);
  }

  return (
    <div style={{ padding: "20px 16px 120px" }}>
      <div style={{ fontSize: 20, fontWeight: 600, color: "#1a1a1a", marginBottom: 4 }}>確認預約</div>
      <div style={{ fontSize: 12, color: "#9a9188", marginBottom: 20 }}>請確認資訊後送出</div>

      {/* 預約摘要 */}
      <div style={{
        background: "#f2e8e6", border: "0.5px solid #d9b8b0",
        borderRadius: 14, padding: "16px", marginBottom: 20,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "0.5px solid #e5dbd0" }}>
          <span style={{ fontSize: 12, color: "#9a9188" }}>手機號碼</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{phone}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "0.5px solid #e5dbd0" }}>
          <span style={{ fontSize: 12, color: "#9a9188" }}>設計師</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{designer.name}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "0.5px solid #e5dbd0" }}>
          <span style={{ fontSize: 12, color: "#9a9188" }}>日期</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{date?.replace(/-/g, "/")}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
          <span style={{ fontSize: 12, color: "#9a9188" }}>時段</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{time}</span>
        </div>
      </div>

      {/* 姓名 */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "#9a9188", marginBottom: 6 }}>姓名</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="王小明"
          style={{
            width: "100%", padding: "11px 14px", borderRadius: 10,
            border: "1px solid #e5dbd0", fontSize: 14,
            background: "#fdfaf7", outline: "none", color: "#1a1a1a",
          }}
        />
      </div>

      {/* 備註 */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "#9a9188", marginBottom: 6 }}>備註（選填）</div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="特殊需求、參考圖片..."
          style={{
            width: "100%", padding: "11px 14px", borderRadius: 10,
            border: "1px solid #e5dbd0", fontSize: 14,
            background: "#fdfaf7", outline: "none", height: 80, resize: "none", color: "#1a1a1a",
          }}
        />
      </div>

      <div style={{ fontSize: 11, color: "#9a9188", textAlign: "center", marginBottom: 8 }}>
        實際價格由設計師現場確認 ｜ CASH ONLY 僅收現金
      </div>

      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 390, background: "#fdfaf7",
        borderTop: "0.5px solid #e5dbd0", padding: "12px 16px 24px",
        display: "flex", gap: 10,
      }}>
        <button
          onClick={() => router.push("/booking/step/3")}
          style={{
            padding: "13px 18px", background: "#f0e9e0",
            color: "#4a4a4a", border: "none", borderRadius: 12,
            fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          ← 上一步
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            flex: 1, padding: "13px 0",
            background: submitting ? "#e5dbd0" : "#7a1f1f",
            color: "#fff", border: "none", borderRadius: 12,
            fontSize: 15, fontWeight: 600,
            cursor: submitting ? "default" : "pointer",
          }}
        >
          {submitting ? "送出中..." : "確認送出預約"}
        </button>
      </div>
    </div>
  );
}
