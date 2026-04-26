"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { useBookingStore } from "../../../../store/bookingStore";

type OffDay = { designer_id: number; off_date: string };
type OffSlot = { designer_id: number; slot_date: string; slot_time: string };

const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
function pad(n: number) { return n < 10 ? "0" + n : "" + n; }

export default function Step3() {
  const router = useRouter();
  const { designer, date, time, setDate, setTime } = useBookingStore();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [offDays, setOffDays] = useState<OffDay[]>([]);
  const [offSlots, setOffSlots] = useState<OffSlot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!designer) { router.push("/booking/step/1"); return; }
    Promise.all([
      supabase.from("designer_off_days").select("*"),
      supabase.from("designer_off_slots").select("*"),
    ]).then(([{ data: days }, { data: slots }]) => {
      if (days) setOffDays(days);
      if (slots) setOffSlots(slots);
      setLoading(false);
    });
  }, [designer, router]);

  function isOffDay(dateStr: string) {
    if (!designer) return false;
    return offDays.some((d) => d.designer_id === designer.id && d.off_date === dateStr);
  }
  function isOffSlot(dateStr: string, t: string) {
    if (!designer) return false;
    return offSlots.some((s) => s.designer_id === designer.id && s.slot_date === dateStr && s.slot_time === t);
  }

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
    setDate("");
    setTime("");
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
    setDate("");
    setTime("");
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
        <div style={{ color: "#534AB7", fontSize: 14 }}>載入中</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px 120px" }}>
      <div style={{ fontSize: 20, fontWeight: 600, color: "#2C2C2A", marginBottom: 4 }}>選擇時間</div>
      <div style={{ fontSize: 12, color: "#888780", marginBottom: 20 }}>請選擇預約日期與時段</div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <button onClick={prevMonth} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#7B6FD4" }}>‹</button>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#2C2C2A" }}>{year} 年 {month} 月</span>
        <button onClick={nextMonth} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#7B6FD4" }}>›</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 4 }}>
        {weekDays.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, color: "#888780", padding: "2px 0" }}>{d}</div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 16 }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />;
          const dateStr = `${year}-${pad(month)}-${pad(day)}`;
          const isPast = new Date(dateStr) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const isOff = isOffDay(dateStr);
          const isSelected = date === dateStr;
          const isSunday = new Date(dateStr).getDay() === 0;
          const disabled = isPast || isOff;
          const isToday = dateStr === `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
          return (
            <div
              key={idx}
              onClick={() => { if (!disabled) { setDate(dateStr); setTime(""); } }}
              style={{
                textAlign: "center", padding: "6px 0", borderRadius: 8,
                fontSize: 13, cursor: disabled ? "default" : "pointer",
                background: isSelected ? "#534AB7" : isToday ? "#EEEDFE" : "#fff",
                color: isSelected ? "#fff" : disabled ? "#C8C6BE" : isSunday ? "#E24B4A" : "#2C2C2A",
                border: "0.5px solid " + (isSelected ? "#534AB7" : isToday ? "#AFA9EC" : "#D3D1C7"),
                fontWeight: isToday ? 600 : 400,
              }}
            >
              {day}
              {isOff && !isPast ? (
                <div style={{ fontSize: 8, color: "#C8C6BE" }}>休</div>
              ) : null}
            </div>
          );
        })}
      </div>

      {date ? (
        <div>
          <div style={{ fontSize: 12, color: "#888780", marginBottom: 10 }}>
            選擇時段 — {date.replace(/-/g, "/")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
            {(designer?.work_hours || []).map((t) => {
              const off = isOffSlot(date, t);
              const picked = time === t;
              return (
                <div
                  key={t}
                  onClick={() => { if (!off) setTime(t); }}
                  style={{
                    background: off ? "#F1EFE8" : picked ? "#534AB7" : "#fff",
                    border: "0.5px solid " + (picked ? "#534AB7" : "#D3D1C7"),
                    borderRadius: 8, padding: "8px 0", textAlign: "center",
                    fontSize: 13, color: off ? "#C8C6BE" : picked ? "#fff" : "#2C2C2A",
                    cursor: off ? "default" : "pointer",
                  }}
                >
                  {t}
                  {off ? <div style={{ fontSize: 9, color: "#C8C6BE" }}>已滿</div> : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 390, background: "#fff",
        borderTop: "0.5px solid #D3D1C7", padding: "12px 16px 24px",
        display: "flex", gap: 10,
      }}>
        <button
          onClick={() => router.push("/booking/step/2")}
          style={{
            padding: "13px 18px", background: "#F1EFE8",
            color: "#5F5E5A", border: "none", borderRadius: 12,
            fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          上一步
        </button>
        <button
          onClick={() => { if (date && time) router.push("/booking/step/4"); }}
          disabled={!date || !time}
          style={{
            flex: 1, padding: "13px 0",
            background: date && time ? "#534AB7" : "#D3D1C7",
            color: "#fff", border: "none", borderRadius: 12,
            fontSize: 15, fontWeight: 600,
            cursor: date && time ? "pointer" : "default",
          }}
        >
          {date && time ? "下一步：確認預約" : "請選擇日期與時段"}
        </button>
      </div>
    </div>
  );
}