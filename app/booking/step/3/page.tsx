"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { appRoutes } from "../../../../lib/appRoutes";
import { supabase } from "../../../../lib/supabase";
import { useBookingStore } from "../../../../store/bookingStore";
import { useLanguageStore } from "../../../../store/languageStore";

type OffDay = { designer_id: number; off_date: string };
type OffSlot = { designer_id: number; slot_date: string; slot_time: string };
type Booking = { designer_id: number | null; booking_date: string; booking_time: string; duration_minutes?: number | null; service_ids?: number[] | null; status?: string | null; note?: string | null };
type DurationItem = { id: number; name?: string | null; duration?: string | null };

const weekDays = {
  zh: ["日", "一", "二", "三", "四", "五", "六"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};
function pad(n: number) { return n < 10 ? "0" + n : "" + n; }

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && startB < endA;
}

function parseDurationMinutes(duration?: string | null) {
  if (!duration) return 0;
  const text = duration.replace(/\s+/g, "");
  const hourMatch = text.match(/(\d+(?:\.\d+)?)(?:小時|hr|hour)/i);
  const minuteMatch = text.match(/(\d+)(?:分鐘|分|min)/i);
  const plainNumber = text.match(/^(\d+)$/);
  const hours = hourMatch ? Number(hourMatch[1]) * 60 : 0;
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;
  if (hours || minutes) return Math.round(hours + minutes);
  return plainNumber ? Number(plainNumber[1]) : 0;
}

function getSelectedDurationMinutes(selectedServices: { duration?: string }[]) {
  const total = selectedServices.reduce((sum, service) => sum + parseDurationMinutes(service.duration), 0);
  return total > 0 ? total : 60;
}

function formatDurationMinutes(minutes: number, isEnglish: boolean) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (isEnglish) {
    return [hours ? `${hours} hr` : "", mins ? `${mins} min` : ""].filter(Boolean).join(" ") || "60 min";
  }
  return [hours ? `${hours} 小時` : "", mins ? `${mins} 分鐘` : ""].filter(Boolean).join(" ") || "60 分鐘";
}

function getBookingDurationMinutes(booking: Booking, durationItems: DurationItem[]) {
  if (booking.duration_minutes && booking.duration_minutes > 0) return booking.duration_minutes;
  const durationMap = new Map(durationItems.map((item) => [item.id, parseDurationMinutes(item.duration)]));
  const total = (booking.service_ids || []).reduce((sum, id) => sum + (durationMap.get(id) || 0), 0);
  return total > 0 ? total : 60;
}

function getSlotMinutes(workHours: string[]) {
  const sorted = [...workHours].sort();
  const gaps = sorted
    .map((time, index) => index < sorted.length - 1 ? timeToMinutes(sorted[index + 1]) - timeToMinutes(time) : 0)
    .filter((gap) => gap > 0);
  return gaps.length > 0 ? Math.min(...gaps) : 60;
}

function isBlockingBookingStatus(status?: string | null) {
  return !["cancelled", "declined", "completed"].includes(status || "");
}

