"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminBottomNav from "../components/BottomNav";

type Booking = {
  id: number;
  customer_name: string;
  customer_phone: string;
  booking_date: string;
  booking_time: string;
  service_ids: number[];
  note: string;
  status: string;
  reference_image_url?: string;
  designer_id: number;
  user_id: string;
};

type Customer = { id: string; phone: string; customer_no: string };

type Designer = { id: number; name: string };
type Service = { id: number; name: string };
type OffDay = { designer_id: number; off_date: string };
type OffSlot = { designer_id: number; slot_date: string; slot_time: string };
type ViewMode = "calendar" | "list";
type ScheduleRow =
  | { type: "booking"; id: number; booking: Booking; date: string; time: string; designer_id: number; status: string }
  | { type: "off-day"; id: string; date: string; time: string; designer_id: number; status: "off_day" }
  | { type: "off-slot"; id: string; date: string; time: string; designer_id: number; status: "blocked"; label: string };

function getStatusMeta(status?: string | null) {
  if (status === "confirmed") return { label: "已確認", background: "#E1F5EE", color: "#085041" };
  if (status === "completed") return { label: "已完成", background: "#E8F2FF", color: "#0B66C3" };
  if (status === "cancelled") return { label: "已取消", background: "#FCEBEB", color: "#A32D2D" };
  if (status === "off_day") return { label: "公休", background: "#FFF3DE", color: "#A85600" };
  if (status === "blocked") return { label: "不接客", background: "#EAF7FF", color: "#0B66C3" };
  return { label: "待確認", background: "#FAEEDA", color: "#633806" };
}

function getServiceNamesFromNote(note?: string | null) {
  const matched = (note || "").match(/預約服務項目：([^\n]+)/);
  return matched?.[1]?.trim() || "";
}

function buildScheduleRows(bookings: Booking[], offDays: OffDay[], offSlots: OffSlot[]): ScheduleRow[] {
  const bookingRows: ScheduleRow[] = bookings.map((booking) => ({
    type: "booking",
    id: booking.id,
    booking,
    date: booking.booking_date,
    time: booking.booking_time,
    designer_id: booking.designer_id,
    status: booking.status,
  }));
  const offDayRows: ScheduleRow[] = offDays.map((day) => ({
    type: "off-day",
    id: `off-day-${day.designer_id}-${day.off_date}`,
    date: day.off_date,
    time: "整天",
    designer_id: day.designer_id,
    status: "off_day",
  }));
  const slotsByDesignerDate = offSlots.reduce<Record<string, OffSlot[]>>((groups, slot) => {
    const key = `${slot.designer_id}-${slot.slot_date}`;
    groups[key] = [...(groups[key] || []), slot];
    return groups;
  }, {});
  const offSlotRows: ScheduleRow[] = Object.entries(slotsByDesignerDate).map(([key, slots]) => {
    const sortedSlots = slots.map((slot) => slot.slot_time).sort();
    const first = slots[0];
    const label = sortedSlots.length > 1 ? `${sortedSlots[0]}-${sortedSlots[sortedSlots.length - 1]} 不接客` : `${sortedSlots[0]} 不接客`;
    return {
      type: "off-slot",
      id: `off-slot-${key}`,
      date: first.slot_date,
      time: sortedSlots[0] || "—",
      designer_id: first.designer_id,
      status: "blocked",
      label,
    };
  });

  return [...bookingRows, ...offDayRows, ...offSlotRows].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return b.time.localeCompare(a.time);
  });
}

function formatDateKey(year: number, month: number, date: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
}

function formatDisplayDate(date: string) {
  return date.replace(/-/g, "/");
}

