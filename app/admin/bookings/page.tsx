"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminBottomNav from "../components/BottomNav";

type Booking = {
  id: number;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  booking_date: string;
  booking_time: string;
  service_ids: number[];
  note: string;
  status: string;
  reference_image_url?: string;
  designer_id: number;
  user_id: string;
  duration_minutes?: number | null;
  is_test_data: boolean;
  locked_at?: string | null;
};

type Customer = { id: string; phone: string; customer_no: string };

type Designer = { id: number; name: string };
type Service = { id: number; name: string };
type OffDay = { designer_id: number; off_date: string };
type OffSlot = { designer_id: number; slot_date: string; slot_time: string };
type ViewMode = "calendar" | "list";
type AuditLog = {
  id: number;
  booking_id: number;
  action: "created" | "updated" | "status_changed" | "deleted" | "unlocked" | "relocked";
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  actor_username: string;
  actor_role: string;
  is_test_data: boolean;
  created_at: string;
  reason?: string | null;
};
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

const auditFieldLabels: Record<string, string> = {
  customer_name: "客戶姓名",
  customer_phone: "客戶電話",
  customer_email: "客戶信箱",
  designer_id: "設計師",
  booking_date: "預約日期",
  booking_time: "預約時間",
  duration_minutes: "服務時間",
  service_ids: "服務項目",
  note: "預約備註",
  status: "預約狀態",
  reference_image_url: "參考圖片",
  locked_at: "鎖定時間",
};

function getAuditActionLabel(action: AuditLog["action"]) {
  if (action === "created") return "建立預約";
  if (action === "status_changed") return "變更狀態";
  if (action === "deleted") return "刪除預約";
  if (action === "unlocked") return "解除鎖定";
  if (action === "relocked") return "完成更正並鎖定";
  return "修改資料";
}