export default function Step3() {
  const router = useRouter();
  const { designer, date, time, attendeeCount, selectedServices, companionSelectedServices, setDate, setTime } = useBookingStore();
  const { language } = useLanguageStore();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [offDays, setOffDays] = useState<OffDay[]>([]);
  const [offSlots, setOffSlots] = useState<OffSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [durationItems, setDurationItems] = useState<DurationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const isEnglish = language === "en";
  const requestedServices = attendeeCount === 2 ? [...selectedServices, ...companionSelectedServices] : selectedServices;
  const requestedDurationMinutes = getSelectedDurationMinutes(requestedServices);

  useEffect(() => {
    if (!designer) { router.push(appRoutes.customer.bookingStart); return; }
    Promise.all([
      supabase.from("designer_off_days").select("*"),
      supabase.from("designer_off_slots").select("*"),
      supabase.from("bookings").select("designer_id, booking_date, booking_time, duration_minutes, service_ids, status, note").eq("designer_id", designer.id),
      supabase.from("services").select("id, name, duration"),
      supabase.from("price_items").select("id, name, duration"),
      supabase.from("designer_price_items").select("id, name, duration").eq("designer_id", designer.id).eq("is_active", true),
    ]).then(([{ data: days }, { data: slots }, { data: bookingData }, { data: serviceData }, { data: priceData }, { data: designerPriceData }]) => {
      if (days) setOffDays(days);
      if (slots) setOffSlots(slots);
      if (bookingData) setBookings(bookingData);
      setDurationItems([...(serviceData || []), ...(priceData || []), ...(designerPriceData || [])]);
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

  function isTimeUnavailable(dateStr: string, t: string) {
    if (!designer) return true;
    const start = timeToMinutes(t);
    const end = start + requestedDurationMinutes;
    const sortedHours = [...(designer.work_hours || [])].sort();
    const latestEnd = sortedHours.length > 0 ? timeToMinutes(sortedHours[sortedHours.length - 1]) + getSlotMinutes(sortedHours) : 0;
    const exceedsWorkHours = latestEnd > 0 && end > latestEnd;
    const unavailableSlots = offSlots.filter((s) => s.designer_id === designer.id && s.slot_date === dateStr);
    const hasOffSlotOverlap = unavailableSlots.some((slot) => rangesOverlap(start, end, timeToMinutes(slot.slot_time), timeToMinutes(slot.slot_time) + getSlotMinutes(designer.work_hours)));
    const hasBookingOverlap = bookings
      .filter((booking) => booking.designer_id === designer.id && booking.booking_date === dateStr && isBlockingBookingStatus(booking.status))
      .some((booking) => {
        const bookingStart = timeToMinutes(booking.booking_time);
        const bookingEnd = bookingStart + getBookingDurationMinutes(booking, durationItems);
        return rangesOverlap(start, end, bookingStart, bookingEnd);
      });
    return exceedsWorkHours || hasOffSlotOverlap || hasBookingOverlap;
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
        <div style={{ color: "#7a1f1f", fontSize: 14 }}>{isEnglish ? "Loading" : "載入中"}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px 120px" }}>
      <button
        onClick={() => router.push(appRoutes.customer.bookingStep2)}
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
      <div style={{ fontSize: 20, fontWeight: 600, color: "#1a1a1a", marginBottom: 4 }}>{isEnglish ? "Choose Date & Time" : "選擇時間"}</div>
      <div style={{ fontSize: 12, color: "#9a9188", marginBottom: 20 }}>{isEnglish ? "Please choose your appointment date and time." : "請選擇預約日期與時段"}</div>
      <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 14, background: "#F7EFE9", border: "1px solid #E7D8CC", color: "#6F3E2E", fontSize: 12, fontWeight: 700, lineHeight: 1.6 }}>
        {attendeeCount === 2
          ? isEnglish
            ? `Two guests with the same stylist will reserve one continuous ${formatDurationMinutes(requestedDurationMinutes, true)} block. Available times are calculated from the next open gap.`
            : `2 人同一位設計師時，系統會依兩位服務總時長連續保留 ${formatDurationMinutes(requestedDurationMinutes, false)}，可預約時段會自動跳到下一個足夠空檔。`
          : isEnglish
            ? `This booking will reserve ${formatDurationMinutes(requestedDurationMinutes, true)}.`
            : `本次預約會保留 ${formatDurationMinutes(requestedDurationMinutes, false)}。`}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <button onClick={prevMonth} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9a6060" }}>‹</button>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>{isEnglish ? `${year} / ${pad(month)}` : `${year} 年 ${month} 月`}</span>
        <button onClick={nextMonth} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9a6060" }}>›</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 4 }}>
        {weekDays[language].map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, color: "#9a9188", padding: "2px 0" }}>{d}</div>
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
                background: isSelected ? "#7a1f1f" : isToday ? "#f2e8e6" : "#fdfaf7",
                color: isSelected ? "#fdfaf7" : disabled ? "#c4b8b0" : isSunday ? "#E24B4A" : "#1a1a1a",
                border: "0.5px solid " + (isSelected ? "#7a1f1f" : isToday ? "#d9b8b0" : "#e5dbd0"),
                fontWeight: isToday ? 600 : 400,
              }}
            >
              {day}
              {isOff && !isPast ? (
                <div style={{ fontSize: 8, color: "#c4b8b0" }}>{isEnglish ? "Off" : "休"}</div>
              ) : null}
            </div>
          );
        })}
      </div>

      {date ? (
        <div>
          <div style={{ fontSize: 12, color: "#9a9188", marginBottom: 10 }}>
            {isEnglish ? "Choose a time" : "選擇時段"} — {date.replace(/-/g, "/")}
          </div>
          <div style={{ fontSize: 11, color: "#9a9188", lineHeight: 1.5, marginBottom: 10 }}>
            {isEnglish ? "🕒 All times are GMT+8 Taiwan Standard Time." : "🕒 所有時間均為 GMT+8 台灣標準時間。"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
            {(designer?.work_hours || []).map((t) => {
              const off = isOffSlot(date, t) || isTimeUnavailable(date, t);
              const picked = time === t;
              return (
                <div
                  key={t}
                  onClick={() => { if (!off) setTime(t); }}
                  style={{
                    background: off ? "#f0e9e0" : picked ? "#7a1f1f" : "#fdfaf7",
                    border: "0.5px solid " + (picked ? "#7a1f1f" : "#e5dbd0"),
                    borderRadius: 8, padding: "8px 0", textAlign: "center",
                    fontSize: 13, color: off ? "#c4b8b0" : picked ? "#fdfaf7" : "#1a1a1a",
                    cursor: off ? "default" : "pointer",
                  }}
                >
                  {t}
                  {off ? <div style={{ fontSize: 9, color: "#c4b8b0" }}>{isEnglish ? "Full" : "已滿"}</div> : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 390, background: "#fdfaf7",
        borderTop: "0.5px solid #e5dbd0", padding: "12px 16px 24px",
        display: "flex", gap: 10,
      }}>
        <button
          onClick={() => { if (date && time) router.push(appRoutes.customer.bookingStep4); }}
          disabled={!date || !time}
          style={{
            flex: 1, padding: "13px 0",
            background: date && time ? "#7a1f1f" : "#e5dbd0",
            color: "#fdfaf7", border: "none", borderRadius: 12,
            fontSize: 15, fontWeight: 600,
            cursor: date && time ? "pointer" : "default",
          }}
        >
          {date && time ? (isEnglish ? "Next: Confirm Booking" : "下一步：確認預約") : (isEnglish ? "Please choose date and time" : "請選擇日期與時段")}
        </button>
      </div>
    </div>
  );
}