function getMonthCells(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (string | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => formatDateKey(year, month, index + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return { year, month, cells };
}

function getScheduleRowText(row: ScheduleRow, getDesignerName: (id: number) => string, getServiceNames: (ids: number[], note?: string | null) => string) {
  if (row.type === "off-day") return `${getDesignerName(row.designer_id)} 整天公休`;
  if (row.type === "off-slot") return `${getDesignerName(row.designer_id)} ${row.label}`;
  return `${row.time} ${getDesignerName(row.designer_id)} ${row.booking.customer_name || "訪客"} ${getServiceNames(row.booking.service_ids, row.booking.note)}`;
}

function getDaySummary(rows: ScheduleRow[]) {
  return [
    { key: "confirmed", label: "已確認", count: rows.filter((row) => row.status === "confirmed").length, color: "#37C967" },
    { key: "pending", label: "待確認", count: rows.filter((row) => row.status === "pending").length, color: "#F5B400" },
    { key: "completed", label: "已完成", count: rows.filter((row) => row.status === "completed").length, color: "#4F8FEA" },
    { key: "cancelled", label: "已取消", count: rows.filter((row) => row.status === "cancelled").length, color: "#C7001E" },
    { key: "leave", label: "公休/不接客", count: rows.filter((row) => row.type !== "booking").length, color: "#7C7C83" },
  ].filter((item) => item.count > 0);
}

export default function AdminBookings() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDesigner, setFilterDesigner] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [offDays, setOffDays] = useState<OffDay[]>([]);
  const [offSlots, setOffSlots] = useState<OffSlot[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toLocaleDateString("en-CA").slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(() => new Date().toLocaleDateString("en-CA"));

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const session = sessionStorage.getItem("adminSession");
    if (!session) { router.push("/admin/login"); return; }

    async function fetchData() {
      const [{ data: bData }, { data: dData }, { data: sData }, { data: cData }, { data: offDayData }, { data: offSlotData }] = await Promise.all([
        supabase.from("bookings").select("*").order("booking_date", { ascending: false }).order("booking_time", { ascending: false }),
        supabase.from("designers").select("id, name").order("sort_order", { nullsFirst: false }).order("id"),
        supabase.from("services").select("id, name"),
        supabase.from("customers").select("id, phone, customer_no"),
        supabase.from("designer_off_days").select("designer_id, off_date"),
        supabase.from("designer_off_slots").select("designer_id, slot_date, slot_time"),
      ]);
      if (bData) setBookings(bData);
      if (dData) setDesigners(dData);
      if (sData) setServices(sData);
      if (cData) setCustomers(cData);
      if (offDayData) setOffDays(offDayData);
      if (offSlotData) setOffSlots(offSlotData);
      setLoading(false);
    }
    fetchData();
  }, [router]);

  function getDesignerName(id: number) {
    if (!id) return "不指定";
    return designers.find(d => d.id === id)?.name || "—";
  }

  function getCustomerNo(phone: string) {
    if (!phone) return null;
    return customers.find(c => c.phone === phone)?.customer_no || null;
  }

  function getServiceNames(ids: number[], note?: string | null) {
    const noteServiceNames = getServiceNamesFromNote(note);
    if (noteServiceNames) return noteServiceNames;
    if (!ids || ids.length === 0) return "—";
    return ids.map(id => services.find(s => s.id === id)?.name || "").filter(Boolean).join("、");
  }

  async function updateStatus(id: number, status: string) {
    await supabase.from("bookings").update({ status }).eq("id", id);
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
  }

  const scheduleRows = buildScheduleRows(bookings, offDays, offSlots);
  const filterRows = (row: ScheduleRow, includeDate: boolean) => {
    if (filterStatus !== "all" && row.status !== filterStatus) return false;
    if (filterDesigner !== "all" && String(row.designer_id) !== filterDesigner) return false;
    if (includeDate && filterDate && row.date !== filterDate) return false;
    if (search) {
      if (row.type !== "booking") return false;
      const b = row.booking;
      if (!b.customer_name?.includes(search) && !b.customer_phone?.includes(search)) return false;
    }
    return true;
  };
  const filtered = scheduleRows.filter((row) => filterRows(row, true));
  const calendarRows = scheduleRows.filter((row) => filterRows(row, false));
  const { year: calendarYear, month: calendarMonthNumber, cells: calendarCells } = getMonthCells(calendarMonth);
  const monthRows = calendarRows.filter((row) => row.date.slice(0, 7) === calendarMonth);
  const selectedDayRows = calendarRows.filter((row) => row.date === selectedDate);

  function changeCalendarMonth(offset: number) {
    const [year, month] = calendarMonth.split("-").map(Number);
    const next = new Date(year, month - 1 + offset, 1);
    const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
    setCalendarMonth(nextMonth);
    setSelectedDate(formatDateKey(next.getFullYear(), next.getMonth() + 1, 1));
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#534AB7", fontSize: 14 }}>載入中...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", paddingBottom: 70, paddingLeft: isDesktop ? 220 : 0 }}>
      <div style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => router.push("/admin/dashboard")} style={{ background: "#2C2C2A", color: "#fff", border: "1px solid #5F5E5A", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>← 返回</button>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>預約管理</div>
        </div>
        <div style={{ fontSize: 12, color: "#888780" }}>共 {filtered.length} 筆</div>
      </div>

      <div style={{ padding: "12px 16px 0" }}>
        {/* 搜尋 */}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜尋客人姓名或電話..." style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 10 }} />

        {/* 篩選 */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 12, outline: "none", background: "#fff" }}>
            <option value="all">全部狀態</option>
            <option value="pending">待確認</option>
            <option value="confirmed">已確認</option>
            <option value="completed">已完成</option>
            <option value="cancelled">已取消</option>
            <option value="off_day">公休</option>
            <option value="blocked">不接客</option>
          </select>
          <select value={filterDesigner} onChange={(e) => setFilterDesigner(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 12, outline: "none", background: "#fff" }}>
            <option value="all">全部設計師</option>
            {designers.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
          </select>
          <input type="date" value={filterDate} onChange={(e) => { setFilterDate(e.target.value); if (e.target.value) { setSelectedDate(e.target.value); setCalendarMonth(e.target.value.slice(0, 7)); } }} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 12, outline: "none" }} />
          {(filterStatus !== "all" || filterDesigner !== "all" || filterDate || search) && (
            <button onClick={() => { setFilterStatus("all"); setFilterDesigner("all"); setFilterDate(""); setSearch(""); }} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "#FCEBEB", color: "#A32D2D", fontSize: 12, cursor: "pointer" }}>清除篩選</button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6, background: "#fff", border: "0.5px solid #D3D1C7", borderRadius: 10, padding: 3 }}>
            {(["calendar", "list"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  border: "none",
                  borderRadius: 8,
                  padding: "7px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: viewMode === mode ? "#534AB7" : "transparent",
                  color: viewMode === mode ? "#fff" : "#5F5E5A",
                }}
              >
                {mode === "calendar" ? "月曆" : "列表"}
              </button>
            ))}
          </div>
          {viewMode === "calendar" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => changeCalendarMonth(-1)} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid #D3D1C7", background: "#fff", cursor: "pointer", fontSize: 18 }}>‹</button>
              <button onClick={() => { const today = new Date().toLocaleDateString("en-CA"); setCalendarMonth(today.slice(0, 7)); setSelectedDate(today); }} style={{ height: 34, borderRadius: 8, border: "1px solid #D3D1C7", background: "#fff", cursor: "pointer", fontSize: 12, padding: "0 14px" }}>今天</button>
              <button onClick={() => changeCalendarMonth(1)} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid #D3D1C7", background: "#fff", cursor: "pointer", fontSize: 18 }}>›</button>
            </div>
          )}
        </div>

        {viewMode === "calendar" && (
          <>
            <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #D3D1C7", padding: 14, marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                {getDaySummary(monthRows).map((item) => (
                  <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 6, color: "#5F5E5A", fontSize: 12, fontWeight: 600 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: item.color }} />
                    <span>{item.count} {item.label}</span>
                  </div>
                ))}
                {monthRows.length === 0 && <div style={{ color: "#888780", fontSize: 12 }}>本月目前沒有預約或公休資料</div>}
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #D3D1C7", overflow: "hidden", marginBottom: 12 }}>
              <div style={{ padding: "14px 16px", display: "flex", justifyContent: "center", alignItems: "center", borderBottom: "0.5px solid #E8E5DA" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#2C2C2A" }}>{calendarYear}年{calendarMonthNumber}月</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "#FAF9F5", borderBottom: "0.5px solid #E8E5DA" }}>
                {["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"].map((day) => (
                  <div key={day} style={{ padding: "8px 4px", textAlign: "center", fontSize: isDesktop ? 13 : 10, fontWeight: 700, color: "#2C2C2A" }}>{isDesktop ? day : day.replace("星期", "")}</div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
                {calendarCells.map((date, index) => {
                  if (!date) return <div key={`empty-${index}`} style={{ minHeight: isDesktop ? 118 : 86, borderRight: "0.5px solid #E8E5DA", borderBottom: "0.5px solid #E8E5DA", background: "#FBFAF7" }} />;
                  const rows = calendarRows.filter((row) => row.date === date);
                  const day = Number(date.split("-")[2]);
                  const isSelected = selectedDate === date;
                  const isSunday = new Date(`${date}T00:00:00`).getDay() === 0;
                  return (
                    <button
                      key={date}
                      onClick={() => { setSelectedDate(date); setFilterDate(""); }}
                      style={{
                        minHeight: isDesktop ? 118 : 86,
                        border: "none",
                        borderRight: "0.5px solid #E8E5DA",
                        borderBottom: "0.5px solid #E8E5DA",
                        background: isSelected ? "#F4E6F1" : "#fff",
                        padding: isDesktop ? 8 : 5,
                        textAlign: "left",
                        cursor: "pointer",
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ textAlign: "right", color: isSunday ? "#D27D7D" : "#888780", fontSize: isDesktop ? 16 : 12, fontWeight: 700, marginBottom: 6 }}>{day}日</div>
                      {getDaySummary(rows).slice(0, isDesktop ? 4 : 3).map((item) => (
                        <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: isDesktop ? 12 : 9, fontWeight: 600, color: "#6B6860", lineHeight: 1.35, whiteSpace: "nowrap" }}>
                          <span style={{ width: 7, height: 7, borderRadius: 99, background: item.color, flex: "0 0 auto" }} />
                          <span>{item.count} {item.label}</span>
                        </div>
                      ))}
                      {rows.length > 0 && getDaySummary(rows).length === 0 && <div style={{ fontSize: 11, color: "#888780" }}>{rows.length} 筆</div>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #D3D1C7", overflow: "hidden", marginBottom: 12 }}>
              <div style={{ padding: "12px 14px", background: "#FAF9F5", borderBottom: "0.5px solid #E8E5DA", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#2C2C2A" }}>{formatDisplayDate(selectedDate)} 明細</div>
                  <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>預約、公休與不接客時段整合顯示</div>
                </div>
                <div style={{ fontSize: 12, color: "#888780" }}>共 {selectedDayRows.length} 筆</div>
              </div>
              {selectedDayRows.length > 0 ? selectedDayRows.map((row) => {
                const statusMeta = getStatusMeta(row.status);
                return (
                  <div key={`detail-${row.id}`} style={{ display: "grid", gridTemplateColumns: isDesktop ? "86px 1fr 96px" : "62px 1fr", gap: 10, alignItems: "center", padding: "12px 14px", borderTop: "0.5px solid #F1EFE8" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#2C2C2A" }}>{row.time}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#2C2C2A" }}>{getScheduleRowText(row, getDesignerName, getServiceNames)}</div>
                      {row.type === "booking" && <div style={{ fontSize: 11, color: "#888780", marginTop: 3 }}>{row.booking.customer_phone || "未填電話"}</div>}
                    </div>
                    <span style={{ justifySelf: isDesktop ? "end" : "start", fontSize: 11, padding: "3px 8px", borderRadius: 10, fontWeight: 600, background: statusMeta.background, color: statusMeta.color }}>
                      {statusMeta.label}
                    </span>
                  </div>
                );
              }) : (
                <div style={{ padding: 18, color: "#888780", fontSize: 13 }}>這一天目前沒有預約或公休資料</div>
              )}
            </div>
          </>
        )}

        {/* 預約列表 */}
        {viewMode === "list" && (isDesktop ? (
          <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #D3D1C7", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F1EFE8" }}>
                  {["日期", "時段", "客人", "電話", "設計師", "服務", "圖片", "狀態", "操作"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", fontSize: 12, color: "#888780", fontWeight: 600, textAlign: "left", borderBottom: "0.5px solid #D3D1C7" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const statusMeta = getStatusMeta(row.status);
                  if (row.type !== "booking") {
                    return (
                      <tr key={row.id} style={{ borderBottom: "0.5px solid #F1EFE8", background: row.type === "off-day" ? "#FFFBF3" : "#F8FBFF" }}>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "#2C2C2A" }}>{row.date.replace(/-/g, "/")}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "#2C2C2A" }}>{row.time}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "#888780" }}>—</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "#888780" }}>—</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "#2C2C2A" }}>{getDesignerName(row.designer_id)}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12, color: "#5F5E5A", maxWidth: 200 }}>{row.type === "off-day" ? "整天公休" : row.label}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12 }}>—</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 10, fontWeight: 500, background: statusMeta.background, color: statusMeta.color }}>
                            {statusMeta.label}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 12, color: "#888780" }}>—</td>
                      </tr>
                    );
                  }
                  const b = row.booking;
                  return (
                  <tr key={b.id} style={{ borderBottom: "0.5px solid #F1EFE8" }}>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#2C2C2A" }}>{b.booking_date.replace(/-/g, "/")}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#2C2C2A" }}>{b.booking_time}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#2C2C2A" }}>{b.customer_name || "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#888780" }}>{b.customer_phone || "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#2C2C2A" }}>{getDesignerName(b.designer_id)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "#5F5E5A", maxWidth: 200 }}>{getServiceNames(b.service_ids, b.note)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12 }}>
                      {b.reference_image_url ? (
                        <a href={b.reference_image_url} target="_blank" rel="noreferrer" style={{ color: "#534AB7", fontWeight: 600, textDecoration: "none" }}>查看</a>
                      ) : "—"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 10, fontWeight: 500, background: statusMeta.background, color: statusMeta.color }}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {b.status === "pending" && (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => updateStatus(b.id, "confirmed")} style={{ padding: "4px 8px", background: "#534AB7", color: "#fff", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>確認</button>
                          <button onClick={() => updateStatus(b.id, "cancelled")} style={{ padding: "4px 8px", background: "#FCEBEB", color: "#A32D2D", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>取消</button>
                        </div>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          filtered.map((row) => {
            const statusMeta = getStatusMeta(row.status);
            if (row.type !== "booking") {
              return (
                <div key={row.id} style={{ background: row.type === "off-day" ? "#FFFBF3" : "#F8FBFF", borderRadius: 14, padding: 14, marginBottom: 8, border: "0.5px solid #D3D1C7" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#2C2C2A" }}>{getDesignerName(row.designer_id)}</div>
                      <div style={{ fontSize: 12, color: "#888780" }}>{row.date.replace(/-/g, "/")} {row.time}</div>
                    </div>
                    <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 10, fontWeight: 500, height: "fit-content", background: statusMeta.background, color: statusMeta.color }}>
                      {statusMeta.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#5F5E5A" }}>{row.type === "off-day" ? "整天公休" : row.label}</div>
                </div>
              );
            }
            const b = row.booking;
            return (
            <div key={b.id} style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 8, border: "0.5px solid #D3D1C7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#2C2C2A" }}>{b.customer_name || "訪客"}</div>
                  <div style={{ fontSize: 12, color: "#888780" }}>{b.customer_phone}</div>
                  {getCustomerNo(b.customer_phone) && (
                    <div style={{ fontSize: 10, color: "#534AB7", background: "#EEEDFE", borderRadius: 4, padding: "1px 6px", display: "inline-block", marginTop: 2 }}>{getCustomerNo(b.customer_phone)}</div>
                  )}
                </div>
                <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 10, fontWeight: 500, height: "fit-content", background: statusMeta.background, color: statusMeta.color }}>
                  {statusMeta.label}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#5F5E5A", marginBottom: 2 }}>📅 {b.booking_date.replace(/-/g, "/")} {b.booking_time}</div>
              <div style={{ fontSize: 12, color: "#5F5E5A", marginBottom: 2 }}>設計師：{getDesignerName(b.designer_id)}</div>
              <div style={{ fontSize: 12, color: "#5F5E5A" }}>服務：{getServiceNames(b.service_ids, b.note)}</div>
              {b.reference_image_url && (
                <a href={b.reference_image_url} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 8, textDecoration: "none" }}>
                  <div style={{ fontSize: 11, color: "#534AB7", fontWeight: 600, marginBottom: 5 }}>查看參考圖片</div>
                  <img src={b.reference_image_url} alt="參考圖片" style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 10, border: "0.5px solid #D3D1C7" }} />
                </a>
              )}
              {b.status === "pending" && (
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button onClick={() => updateStatus(b.id, "confirmed")} style={{ flex: 1, padding: "8px 0", background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>確認</button>
                  <button onClick={() => updateStatus(b.id, "cancelled")} style={{ flex: 1, padding: "8px 0", background: "#FCEBEB", color: "#A32D2D", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>取消</button>
                </div>
              )}
            </div>
            );
          })
        ))}
      </div>

      <AdminBottomNav current="bookings" />
    </div>
  );
}