function formatAuditValue(key: string, value: unknown, designers: Designer[], services: Service[]) {
  if (value === null || value === undefined || value === "") return "未填寫";
  if (key === "designer_id") return designers.find((item) => item.id === Number(value))?.name || String(value);
  if (key === "service_ids" && Array.isArray(value)) {
    return value.map((id) => services.find((item) => item.id === Number(id))?.name || String(id)).join("、") || "未填寫";
  }
  if (key === "duration_minutes") return `${value} 分鐘`;
  if (key === "status") return getStatusMeta(String(value)).label;
  if (typeof value === "boolean") return value ? "是" : "否";
  if (Array.isArray(value)) return value.join("、");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getAuditChanges(log: AuditLog) {
  if (log.action === "unlocked" || log.action === "relocked") return [];
  const before = log.before_data || {};
  const after = log.after_data || {};
  const source = log.action === "deleted" ? before : after;
  const keys = log.action === "updated" || log.action === "status_changed"
    ? Object.keys(auditFieldLabels).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    : Object.keys(auditFieldLabels).filter((key) => source[key] !== null && source[key] !== undefined && source[key] !== "");
  return keys.map((key) => ({ key, before: before[key], after: after[key] }));
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
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "calendar";
    return new URLSearchParams(window.location.search).get("view") === "list" ? "list" : "calendar";
  });
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toLocaleDateString("en-CA").slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [dataMode, setDataMode] = useState<"test" | "live">("test");
  const [auditBooking, setAuditBooking] = useState<Booking | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [isOwner] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return JSON.parse(sessionStorage.getItem("adminSession") || "{}").role !== "manager"; } catch { return false; }
  });
  const [unlockReason, setUnlockReason] = useState("");
  const [correctionSummary, setCorrectionSummary] = useState("");
  const [correctionBusy, setCorrectionBusy] = useState(false);
  const [correctionDraft, setCorrectionDraft] = useState({ customer_name: "", customer_phone: "", customer_email: "", designer_id: "", booking_date: "", booking_time: "", duration_minutes: "60", service_ids: [] as number[], note: "" });

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
      const [{ data: bData }, { data: dData }, { data: sData }, { data: cData }, { data: offDayData }, { data: offSlotData }, { data: configData }] = await Promise.all([
        supabase.from("bookings").select("*").order("booking_date", { ascending: false }).order("booking_time", { ascending: false }),
        supabase.from("designers").select("id, name").order("sort_order", { nullsFirst: false }).order("id"),
        supabase.from("services").select("id, name"),
        supabase.from("customers").select("id, phone, customer_no"),
        supabase.from("designer_off_days").select("designer_id, off_date"),
        supabase.from("designer_off_slots").select("designer_id, slot_date, slot_time"),
        supabase.from("booking_system_config").select("data_mode").eq("singleton", true).maybeSingle(),
      ]);
      if (bData) setBookings(bData);
      if (dData) setDesigners(dData);
      if (sData) setServices(sData);
      if (cData) setCustomers(cData);
      if (offDayData) setOffDays(offDayData);
      if (offSlotData) setOffSlots(offSlotData);
      if (configData?.data_mode === "live") setDataMode("live");
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
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) {
      alert(error.message.includes("BOOKING_TIME_CONFLICT") ? "此設計師在該時段已有預約，請先調整時間。" : "預約狀態更新失敗，請稍後再試。");
      return;
    }
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
    if (status === "confirmed") {
      fetch("/api/line/notify-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: id }),
      }).catch((notifyError) => {
        console.warn("LINE booking confirmation notification failed", notifyError);
      });
    }
  }

  async function openAuditLog(booking: Booking) {
    setAuditBooking(booking);
    setUnlockReason("");
    setCorrectionSummary("");
    setCorrectionDraft({
      customer_name: booking.customer_name || "",
      customer_phone: booking.customer_phone || "",
      customer_email: booking.customer_email || "",
      designer_id: booking.designer_id ? String(booking.designer_id) : "",
      booking_date: booking.booking_date,
      booking_time: booking.booking_time,
      duration_minutes: String(booking.duration_minutes || 60),
      service_ids: booking.service_ids || [],
      note: booking.note || "",
    });
    setAuditLogs([]);
    setAuditLoading(true);
    const { data, error } = await supabase
      .from("booking_audit_logs")
      .select("id, booking_id, action, before_data, after_data, actor_username, actor_role, is_test_data, created_at, reason")
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: false });
    if (error) {
      alert("修改紀錄讀取失敗，請重新登入後再試。");
    } else {
      setAuditLogs((data || []) as AuditLog[]);
    }
    setAuditLoading(false);
  }

  async function unlockForCorrection() {
    if (!auditBooking || unlockReason.trim().length < 4) {
      alert("請填寫至少 4 個字的解除原因。");
      return;
    }
    if (!confirm("解除後僅限最高管理員更正，所有操作都會留下紀錄。確定繼續？")) return;
    setCorrectionBusy(true);
    const { data, error } = await supabase.rpc("unlock_booking_for_correction", { p_booking_id: auditBooking.id, p_reason: unlockReason.trim() });
    setCorrectionBusy(false);
    if (error) {
      alert(error.message.includes("permission denied") ? "僅最高管理員可解除鎖定。" : "解除鎖定失敗，請重新登入後再試。");
      return;
    }
    const unlocked = (Array.isArray(data) ? data[0] : data) as Booking;
    setAuditBooking(unlocked);
    setBookings((items) => items.map((item) => item.id === unlocked.id ? unlocked : item));
    await openAuditLog(unlocked);
    setCorrectionSummary(unlockReason.trim());
  }

  async function finishCorrection() {
    if (!auditBooking || correctionSummary.trim().length < 4) {
      alert("請填寫至少 4 個字的更正說明。");
      return;
    }
    if (!correctionDraft.customer_name.trim() || !correctionDraft.booking_date || !correctionDraft.booking_time) {
      alert("請完整填寫客戶姓名、日期與時間。");
      return;
    }
    setCorrectionBusy(true);
    const payload = {
      customer_name: correctionDraft.customer_name.trim(),
      customer_phone: correctionDraft.customer_phone.trim(),
      customer_email: correctionDraft.customer_email.trim() || null,
      designer_id: correctionDraft.designer_id ? Number(correctionDraft.designer_id) : null,
      booking_date: correctionDraft.booking_date,
      booking_time: correctionDraft.booking_time,
      duration_minutes: Math.max(15, Number(correctionDraft.duration_minutes) || 60),
      service_ids: correctionDraft.service_ids,
      note: correctionDraft.note,
    };
    const { data: updated, error: updateError } = await supabase.from("bookings").update(payload).eq("id", auditBooking.id).select("*").single();
    if (updateError) {
      setCorrectionBusy(false);
      alert(updateError.message.includes("BOOKING_TIME_CONFLICT") ? "更正後的時段與其他預約重疊，請調整日期或時間。" : "更正儲存失敗，資料仍維持解除鎖定，請修正後再試。");
      return;
    }
    const { data: relockedData, error: relockError } = await supabase.rpc("relock_booking_after_correction", { p_booking_id: auditBooking.id, p_reason: correctionSummary.trim() });
    setCorrectionBusy(false);
    if (relockError) {
      alert("資料已修改，但重新鎖定失敗。請勿離開此頁，並再次按下完成更正。");
      setAuditBooking(updated as Booking);
      return;
    }
    const relocked = (Array.isArray(relockedData) ? relockedData[0] : relockedData) as Booking;
    setBookings((items) => items.map((item) => item.id === relocked.id ? relocked : item));
    await openAuditLog(relocked);
    alert("更正已儲存，預約已重新鎖定。");
  }

  async function cancelCorrection() {
    if (!auditBooking || !confirm("確定取消更正並重新鎖定？尚未儲存的內容會消失。")) return;
    setCorrectionBusy(true);
    const { data, error } = await supabase.rpc("relock_booking_after_correction", { p_booking_id: auditBooking.id, p_reason: "取消更正，未修改資料" });
    setCorrectionBusy(false);
    if (error) { alert("重新鎖定失敗，請稍後再試。"); return; }
    const relocked = (Array.isArray(data) ? data[0] : data) as Booking;
    setBookings((items) => items.map((item) => item.id === relocked.id ? relocked : item));
    await openAuditLog(relocked);
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
      <div className="admin-topbar" style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => router.push("/admin/dashboard")} style={{ background: "#2C2C2A", color: "#fff", border: "1px solid #5F5E5A", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>← 返回</button>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>預約管理</div>
        </div>
        <div style={{ fontSize: 12, color: "#888780" }}>共 {filtered.length} 筆</div>
      </div>

      <div style={{ padding: "12px 16px 0" }}>
        <div style={{ marginBottom: 12, padding: "11px 14px", borderRadius: 12, border: `1px solid ${dataMode === "test" ? "#E8C46A" : "#9DD8C8"}`, background: dataMode === "test" ? "#FFF7DF" : "#EAF8F3", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: dataMode === "test" ? "#7A4D00" : "#0B604E" }}>{dataMode === "test" ? "目前為測試模式" : "目前為正式模式"}</div>
            <div style={{ marginTop: 2, fontSize: 11, color: "#6B6860" }}>{dataMode === "test" ? "新預約會標記為測試資料，完成後仍可修正，日後可由最高管理員一次清除。" : "新預約會套用狀態規則，完成後自動鎖定並保留修改紀錄。"}</div>
          </div>
          <span style={{ borderRadius: 999, padding: "5px 10px", background: dataMode === "test" ? "#F5C451" : "#63C7AD", color: dataMode === "test" ? "#5A3800" : "#063F34", fontSize: 11, fontWeight: 800 }}>{dataMode === "test" ? "TEST" : "LIVE"}</span>
        </div>

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
                onClick={() => { setViewMode(mode); router.replace(`/admin/bookings?view=${mode}`); }}
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
              {isDesktop && selectedDayRows.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "74px 110px 110px minmax(0, 1fr) 80px", gap: 10, padding: "8px 14px", background: "#F8F7F3", color: "#888780", fontSize: 11, fontWeight: 700 }}>
                  <span>時間</span><span>設計師</span><span>客戶名</span><span>服務項目</span><span style={{ textAlign: "right" }}>狀態</span>
                </div>
              )}
              {selectedDayRows.length > 0 ? selectedDayRows.map((row) => {
                const statusMeta = getStatusMeta(row.status);
                return (
                  <div key={`detail-${row.id}`} style={{ display: "grid", gridTemplateColumns: isDesktop ? "74px 110px 110px minmax(0, 1fr) 80px" : "58px minmax(0, 1fr) auto", gap: 10, alignItems: "center", padding: "12px 14px", borderTop: "0.5px solid #F1EFE8" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#2C2C2A" }}>{row.time}</div>
                    {isDesktop ? (
                      <>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#2C2C2A" }}>{getDesignerName(row.designer_id)}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#2C2C2A" }}>{row.type === "booking" ? row.booking.customer_name || "訪客" : "—"}</div>
                        <div style={{ fontSize: 13, color: "#2C2C2A", lineHeight: 1.45 }}>{row.type === "booking" ? getServiceNames(row.booking.service_ids, row.booking.note) : row.type === "off-day" ? "整天公休" : row.label}</div>
                      </>
                    ) : (
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#2C2C2A" }}>{getDesignerName(row.designer_id)}{row.type === "booking" ? ` · ${row.booking.customer_name || "訪客"}` : ""}</div>
                        <div style={{ fontSize: 11, color: "#5F5E5A", marginTop: 3, lineHeight: 1.4 }}>{row.type === "booking" ? getServiceNames(row.booking.service_ids, row.booking.note) : row.type === "off-day" ? "整天公休" : row.label}</div>
                      </div>
                    )}
                    <div style={{ justifySelf: isDesktop ? "end" : "start", display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 10, fontWeight: 600, background: statusMeta.background, color: statusMeta.color }}>{statusMeta.label}</span>
                      {row.type === "booking" && <button onClick={() => openAuditLog(row.booking)} style={{ border: "none", background: "transparent", color: "#534AB7", fontSize: 10, fontWeight: 700, cursor: "pointer", padding: 2 }}>紀錄</button>}
                    </div>
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
                      <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                        {b.status === "pending" && (
                          <>
                          <button onClick={() => updateStatus(b.id, "confirmed")} style={{ padding: "4px 8px", background: "#534AB7", color: "#fff", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>確認</button>
                          <button onClick={() => updateStatus(b.id, "cancelled")} style={{ padding: "4px 8px", background: "#FCEBEB", color: "#A32D2D", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>取消</button>
                          </>
                        )}
                        <button onClick={() => openAuditLog(b)} style={{ padding: "4px 8px", background: "#F1EFE8", color: "#534AB7", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>紀錄</button>
                      </div>
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
              <button onClick={() => openAuditLog(b)} style={{ width: "100%", marginTop: 8, padding: "8px 0", background: "#F1EFE8", color: "#534AB7", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>查看修改紀錄</button>
            </div>
            );
          })
        ))}
      </div>

      {auditBooking && (
        <div onClick={() => setAuditBooking(null)} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(20, 20, 18, 0.48)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(event) => event.stopPropagation()} style={{ width: "min(720px, 100%)", maxHeight: "85vh", overflow: "auto", background: "#F8F7F3", borderRadius: 18, boxShadow: "0 20px 70px rgba(0,0,0,.25)" }}>
            <div style={{ position: "sticky", top: 0, zIndex: 1, padding: "16px 18px", background: "#fff", borderBottom: "1px solid #E8E5DA", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#2C2C2A" }}>預約修改紀錄</div>
                <div style={{ marginTop: 3, fontSize: 11, color: "#888780" }}>{auditBooking.customer_name || "訪客"} · {formatDisplayDate(auditBooking.booking_date)} {auditBooking.booking_time}</div>
              </div>
              <button onClick={() => setAuditBooking(null)} aria-label="關閉" style={{ width: 34, height: 34, borderRadius: 99, border: "none", background: "#F1EFE8", color: "#5F5E5A", cursor: "pointer", fontSize: 18 }}>×</button>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ padding: "10px 12px", borderRadius: 10, background: auditBooking.is_test_data ? "#FFF3D6" : auditBooking.locked_at ? "#EAF8F3" : "#EEEDFE", color: auditBooking.is_test_data ? "#7A4D00" : "#3C3489", fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
                {auditBooking.is_test_data ? "測試資料：不套用正式鎖定，可於上線前清除。" : auditBooking.locked_at ? "正式資料：已完成並鎖定。" : "正式資料：尚未鎖定。"}
              </div>
              {!auditBooking.is_test_data && auditBooking.status === "completed" && isOwner && auditBooking.locked_at && (
                <div style={{ background: "#fff", border: "1px solid #E3E0D6", borderRadius: 12, padding: 13, marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#2C2C2A", marginBottom: 7 }}>需要更正這筆預約？</div>
                  <textarea value={unlockReason} onChange={(event) => setUnlockReason(event.target.value)} placeholder="請填寫解除鎖定原因，例如：服務項目登錄錯誤" rows={2} style={{ width: "100%", boxSizing: "border-box", resize: "vertical", border: "1px solid #D3D1C7", borderRadius: 9, padding: 9, fontSize: 12 }} />
                  <button disabled={correctionBusy} onClick={unlockForCorrection} style={{ marginTop: 8, width: "100%", border: "none", borderRadius: 9, padding: 9, background: "#A85600", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", opacity: correctionBusy ? 0.6 : 1 }}>解除鎖定並開始更正</button>
                </div>
              )}
              {!auditBooking.is_test_data && auditBooking.status === "completed" && isOwner && !auditBooking.locked_at && (
                <div style={{ background: "#fff", border: "2px solid #A85600", borderRadius: 12, padding: 14, marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#7A4D00", marginBottom: 10 }}>更正中：完成後請重新鎖定</div>
                  <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr", gap: 9 }}>
                    <input value={correctionDraft.customer_name} onChange={(event) => setCorrectionDraft({ ...correctionDraft, customer_name: event.target.value })} placeholder="客戶姓名" style={{ padding: 9, border: "1px solid #D3D1C7", borderRadius: 8 }} />
                    <input value={correctionDraft.customer_phone} onChange={(event) => setCorrectionDraft({ ...correctionDraft, customer_phone: event.target.value })} placeholder="客戶電話" style={{ padding: 9, border: "1px solid #D3D1C7", borderRadius: 8 }} />
                    <input type="date" value={correctionDraft.booking_date} onChange={(event) => setCorrectionDraft({ ...correctionDraft, booking_date: event.target.value })} style={{ padding: 9, border: "1px solid #D3D1C7", borderRadius: 8 }} />
                    <input type="time" value={correctionDraft.booking_time} onChange={(event) => setCorrectionDraft({ ...correctionDraft, booking_time: event.target.value })} style={{ padding: 9, border: "1px solid #D3D1C7", borderRadius: 8 }} />
                    <select value={correctionDraft.designer_id} onChange={(event) => setCorrectionDraft({ ...correctionDraft, designer_id: event.target.value })} style={{ padding: 9, border: "1px solid #D3D1C7", borderRadius: 8, background: "#fff" }}><option value="">不指定設計師</option>{designers.map((designer) => <option key={designer.id} value={designer.id}>{designer.name}</option>)}</select>
                    <input type="number" min="15" step="15" value={correctionDraft.duration_minutes} onChange={(event) => setCorrectionDraft({ ...correctionDraft, duration_minutes: event.target.value })} placeholder="服務分鐘" style={{ padding: 9, border: "1px solid #D3D1C7", borderRadius: 8 }} />
                  </div>
                  <div style={{ marginTop: 10, fontSize: 11, fontWeight: 800, color: "#5F5E5A" }}>服務項目</div>
                  <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>{services.map((service) => { const checked = correctionDraft.service_ids.includes(service.id); return <button type="button" key={service.id} onClick={() => setCorrectionDraft({ ...correctionDraft, service_ids: checked ? correctionDraft.service_ids.filter((id) => id !== service.id) : [...correctionDraft.service_ids, service.id] })} style={{ border: `1px solid ${checked ? "#534AB7" : "#D3D1C7"}`, background: checked ? "#EEEDFE" : "#fff", color: checked ? "#3C3489" : "#5F5E5A", borderRadius: 999, padding: "5px 9px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{checked ? "✓ " : ""}{service.name}</button>; })}</div>
                  <textarea value={correctionDraft.note} onChange={(event) => setCorrectionDraft({ ...correctionDraft, note: event.target.value })} placeholder="預約備註" rows={3} style={{ marginTop: 10, width: "100%", boxSizing: "border-box", resize: "vertical", border: "1px solid #D3D1C7", borderRadius: 9, padding: 9, fontSize: 12 }} />
                  <textarea value={correctionSummary} onChange={(event) => setCorrectionSummary(event.target.value)} placeholder="更正說明（會保存於修改紀錄）" rows={2} style={{ marginTop: 8, width: "100%", boxSizing: "border-box", resize: "vertical", border: "1px solid #E8C46A", background: "#FFF9E9", borderRadius: 9, padding: 9, fontSize: 12 }} />
                  <div style={{ marginTop: 9, display: "flex", gap: 7 }}><button disabled={correctionBusy} onClick={cancelCorrection} style={{ flex: 1, border: "1px solid #D3D1C7", borderRadius: 9, padding: 9, background: "#fff", color: "#5F5E5A", fontWeight: 800, cursor: "pointer" }}>取消並鎖定</button><button disabled={correctionBusy} onClick={finishCorrection} style={{ flex: 2, border: "none", borderRadius: 9, padding: 9, background: "#0B6E5A", color: "#fff", fontWeight: 800, cursor: "pointer" }}>儲存更正並重新鎖定</button></div>
                </div>
              )}
              {auditLoading ? (
                <div style={{ padding: 30, textAlign: "center", color: "#888780", fontSize: 13 }}>讀取紀錄中...</div>
              ) : auditLogs.length === 0 ? (
                <div style={{ padding: 30, textAlign: "center", color: "#888780", fontSize: 13 }}>目前尚無修改紀錄。資料庫安全功能啟用前的歷史變更不會回溯產生。</div>
              ) : auditLogs.map((log) => {
                const changes = getAuditChanges(log);
                return (
                  <div key={log.id} style={{ background: "#fff", border: "1px solid #E3E0D6", borderRadius: 12, padding: 13, marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: changes.length ? 10 : 0 }}>
                      <div><span style={{ fontSize: 13, fontWeight: 800, color: "#2C2C2A" }}>{getAuditActionLabel(log.action)}</span><span style={{ marginLeft: 7, fontSize: 10, color: "#888780" }}>{log.is_test_data ? "測試資料" : "正式資料"}</span></div>
                      <div style={{ textAlign: "right", fontSize: 10, color: "#888780", lineHeight: 1.5 }}>{new Date(log.created_at).toLocaleString("zh-TW")}<br />{log.actor_username} · {log.actor_role}</div>
                    </div>
                    {log.reason && <div style={{ marginBottom: 8, padding: "7px 9px", borderRadius: 8, background: "#FFF7DF", color: "#7A4D00", fontSize: 11, lineHeight: 1.5 }}>原因：{log.reason}</div>}
                    {changes.map((change) => (
                      <div key={change.key} style={{ display: "grid", gridTemplateColumns: "90px minmax(0, 1fr)", gap: 10, padding: "7px 0", borderTop: "1px solid #F1EFE8", fontSize: 11 }}>
                        <div style={{ color: "#888780", fontWeight: 700 }}>{auditFieldLabels[change.key]}</div>
                        <div style={{ color: "#2C2C2A", lineHeight: 1.5, wordBreak: "break-word" }}>
                          {log.action === "updated" || log.action === "status_changed" ? <><span style={{ color: "#A32D2D", textDecoration: "line-through" }}>{formatAuditValue(change.key, change.before, designers, services)}</span><span style={{ margin: "0 7px", color: "#888780" }}>→</span></> : null}
                          <span style={{ color: log.action === "deleted" ? "#A32D2D" : "#0B6E5A", fontWeight: 700 }}>{formatAuditValue(change.key, log.action === "deleted" ? change.before : change.after, designers, services)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <AdminBottomNav current="bookings" />
    </div>
  );
}
