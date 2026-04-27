"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type DesignerSession = { id: number; name: string; nickname: string };

const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
const allTimeSlots = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
function pad(n: number) { return n < 10 ? "0" + n : "" + n; }

export default function DesignerSchedule() {
  const router = useRouter();
  const [designer, setDesigner] = useState<DesignerSession | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [offDays, setOffDays] = useState<string[]>([]);
  const [offSlots, setOffSlots] = useState<Record<string, string[]>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const session = sessionStorage.getItem("designerSession");
    if (!session) { router.push("/designer/login"); return; }
    const d = JSON.parse(session);
    setDesigner(d);

    async function fetchData() {
      const [{ data: days }, { data: slots }] = await Promise.all([
        supabase.from("designer_off_days").select("off_date").eq("designer_id", d.id),
        supabase.from("designer_off_slots").select("slot_date, slot_time").eq("designer_id", d.id),
      ]);
      if (days) setOffDays(days.map((x: { off_date: string }) => x.off_date));
      if (slots) {
        const map: Record<string, string[]> = {};
        slots.forEach((s: { slot_date: string; slot_time: string }) => {
          if (!map[s.slot_date]) map[s.slot_date] = [];
          map[s.slot_date].push(s.slot_time);
        });
        setOffSlots(map);
      }
      setLoading(false);
    }
    fetchData();
  }, [router]);

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  async function toggleOffDay(dateStr: string) {
    if (!designer) return;
    setSaving(true);
    if (offDays.includes(dateStr)) {
      await supabase.from("designer_off_days").delete().eq("designer_id", designer.id).eq("off_date", dateStr);
      setOffDays((prev) => prev.filter((d) => d !== dateStr));
    } else {
      await supabase.from("designer_off_days").insert({ designer_id: designer.id, off_date: dateStr });
      setOffDays((prev) => [...prev, dateStr]);
      setSelectedDate(null);
    }
    setSaving(false);
  }

  async function toggleOffSlot(dateStr: string, time: string) {
    if (!designer) return;
    setSaving(true);
    const current = offSlots[dateStr] || [];
    if (current.includes(time)) {
      await supabase.from("designer_off_slots").delete().eq("designer_id", designer.id).eq("slot_date", dateStr).eq("slot_time", time);
      setOffSlots((prev) => ({ ...prev, [dateStr]: current.filter((t) => t !== time) }));
    } else {
      await supabase.from("designer_off_slots").insert({ designer_id: designer.id, slot_date: dateStr, slot_time: time });
      setOffSlots((prev) => ({ ...prev, [dateStr]: [...current, time] }));
    }
    setSaving(false);
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#534AB7", fontSize: 14 }}>載入中...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8" }}>
      {/* 頂部 */}
      <div style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.push("/designer/dashboard")} style={{ background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>‹</button>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>排班設定</div>
        {saving && <div style={{ fontSize: 11, color: "#888780", marginLeft: "auto" }}>儲存中...</div>}
      </div>

      <div style={{ padding: 16 }}>
        {/* 說明 */}
        <div style={{ background: "#FAEEDA", border: "0.5px solid #FAC775", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#633806" }}>
          點選日期設為休假日，或點開日期設定特定時段不接客
        </div>

        {/* 月份切換 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <button onClick={() => { if (month === 1) { setYear(y => y-1); setMonth(12); } else setMonth(m => m-1); setSelectedDate(null); }} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#534AB7" }}>‹</button>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#2C2C2A" }}>{year} 年 {month} 月</span>
          <button onClick={() => { if (month === 12) { setYear(y => y+1); setMonth(1); } else setMonth(m => m+1); setSelectedDate(null); }} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#534AB7" }}>›</button>
        </div>

        {/* 星期標題 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, marginBottom: 4 }}>
          {weekDays.map((d) => <div key={d} style={{ textAlign: "center", fontSize: 11, color: "#888780" }}>{d}</div>)}
        </div>

        {/* 月曆 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, marginBottom: 14 }}>
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} />;
            const dateStr = `${year}-${pad(month)}-${pad(day)}`;
            const isOff = offDays.includes(dateStr);
            const hasSlots = (offSlots[dateStr] || []).length > 0;
            const isSelected = selectedDate === dateStr;
            const isSunday = new Date(dateStr).getDay() === 0;
            return (
              <div
                key={idx}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                style={{
                  textAlign: "center", padding: "6px 2px", borderRadius: 8,
                  fontSize: 12, cursor: "pointer",
                  background: isOff ? "#FCEBEB" : isSelected ? "#EEEDFE" : "#fff",
                  color: isOff ? "#A32D2D" : isSunday ? "#E24B4A" : "#2C2C2A",
                  border: `0.5px solid ${isSelected ? "#534AB7" : isOff ? "#F09595" : "#D3D1C7"}`,
                  fontWeight: isSelected ? 600 : 400,
                  position: "relative",
                }}
              >
                {day}
                {isOff && <div style={{ fontSize: 7, color: "#A32D2D" }}>休</div>}
                {!isOff && hasSlots && <div style={{ fontSize: 7, color: "#BA7517" }}>部分</div>}
              </div>
            );
          })}
        </div>

        {/* 選擇日期後的操作 */}
        {selectedDate && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 14, border: "0.5px solid #D3D1C7" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A", marginBottom: 12 }}>
              {selectedDate.replace(/-/g, "/")} 的設定
            </div>

            <button
              onClick={() => toggleOffDay(selectedDate)}
              style={{
                width: "100%", padding: "10px 0", marginBottom: 14,
                background: offDays.includes(selectedDate) ? "#E1F5EE" : "#FCEBEB",
                color: offDays.includes(selectedDate) ? "#085041" : "#A32D2D",
                border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              {offDays.includes(selectedDate) ? "✓ 已設為休假日（點此取消）" : "設為整日休假"}
            </button>

            {!offDays.includes(selectedDate) && (
              <>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 8 }}>或選擇不接客時段：</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                  {allTimeSlots.map((t) => {
                    const blocked = (offSlots[selectedDate] || []).includes(t);
                    return (
                      <div
                        key={t}
                        onClick={() => toggleOffSlot(selectedDate, t)}
                        style={{
                          textAlign: "center", padding: "8px 0", borderRadius: 8,
                          fontSize: 12, cursor: "pointer",
                          background: blocked ? "#FCEBEB" : "#F1EFE8",
                          color: blocked ? "#A32D2D" : "#5F5E5A",
                          border: `0.5px solid ${blocked ? "#F09595" : "#D3D1C7"}`,
                          fontWeight: blocked ? 600 : 400,
                        }}
                      >
                        {t}
                        {blocked && <div style={{ fontSize: 8 }}>✕</div>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
