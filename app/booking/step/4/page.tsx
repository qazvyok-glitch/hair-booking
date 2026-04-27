"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "../../../../lib/supabase";
import { useBookingStore } from "../../../../store/bookingStore";

export default function Step4() {
  const router = useRouter();
  const { designer, serviceIds, date, time, reset } = useBookingStore();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!designer || !date || !time) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <div style={{ color: "#888780", fontSize: 14, marginBottom: 16 }}>請從第一步開始預約</div>
        <button
          onClick={() => router.push("/booking/step/1")}
          style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontSize: 14, cursor: "pointer" }}
        >
          重新開始
        </button>
      </div>
    );
  }

  async function handleSubmit() {
    if (!name || !phone) { alert("請填寫姓名與手機號碼"); return; }
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
      <div style={{ fontSize: 20, fontWeight: 600, color: "#2C2C2A", marginBottom: 4 }}>確認預約</div>
      <div style={{ fontSize: 12, color: "#888780", marginBottom: 20 }}>請確認資訊後送出</div>

      <div style={{
        background: "#EEEDFE", border: "0.5px solid #AFA9EC",
        borderRadius: 14, padding: "16px", marginBottom: 20,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "0.5px solid #D3D1C7" }}>
          <span style={{ fontSize: 12, color: "#888780" }}>設計師</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A" }}>{designer.name}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "0.5px solid #D3D1C7" }}>
          <span style={{ fontSize: 12, color: "#888780" }}>日期</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A" }}>{date?.replace(/-/g, "/")}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
          <span style={{ fontSize: 12, color: "#888780" }}>時段</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A" }}>{time}</span>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "#888780", marginBottom: 6 }}>姓名</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="王小明"
          style={{
            width: "100%", padding: "11px 14px", borderRadius: 10,
            border: "1px solid #D3D1C7", fontSize: 14,
            background: "#fff", outline: "none",
          }}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "#888780", marginBottom: 6 }}>手機號碼</div>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="0912-345-678"
          type="tel"
          style={{
            width: "100%", padding: "11px 14px", borderRadius: 10,
            border: "1px solid #D3D1C7", fontSize: 14,
            background: "#fff", outline: "none",
          }}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "#888780", marginBottom: 6 }}>備註（選填）</div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="特殊需求、參考圖片..."
          style={{
            width: "100%", padding: "11px 14px", borderRadius: 10,
            border: "1px solid #D3D1C7", fontSize: 14,
            background: "#fff", outline: "none", height: 80, resize: "none",
          }}
        />
      </div>

      <div style={{ fontSize: 11, color: "#888780", textAlign: "center", marginBottom: 8 }}>
        實際價格由設計師現場確認
      </div>

      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 390, background: "#fff",
        borderTop: "0.5px solid #D3D1C7", padding: "12px 16px 24px",
        display: "flex", gap: 10,
      }}>
        <button
          onClick={() => router.push("/booking/step/3")}
          style={{
            padding: "13px 18px", background: "#F1EFE8",
            color: "#5F5E5A", border: "none", borderRadius: 12,
            fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          上一步
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            flex: 1, padding: "13px 0",
            background: submitting ? "#D3D1C7" : "#534AB7",
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