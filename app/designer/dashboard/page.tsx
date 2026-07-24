"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import BottomNav from "../components/BottomNav";

type Booking = {
  id: number;
  designer_id: number;
  customer_name: string;
  customer_phone: string;
  booking_date: string;
  booking_time: string;
  service_ids: number[];
  note: string;
  status: string;
  reference_image_url?: string;
  designers?: { name?: string; display_name?: string; nickname?: string };
};

type Service = { id: number; name: string; category_id: number };
type ServiceCategory = { id: number; label: string; color: string; text_color: string };
type Designer = { id: number; name: string; display_name?: string; nickname?: string; status?: string; is_active?: boolean };
type DesignerSession = { id: number; name: string; nickname: string; is_manager?: boolean };
type Transaction = { designer_id: number; total_amount: number; created_at: string; booking_id?: number | null };
type OffDay = { designer_id: number; off_date: string };
type OffSlot = { designer_id: number; slot_date: string; slot_time: string };

export default function DesignerDashboard() {
  const router = useRouter();
  const [designer, setDesigner] = useState<DesignerSession | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [allDesigners, setAllDesigners] = useState<Designer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [offDays, setOffDays] = useState<OffDay[]>([]);
  const [offSlots, setOffSlots] = useState<OffSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"today" | "upcoming">("today");
  const [designerFilter, setDesignerFilter] = useState<number | "all">("all");
  const [showAddBooking, setShowAddBooking] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [translatedNote, setTranslatedNote] = useState("");
  const [translatingNote, setTranslatingNote] = useState(false);
  const [translationError, setTranslationError] = useState("");
  const [newBooking, setNewBooking] = useState({ customer_name: "", customer_phone: "", booking_date: "", booking_time: "10:00", note: "", designer_id: "" });
  const [newBookingServices, setNewBookingServices] = useState<number[]>([]);
  const [openCat, setOpenCat] = useState<number | null>(null);
  const [addingSaving, setAddingSaving] = useState(false);

  useEffect(() => {
    const session = sessionStorage.getItem("designerSession");
    if (!session) { router.push("/designer/login"); return; }
    const d = JSON.parse(session);
    setDesigner(d);

    async function fetchData() {
      const bookingQuery = supabase.from("bookings").select("*, designers(name, display_name, nickname)").order("booking_date").order("booking_time");
      const today = new Date().toLocaleDateString("en-CA");
      const transactionQuery = supabase.from("transactions").select("designer_id, booking_id, total_amount, created_at").gte("created_at", today);
      const [{ data: bookingData }, { data: transactionData }, { data: serviceData }, { data: catData }, { data: designerData }, { data: offDayData }, { data: offSlotData }] = await Promise.all([
        d.is_manager ? bookingQuery : bookingQuery.eq("designer_id", d.id),
        d.is_manager ? transactionQuery : transactionQuery.eq("designer_id", d.id),
        supabase.from("services").select("id, name, category_id").eq("is_active", true).order("sort_order"),
        supabase.from("service_categories").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("designers").select("id, name, display_name, nickname, status, is_active").eq("is_active", true).order("sort_order", { nullsFirst: false }).order("id"),
        supabase.from("designer_off_days").select("*"),
        supabase.from("designer_off_slots").select("*"),
      ]);
      if (bookingData) setBookings(bookingData);
      if (transactionData) setTransactions(transactionData);
      const { data: annoData } = await supabase.from("announcements").select("*").eq("is_active", true).in("target", ["all", "designer"]).order("created_at", { ascending: false }).limit(5);
      if (annoData) setAnnouncements(annoData);
      if (serviceData) setServices(serviceData);
      if (catData) setCategories(catData);
      if (designerData) setAllDesigners(designerData);
      if (offDayData) setOffDays(offDayData);
      if (offSlotData) setOffSlots(offSlotData);
      setLoading(false);
    }
    fetchData();
  }, [router]);

  useEffect(() => {
    setTranslatedNote("");
    setTranslatingNote(false);
    setTranslationError("");
  }, [selectedBooking?.id]);

  function getServiceNames(ids: number[]) {
    if (!ids || ids.length === 0) return "—";
    return ids.map((id) => services.find((s) => s.id === id)?.name || "").filter(Boolean).join("、");
  }

  const today = new Date().toLocaleDateString("en-CA");
  const filteredByDesigner = designer?.is_manager && designerFilter !== "all" ? bookings.filter((b) => b.designer_id === designerFilter) : bookings;
  const filteredTransactions = designer?.is_manager && designerFilter !== "all" ? transactions.filter((t) => t.designer_id === designerFilter) : transactions;
  const todayBookings = filteredByDesigner.filter((b) => b.booking_date === today);
  const upcomingBookings = filteredByDesigner.filter((b) => b.booking_date > today);
  const pendingBookings = filteredByDesigner.filter((b) => b.status === "pending");
  const todayTotalAmount = filteredTransactions
    .filter((t) => t.created_at?.slice(0, 10) === today)
    .reduce((sum, t) => sum + (t.total_amount || 0), 0);
  const checkedOutTodayCount = todayBookings.filter((b) => isBookingCheckedOut(b.id)).length;
  const overdueUncheckoutCount = todayBookings.filter((b) => b.status === "confirmed" && !isBookingCheckedOut(b.id) && isPastBookingTime(b.booking_time)).length;
  const displayBookings = tab === "today" ? todayBookings : upcomingBookings;
  const bookingTargetDesignerId = designer?.is_manager ? Number(newBooking.designer_id || 0) : designer?.id;
  const addBookingConflict = getAddBookingConflict();
  const showManagerTodayOverview = !!designer?.is_manager && designerFilter === "all" && tab === "today";
  const managerTodaySummaries = allDesigners.map((d) => {
    const designerBookings = todayBookings.filter((b) => b.designer_id === d.id);
    const activeBookings = designerBookings.filter((b) => !isBookingCheckedOut(b.id));
    return {
      designer: d,
      bookings: designerBookings,
      pending: designerBookings.filter((b) => b.status === "pending").length,
      checkedOut: designerBookings.filter((b) => isBookingCheckedOut(b.id)).length,
      nextTime: activeBookings[0]?.booking_time || designerBookings[0]?.booking_time || "",
    };
  });

  function getDesignerName(id: number) {
    const item = allDesigners.find((d) => d.id === id);
    return item?.display_name || item?.name || "未指定設計師";
  }

  function getStatusMeta(status: string) {
    if (status === "confirmed") return { label: "已確認", background: "#E1F5EE", color: "#085041", border: "#BFE6D7" };
    if (status === "cancelled") return { label: "已取消", background: "#FCEBEB", color: "#A32D2D", border: "#F5C4C4" };
    return { label: "待確認", background: "#FAEEDA", color: "#633806", border: "#FAC775" };
  }

  function isBookingCheckedOut(bookingId: number) {
    return transactions.some((t) => t.booking_id === bookingId);
  }

  function isPastBookingTime(time: string) {
    if (!time) return false;
    const now = new Date();
    const [hour, minute] = time.split(":").map(Number);
    const bookingTime = new Date();
    bookingTime.setHours(hour || 0, minute || 0, 0, 0);
    return bookingTime.getTime() < now.getTime();
  }

  function getAddBookingConflict() {
    if (!bookingTargetDesignerId || !newBooking.booking_date || !newBooking.booking_time) return null;
    const isDesignerOffDay = offDays.some((d) => d.designer_id === bookingTargetDesignerId && d.off_date === newBooking.booking_date);
    if (isDesignerOffDay) return "此設計師當天已設定休假，無法建立預約。";
    const isDesignerOffSlot = offSlots.some((s) => s.designer_id === bookingTargetDesignerId && s.slot_date === newBooking.booking_date && s.slot_time === newBooking.booking_time);
    if (isDesignerOffSlot) return "此時段已被設為不可預約，請改選其他時間。";
    const hasExistingBooking = bookings.some((b) =>
      b.designer_id === bookingTargetDesignerId &&
      b.booking_date === newBooking.booking_date &&
      b.booking_time === newBooking.booking_time &&
      b.status !== "cancelled"
    );
    if (hasExistingBooking) return "此設計師同時段已有預約，請改選其他時間。";
    return null;
  }

  function getBookingStatusMeta(booking: Booking) {
    if (isBookingCheckedOut(booking.id)) return { label: "已結帳完成", background: "#ECE8DF", color: "#5F5E5A", border: "#D3D1C7" };
    return getStatusMeta(booking.status);
  }

  function formatBookingDate(date: string) {
    const parsed = new Date(date + "T00:00:00");
    const weekday = ["日", "一", "二", "三", "四", "五", "六"][parsed.getDay()];
    return `${date.replace(/-/g, "/")}（${weekday}）`;
  }

  async function translateNoteToChinese(text: string) {
    if (!text.trim()) return;
    setTranslatingNote(true);
    setTranslationError("");
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-TW&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("translate_failed");
      const data = await res.json();
      const translated = Array.isArray(data?.[0])
        ? data[0].map((part: any[]) => part?.[0] || "").join("")
        : "";
      if (!translated) throw new Error("empty_translation");
      setTranslatedNote(translated);
    } catch {
      setTranslationError("目前無法自動翻譯，請稍後再試。");
    } finally {
      setTranslatingNote(false);
    }
  }

  function renderAnnouncements() {
    if (announcements.length === 0) return null;
    return (
      <div style={{ padding: "12px 16px 4px" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#888780", marginBottom: 8 }}>最新公告</div>
        {announcements.map((a: any) => (
          <div key={a.id} style={{ background: "#fff", borderRadius: 14, marginBottom: 10, border: "0.5px solid #D3D1C7", overflow: "hidden" }}>
            {a.image_url && <img src={a.image_url} alt={a.title} style={{ width: "100%", maxHeight: 200, objectFit: "cover" }} />}
            <div style={{ padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 10, background: a.type === "promotion" ? "#FCEBEB" : a.type === "new_product" ? "#E1F5EE" : a.type === "event" ? "#FAEEDA" : "#EEEDFE", color: a.type === "promotion" ? "#A32D2D" : a.type === "new_product" ? "#085041" : a.type === "event" ? "#BA7517" : "#534AB7", borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>
                  {a.type === "promotion" ? "優惠活動" : a.type === "new_product" ? "新商品" : a.type === "event" ? "活動" : "公告"}
                </span>
                <span style={{ fontSize: 10, color: "#888780" }}>{a.created_at?.slice(0,10).replace(/-/g,"/")}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#2C2C2A", marginBottom: 6 }}>📢 {a.title}</div>
              {a.content && <div style={{ fontSize: 12, color: "#5F5E5A", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{a.content}</div>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  async function handleAddBooking() {
    if (!newBooking.customer_name || !newBooking.booking_date) { alert("請填寫客人姓名及日期"); return; }
    if (!bookingTargetDesignerId) { alert("請選擇設計師"); return; }
    if (addBookingConflict) { alert(addBookingConflict); return; }
    setAddingSaving(true);
    const { data } = await supabase.from("bookings").insert({
      designer_id: bookingTargetDesignerId,
      customer_name: newBooking.customer_name,
      customer_phone: newBooking.customer_phone,
      booking_date: newBooking.booking_date,
      booking_time: newBooking.booking_time,
      note: newBooking.note,
      status: "confirmed",
      service_ids: newBookingServices,
    }).select().single();
    if (data) setBookings([...bookings, data]);
    setAddingSaving(false);
    setShowAddBooking(false);
    setNewBooking({ customer_name: "", customer_phone: "", booking_date: "", booking_time: "10:00", note: "", designer_id: "" });
    setNewBookingServices([]);
  }

  async function updateStatus(id: number, status: string) {
    await supabase.from("bookings").update({ status }).eq("id", id);
    setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status } : b));
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#534AB7", fontSize: 14 }}>載入中...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", paddingBottom: 76 }}>
      {/* 頂部 */}
      <div style={{ background: "#1A1A1A", padding: "14px 16px", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <img src="/logo.png" alt="logo" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{designer?.name}</div>
            <div style={{ fontSize: 10, color: "#888780" }}>{designer?.is_manager ? "店長模式" : designer?.nickname}</div>
          </div>
        </div>
        <div style={{ fontSize: 16, color: "#fff", fontWeight: 850, letterSpacing: "0.02em", textAlign: "center" }}>{today.replace(/-/g, "/")}</div>
        <div />
      </div>

      {renderAnnouncements()}
      {designer?.is_manager && (
        <div style={{ padding: "12px 16px 0" }}>
          <div style={{ background: "#fff", border: "0.5px solid #D3D1C7", borderRadius: 14, padding: 12 }}>
            <div style={{ fontSize: 12, color: "#888780", marginBottom: 6 }}>店長查看範圍</div>
            <select value={designerFilter} onChange={(e) => setDesignerFilter(e.target.value === "all" ? "all" : Number(e.target.value))} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, background: "#fff", color: "#2C2C2A" }}>
              <option value="all">全店設計師</option>
              {allDesigners.map((d) => (
                <option key={d.id} value={d.id}>{d.display_name || d.name}{d.nickname ? `（${d.nickname}）` : ""}</option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 10, background: "linear-gradient(135deg, #1A1A1A 0%, #3A2424 100%)", borderRadius: 18, padding: 14, color: "#fff", boxShadow: "0 8px 22px rgba(26,26,26,0.16)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.02em" }}>店長工作台</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.62)", marginTop: 3, lineHeight: 1.5 }}>全店預約、協助排程與待處理事項集中在這裡。</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 12, padding: "7px 10px", textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.58)", marginBottom: 3 }}>今日已結帳</div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{checkedOutTodayCount} 筆</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button onClick={() => { setDesignerFilter("all"); setTab("today"); }} style={{ background: "#fff", color: "#1A1A1A", border: "none", borderRadius: 14, padding: "12px 10px", textAlign: "left", cursor: "pointer" }}>
                <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 5 }}>今日全店</div>
                <div style={{ fontSize: 11, color: "#5F5E5A", lineHeight: 1.45 }}>{todayBookings.length} 筆預約，快速切回全店今日清單</div>
              </button>
              <button onClick={() => setShowAddBooking(true)} style={{ background: "#fff", color: "#1A1A1A", border: "none", borderRadius: 14, padding: "12px 10px", textAlign: "left", cursor: "pointer" }}>
                <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 5 }}>協助預約</div>
                <div style={{ fontSize: 11, color: "#5F5E5A", lineHeight: 1.45 }}>替任一設計師建立電話或現場預約</div>
              </button>
              <button onClick={() => setTab("today")} style={{ background: pendingBookings.length + overdueUncheckoutCount > 0 ? "#FAEEDA" : "rgba(255,255,255,0.1)", color: pendingBookings.length + overdueUncheckoutCount > 0 ? "#633806" : "#fff", border: "none", borderRadius: 14, padding: "12px 10px", textAlign: "left", cursor: "pointer" }}>
                <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 5 }}>待處理</div>
                <div style={{ fontSize: 11, color: pendingBookings.length + overdueUncheckoutCount > 0 ? "#633806" : "rgba(255,255,255,0.68)", lineHeight: 1.45 }}>待確認 {pendingBookings.length} 筆，逾時未結帳 {overdueUncheckoutCount} 筆</div>
              </button>
              <button onClick={() => alert("進貨／庫存會在下一步加入店長模式。")} style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 14, padding: "12px 10px", textAlign: "left", cursor: "pointer" }}>
                <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 5 }}>進貨／庫存</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.68)", lineHeight: 1.45 }}>下一步開放：庫存清單、進貨與盤點</div>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 今日工作 */}
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#2C2C2A", letterSpacing: "-0.02em" }}>今日工作</div>
            <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>
              {designer?.is_manager && designerFilter === "all" ? "全店今日狀態" : "今日預約與結帳概況"}
            </div>
          </div>
          <button onClick={() => setShowAddBooking(true)} style={{ background: "#1A1A1A", color: "#fff", border: "none", borderRadius: 999, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ 新增</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={{ background: "#fff", border: "0.5px solid #D3D1C7", borderRadius: 14, padding: "13px 12px", boxShadow: "0 4px 14px rgba(26,26,26,0.04)" }}>
            <div style={{ fontSize: 11, color: "#888780", marginBottom: 8 }}>今日預約</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontSize: 30, fontWeight: 850, color: "#7A1F1F", lineHeight: 1 }}>{todayBookings.length}</span>
              <span style={{ fontSize: 11, color: "#888780" }}>筆</span>
            </div>
          </div>
          <div style={{ background: pendingBookings.length > 0 ? "#FAEEDA" : "#fff", border: "0.5px solid " + (pendingBookings.length > 0 ? "#FAC775" : "#D3D1C7"), borderRadius: 14, padding: "13px 12px", boxShadow: "0 4px 14px rgba(26,26,26,0.04)" }}>
            <div style={{ fontSize: 11, color: pendingBookings.length > 0 ? "#633806" : "#888780", marginBottom: 8 }}>待確認</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontSize: 30, fontWeight: 850, color: pendingBookings.length > 0 ? "#BA7517" : "#2C2C2A", lineHeight: 1 }}>{pendingBookings.length}</span>
              <span style={{ fontSize: 11, color: pendingBookings.length > 0 ? "#633806" : "#888780" }}>筆</span>
            </div>
          </div>
          <div style={{ gridColumn: "1 / -1", background: "linear-gradient(135deg, #1A1A1A 0%, #3A2424 100%)", borderRadius: 16, padding: "15px 14px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 8px 22px rgba(26,26,26,0.16)" }}>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.62)", marginBottom: 5 }}>今日結帳</div>
              <div style={{ fontSize: 22, fontWeight: 850, letterSpacing: "-0.02em" }}>NT$ {todayTotalAmount.toLocaleString()}</div>
            </div>
            <button onClick={() => router.push("/designer/transaction")} style={{ background: "#fff", color: "#1A1A1A", border: "none", borderRadius: 999, padding: "8px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>前往結帳</button>
          </div>
        </div>

        {showManagerTodayOverview && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 13, color: "#2C2C2A", fontWeight: 850 }}>各設計師今日概況</div>
              <div style={{ fontSize: 11, color: "#888780" }}>全店總覽</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              {managerTodaySummaries.map(({ designer: d, bookings: list, pending, checkedOut, nextTime }) => (
                <button
                  key={d.id}
                  onClick={() => setDesignerFilter(d.id)}
                  style={{ background: list.length > 0 ? "#fff" : "#F7F4EE", border: "0.5px solid " + (pending > 0 ? "#FAC775" : "#D3D1C7"), borderRadius: 14, padding: "11px 10px", textAlign: "left", cursor: "pointer", boxShadow: list.length > 0 ? "0 4px 14px rgba(26,26,26,0.04)" : "none" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "#2C2C2A", fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.display_name || d.name}</div>
                      <div style={{ fontSize: 10, color: "#888780", marginTop: 2 }}>{d.nickname || "設計師"}</div>
                    </div>
                    <div style={{ fontSize: 18, color: list.length > 0 ? "#7A1F1F" : "#AAA69D", fontWeight: 900, lineHeight: 1 }}>{list.length}</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                    <div style={{ background: pending > 0 ? "#FAEEDA" : "#F1EFE8", color: pending > 0 ? "#633806" : "#5F5E5A", borderRadius: 9, padding: "6px 7px", fontSize: 10, fontWeight: 800 }}>待確認 {pending}</div>
                    <div style={{ background: "#F1EFE8", color: "#5F5E5A", borderRadius: 9, padding: "6px 7px", fontSize: 10, fontWeight: 800 }}>已結帳 {checkedOut}</div>
                  </div>
                  <div style={{ fontSize: 11, color: nextTime ? "#2C2C2A" : "#888780", marginTop: 8, fontWeight: 700 }}>
                    {nextTime ? `下一筆 ${nextTime}` : "今日無預約"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tab */}
      <div style={{ padding: "16px 16px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#2C2C2A" }}>預約清單</div>
            <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>依時間排序，待確認預約會優先提醒</div>
          </div>
          <div style={{ fontSize: 11, color: "#888780" }}>{displayBookings.length} 筆</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
        {[
          { key: "today", label: "今日", count: todayBookings.length },
          { key: "upcoming", label: "即將到來", count: upcomingBookings.length },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as "today" | "upcoming")} style={{ padding: "6px 14px", borderRadius: 20, border: "none", background: tab === t.key ? "#534AB7" : "#fff", color: tab === t.key ? "#fff" : "#5F5E5A", fontSize: 12, fontWeight: tab === t.key ? 600 : 400, cursor: "pointer" }}>
            {t.label} {t.count}
          </button>
        ))}
        </div>
      </div>

      {/* 預約列表 */}
      <div style={{ padding: "0 16px" }}>
        {displayBookings.length === 0 ? (
          <div style={{ textAlign: "center", padding: "42px 16px", color: "#888780", fontSize: 14, background: "#fff", borderRadius: 16, border: "0.5px solid #D3D1C7" }}>目前沒有預約紀錄</div>
        ) : (
          displayBookings.map((b) => {
            const checkedOut = isBookingCheckedOut(b.id);
            const statusMeta = getBookingStatusMeta(b);
            return (
            <div key={b.id} onClick={() => setSelectedBooking(b)} style={{ background: checkedOut ? "#F1EFE8" : "#fff", borderRadius: 18, padding: 0, marginBottom: 12, border: "1px solid " + (checkedOut ? "#D3D1C7" : b.status === "pending" ? "#FAC775" : "#D3D1C7"), overflow: "hidden", boxShadow: checkedOut ? "none" : b.status === "pending" ? "0 8px 22px rgba(186,117,23,0.12)" : "0 6px 18px rgba(26,26,26,0.04)", cursor: "pointer", opacity: checkedOut ? 0.78 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: checkedOut ? "#E7E2D8" : b.status === "pending" ? "#FFF8EA" : "#FBFAF7", borderBottom: "0.5px solid #ECE8DF" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <div style={{ fontSize: 22, fontWeight: 850, color: checkedOut ? "#888780" : "#7A1F1F", letterSpacing: "-0.02em" }}>{b.booking_time}</div>
                  <div style={{ fontSize: 12, color: "#888780" }}>{formatBookingDate(b.booking_date)}</div>
                </div>
                <div style={{ fontSize: 11, padding: "4px 9px", borderRadius: 999, fontWeight: 700, background: statusMeta.background, color: statusMeta.color, border: "1px solid " + statusMeta.border }}>
                  {statusMeta.label}
                </div>
              </div>

              <div style={{ padding: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#2C2C2A" }}>{b.customer_name || "訪客"}</div>
                    <a href={b.customer_phone ? `tel:${b.customer_phone}` : undefined} onClick={(e) => e.stopPropagation()} style={{ display: "inline-block", fontSize: 12, color: "#888780", marginTop: 3, textDecoration: "none" }}>{b.customer_phone || "未留電話"}</a>
                  </div>
                  {designer?.is_manager && (
                    <div style={{ textAlign: "right", minWidth: 82 }}>
                      <div style={{ fontSize: 10, color: "#888780", marginBottom: 3 }}>設計師</div>
                      <div style={{ fontSize: 12, color: "#534AB7", fontWeight: 700 }}>{b.designers?.display_name || b.designers?.name || getDesignerName(b.designer_id)}</div>
                    </div>
                  )}
                </div>

                <div style={{ background: "#F7F4EE", borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: "#888780", marginBottom: 4 }}>服務項目</div>
                  <div style={{ fontSize: 13, color: "#2C2C2A", lineHeight: 1.6, fontWeight: 600 }}>{getServiceNames(b.service_ids || [])}</div>
                </div>

                {b.note && <div style={{ fontSize: 12, color: "#5F5E5A", background: "#FBFAF7", border: "0.5px solid #ECE8DF", borderRadius: 12, padding: "9px 10px", marginBottom: 10, lineHeight: 1.6 }}>備註：{b.note}</div>}
                {b.reference_image_url && (
                  <a href={b.reference_image_url} target="_blank" rel="noreferrer" style={{ display: "block", marginBottom: 10, textDecoration: "none" }}>
                    <div style={{ fontSize: 11, color: "#534AB7", fontWeight: 700, marginBottom: 6 }}>查看參考圖片</div>
                    <img src={b.reference_image_url} alt="參考圖片" style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 12, border: "0.5px solid #D3D1C7" }} />
                  </a>
                )}

                {checkedOut ? (
                  <div style={{ background: "#E7E2D8", color: "#5F5E5A", borderRadius: 12, padding: "10px 12px", fontSize: 12, fontWeight: 800, textAlign: "center" }}>
                    已結帳完成，此預約僅可查看內容
                  </div>
                ) : b.status === "pending" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <button onClick={(e) => { e.stopPropagation(); updateStatus(b.id, "confirmed"); }} style={{ padding: "11px 0", background: "#1A1A1A", color: "#fff", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>接受預約</button>
                    <button onClick={(e) => { e.stopPropagation(); updateStatus(b.id, "cancelled"); }} style={{ padding: "11px 0", background: "#FCEBEB", color: "#A32D2D", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>婉拒預約</button>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: b.customer_phone ? "1fr 1fr" : "1fr", gap: 8 }}>
                    {b.customer_phone && <a href={`tel:${b.customer_phone}`} onClick={(e) => e.stopPropagation()} style={{ textAlign: "center", padding: "10px 0", background: "#F1EFE8", color: "#2C2C2A", borderRadius: 12, fontSize: 12, fontWeight: 800, textDecoration: "none" }}>聯絡客人</a>}
                    {b.status === "confirmed" && <button onClick={(e) => { e.stopPropagation(); router.push(`/designer/transaction?checkout=${b.id}`); }} style={{ padding: "10px 0", background: "#7A1F1F", color: "#fff", border: "none", borderRadius: 12, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>前往結帳</button>}
                  </div>
                )}
                <div style={{ marginTop: 10, fontSize: 11, color: "#888780", textAlign: "center" }}>點擊卡片查看預約內容</div>
                </div>
            </div>
            );
          })
        )}
      </div>

      {showAddBooking && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 390, maxHeight: "88vh", background: "#fff", borderRadius: "22px 22px 0 0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 16px 14px", borderBottom: "0.5px solid #ECE8DF", background: "#FBFAF7", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 850, color: "#2C2C2A", letterSpacing: "-0.02em" }}>新增預約</div>
                <div style={{ fontSize: 11, color: "#888780", marginTop: 3 }}>{designer?.is_manager ? "店長可協助指定設計師與建立預約" : "建立後會直接加入你的預約清單"}</div>
              </div>
              <button onClick={() => setShowAddBooking(false)} style={{ background: "#F1EFE8", border: "none", borderRadius: 999, width: 34, height: 34, fontSize: 18, cursor: "pointer", color: "#5F5E5A" }}>×</button>
            </div>

            <div style={{ padding: "14px 16px", overflowY: "auto" }}>
              {designer?.is_manager && (
                <div style={{ marginBottom: 14, background: "#F7F4EE", borderRadius: 14, padding: 12 }}>
                  <div style={{ fontSize: 12, color: "#888780", marginBottom: 6, fontWeight: 700 }}>指定設計師 *</div>
                  <select value={newBooking.designer_id} onChange={(e) => setNewBooking({ ...newBooking, designer_id: e.target.value })} style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #D3D1C7", fontSize: 14, outline: "none", background: "#fff", boxSizing: "border-box", color: "#2C2C2A" }}>
                    <option value="">請選擇設計師</option>
                    {allDesigners.map((d) => (
                      <option key={d.id} value={d.id}>{d.display_name || d.name}{d.nickname ? `（${d.nickname}）` : ""}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ marginBottom: 14, background: "#fff", border: "0.5px solid #ECE8DF", borderRadius: 14, padding: 12 }}>
                <div style={{ fontSize: 13, color: "#2C2C2A", marginBottom: 10, fontWeight: 800 }}>客人資料</div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: "#888780", marginBottom: 5 }}>客人姓名 *</div>
                  <input value={newBooking.customer_name} onChange={(e) => setNewBooking({ ...newBooking, customer_name: e.target.value })} placeholder="王小明" style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #D3D1C7", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#888780", marginBottom: 5 }}>電話</div>
                  <input value={newBooking.customer_phone} onChange={(e) => setNewBooking({ ...newBooking, customer_phone: e.target.value })} placeholder="09xx-xxx-xxx" style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #D3D1C7", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>

              <div style={{ marginBottom: 14, background: "#fff", border: "0.5px solid #ECE8DF", borderRadius: 14, padding: 12 }}>
                <div style={{ fontSize: 13, color: "#2C2C2A", marginBottom: 10, fontWeight: 800 }}>預約時間</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "#888780", marginBottom: 5 }}>日期 *</div>
                    <input type="date" value={newBooking.booking_date} onChange={(e) => setNewBooking({ ...newBooking, booking_date: e.target.value })} style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #D3D1C7", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "#888780", marginBottom: 5 }}>時間</div>
                    <select value={newBooking.booking_time} onChange={(e) => setNewBooking({ ...newBooking, booking_time: e.target.value })} style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #D3D1C7", fontSize: 14, outline: "none", color: "#2C2C2A", background: "#fff" }}>
                      {["09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00"].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {bookingTargetDesignerId && newBooking.booking_date && newBooking.booking_time && (
                  <div style={{ marginTop: 10, background: addBookingConflict ? "#FCEBEB" : "#E1F5EE", border: "0.5px solid " + (addBookingConflict ? "#F5C4C4" : "#BFE6D7"), color: addBookingConflict ? "#A32D2D" : "#085041", borderRadius: 10, padding: "9px 10px", fontSize: 12, fontWeight: 800, lineHeight: 1.5 }}>
                    {addBookingConflict || "此設計師此時段目前可安排預約。"}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 14, background: "#fff", border: "0.5px solid #ECE8DF", borderRadius: 14, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 13, color: "#2C2C2A", fontWeight: 800 }}>服務項目</div>
                  <div style={{ fontSize: 11, color: "#888780" }}>已選 {newBookingServices.length} 項</div>
                </div>
                {categories.map(cat => {
                  const catServices = services.filter(s => s.category_id === cat.id);
                  const pickedCount = catServices.filter(s => newBookingServices.includes(s.id)).length;
                  const isOpen = openCat === cat.id;
                  return (
                    <div key={cat.id} style={{ marginBottom: 6 }}>
                      <div onClick={() => setOpenCat(isOpen ? null : cat.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 12px", background: pickedCount > 0 ? cat.color : "#F1EFE8", borderRadius: isOpen ? "10px 10px 0 0" : 10, cursor: "pointer", border: "0.5px solid #D3D1C7" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#2C2C2A" }}>{cat.label}</span>
                          {pickedCount > 0 && <span style={{ fontSize: 10, background: cat.text_color, color: "#fff", borderRadius: 10, padding: "2px 8px", fontWeight: 700 }}>{pickedCount} 項</span>}
                        </div>
                        <span style={{ fontSize: 11, color: "#888780" }}>{isOpen ? "▲" : "▼"}</span>
                      </div>
                      {isOpen && (
                        <div style={{ border: "0.5px solid #D3D1C7", borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
                          {catServices.map(s => {
                            const picked = newBookingServices.includes(s.id);
                            return (
                              <div key={s.id} onClick={() => setNewBookingServices(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "11px 12px", background: picked ? cat.color : "#fff", borderTop: "0.5px solid #F1EFE8", cursor: "pointer" }}>
                                <span style={{ fontSize: 13, color: "#2C2C2A", lineHeight: 1.4 }}>{s.name}</span>
                                <div style={{ width: 22, height: 22, flex: "0 0 22px", borderRadius: 7, border: "1.5px solid " + (picked ? cat.text_color : "#D3D1C7"), background: picked ? cat.text_color : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  {picked && <span style={{ color: "#fff", fontSize: 13, fontWeight: 800 }}>✓</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ marginBottom: 8, background: "#fff", border: "0.5px solid #ECE8DF", borderRadius: 14, padding: 12 }}>
                <div style={{ fontSize: 13, color: "#2C2C2A", marginBottom: 8, fontWeight: 800 }}>備註</div>
                <textarea value={newBooking.note} onChange={(e) => setNewBooking({ ...newBooking, note: e.target.value })} placeholder="特殊需求、現場安排、顧客偏好..." style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #D3D1C7", fontSize: 14, outline: "none", height: 76, resize: "none", boxSizing: "border-box", lineHeight: 1.5 }} />
              </div>
            </div>

            <div style={{ padding: "12px 16px 18px", borderTop: "0.5px solid #ECE8DF", background: "#fff" }}>
              <div style={{ fontSize: 11, color: "#888780", marginBottom: 8, lineHeight: 1.5 }}>
                建立後狀態為「已確認」，適合電話預約、現場加約或店長協助預約。
              </div>
              <button onClick={handleAddBooking} disabled={addingSaving || !!addBookingConflict} style={{ width: "100%", padding: "14px 0", background: addingSaving || addBookingConflict ? "#D3D1C7" : "#1A1A1A", color: "#fff", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 850, cursor: addingSaving || addBookingConflict ? "default" : "pointer" }}>
                {addingSaving ? "建立中..." : addBookingConflict ? "請先調整預約時間" : "確認新增預約"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedBooking && (
        <div onClick={() => setSelectedBooking(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 110, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 390, maxHeight: "86vh", background: "#fff", borderRadius: "22px 22px 0 0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 16px 14px", borderBottom: "0.5px solid #ECE8DF", background: "#FBFAF7", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 850, color: "#2C2C2A", letterSpacing: "-0.02em" }}>預約內容</div>
                <div style={{ fontSize: 11, color: "#888780", marginTop: 3 }}>{formatBookingDate(selectedBooking.booking_date)} {selectedBooking.booking_time}</div>
              </div>
              <button onClick={() => setSelectedBooking(null)} style={{ background: "#F1EFE8", border: "none", borderRadius: 999, width: 34, height: 34, fontSize: 18, cursor: "pointer", color: "#5F5E5A" }}>×</button>
            </div>

            <div style={{ padding: "14px 16px", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 850, color: "#2C2C2A" }}>{selectedBooking.customer_name || "訪客"}</div>
                  <div style={{ fontSize: 13, color: "#888780", marginTop: 4 }}>{selectedBooking.customer_phone || "未留電話"}</div>
                </div>
                <div style={{ fontSize: 11, padding: "5px 10px", borderRadius: 999, fontWeight: 800, background: getBookingStatusMeta(selectedBooking).background, color: getBookingStatusMeta(selectedBooking).color, border: "1px solid " + getBookingStatusMeta(selectedBooking).border }}>
                  {getBookingStatusMeta(selectedBooking).label}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                <div style={{ background: "#F7F4EE", borderRadius: 14, padding: 12 }}>
                  <div style={{ fontSize: 11, color: "#888780", marginBottom: 5 }}>設計師</div>
                  <div style={{ fontSize: 14, color: "#2C2C2A", fontWeight: 800 }}>{selectedBooking.designers?.display_name || selectedBooking.designers?.name || getDesignerName(selectedBooking.designer_id)}</div>
                </div>
                <div style={{ background: "#F7F4EE", borderRadius: 14, padding: 12 }}>
                  <div style={{ fontSize: 11, color: "#888780", marginBottom: 5 }}>預約時間</div>
                  <div style={{ fontSize: 14, color: "#2C2C2A", fontWeight: 800 }}>{selectedBooking.booking_time}</div>
                </div>
              </div>

              <div style={{ background: "#F7F4EE", borderRadius: 14, padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "#888780", marginBottom: 6 }}>服務項目</div>
                <div style={{ fontSize: 14, color: "#2C2C2A", lineHeight: 1.7, fontWeight: 750 }}>{getServiceNames(selectedBooking.service_ids || [])}</div>
              </div>

              <div style={{ background: "#FBFAF7", border: "0.5px solid #ECE8DF", borderRadius: 14, padding: 12, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 11, color: "#888780" }}>備註</div>
                  {selectedBooking.note && (
                    <button onClick={() => translateNoteToChinese(selectedBooking.note)} disabled={translatingNote} style={{ flex: "0 0 auto", background: translatingNote ? "#D3D1C7" : "#1A1A1A", color: "#fff", border: "none", borderRadius: 999, padding: "5px 10px", fontSize: 11, fontWeight: 800, cursor: translatingNote ? "default" : "pointer" }}>
                      {translatingNote ? "翻譯中..." : "翻譯成中文"}
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 14, color: selectedBooking.note ? "#2C2C2A" : "#AAA69D", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{selectedBooking.note || "沒有備註"}</div>
                {translatedNote && (
                  <div style={{ marginTop: 10, background: "#E1F5EE", border: "0.5px solid #BFE6D7", borderRadius: 12, padding: "10px 11px" }}>
                    <div style={{ fontSize: 11, color: "#085041", fontWeight: 800, marginBottom: 5 }}>中文翻譯</div>
                    <div style={{ fontSize: 14, color: "#2C2C2A", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{translatedNote}</div>
                  </div>
                )}
                {translationError && (
                  <div style={{ marginTop: 10, background: "#FCEBEB", border: "0.5px solid #F5C4C4", borderRadius: 12, padding: "9px 10px", fontSize: 12, color: "#A32D2D", lineHeight: 1.5 }}>
                    {translationError}
                  </div>
                )}
              </div>

              {selectedBooking.reference_image_url && (
                <a href={selectedBooking.reference_image_url} target="_blank" rel="noreferrer" style={{ display: "block", marginBottom: 12, textDecoration: "none" }}>
                  <div style={{ fontSize: 12, color: "#534AB7", fontWeight: 800, marginBottom: 7 }}>查看參考圖片</div>
                  <img src={selectedBooking.reference_image_url} alt="參考圖片" style={{ width: "100%", maxHeight: 240, objectFit: "cover", borderRadius: 14, border: "0.5px solid #D3D1C7" }} />
                </a>
              )}
            </div>

            <div style={{ padding: "12px 16px 18px", borderTop: "0.5px solid #ECE8DF", background: "#fff" }}>
              {isBookingCheckedOut(selectedBooking.id) ? (
                <div style={{ background: "#F1EFE8", color: "#5F5E5A", borderRadius: 14, padding: "13px 14px", fontSize: 13, fontWeight: 800, textAlign: "center", lineHeight: 1.5 }}>
                  此預約已結帳完成，僅可查看內容。
                </div>
              ) : selectedBooking.status === "pending" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button onClick={() => { updateStatus(selectedBooking.id, "confirmed"); setSelectedBooking({ ...selectedBooking, status: "confirmed" }); }} style={{ padding: "13px 0", background: "#1A1A1A", color: "#fff", border: "none", borderRadius: 14, fontSize: 14, fontWeight: 850, cursor: "pointer" }}>接受預約</button>
                  <button onClick={() => { updateStatus(selectedBooking.id, "cancelled"); setSelectedBooking({ ...selectedBooking, status: "cancelled" }); }} style={{ padding: "13px 0", background: "#FCEBEB", color: "#A32D2D", border: "none", borderRadius: 14, fontSize: 14, fontWeight: 850, cursor: "pointer" }}>婉拒預約</button>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: selectedBooking.customer_phone && selectedBooking.status === "confirmed" ? "1fr 1fr" : "1fr", gap: 8 }}>
                  {selectedBooking.customer_phone && <a href={`tel:${selectedBooking.customer_phone}`} style={{ textAlign: "center", padding: "13px 0", background: "#F1EFE8", color: "#2C2C2A", borderRadius: 14, fontSize: 14, fontWeight: 850, textDecoration: "none" }}>聯絡客人</a>}
                  {selectedBooking.status === "confirmed" && <button onClick={() => router.push(`/designer/transaction?checkout=${selectedBooking.id}`)} style={{ padding: "13px 0", background: "#7A1F1F", color: "#fff", border: "none", borderRadius: 14, fontSize: 14, fontWeight: 850, cursor: "pointer" }}>前往結帳</button>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <BottomNav current="dashboard" />
    </div>
  );
}
