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
type Transaction = { designer_id: number; total_amount: number; created_at: string };

export default function DesignerDashboard() {
  const router = useRouter();
  const [designer, setDesigner] = useState<DesignerSession | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [allDesigners, setAllDesigners] = useState<Designer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"today" | "upcoming" | "all">("today");
  const [designerFilter, setDesignerFilter] = useState<number | "all">("all");
  const [showAddBooking, setShowAddBooking] = useState(false);
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
      const transactionQuery = supabase.from("transactions").select("designer_id, total_amount, created_at").gte("created_at", today);
      const [{ data: bookingData }, { data: transactionData }, { data: serviceData }, { data: catData }, { data: designerData }] = await Promise.all([
        d.is_manager ? bookingQuery : bookingQuery.eq("designer_id", d.id),
        d.is_manager ? transactionQuery : transactionQuery.eq("designer_id", d.id),
        supabase.from("services").select("id, name, category_id").eq("is_active", true).order("sort_order"),
        supabase.from("service_categories").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("designers").select("id, name, display_name, nickname, status, is_active").eq("is_active", true).order("sort_order", { nullsFirst: false }).order("id"),
      ]);
      if (bookingData) setBookings(bookingData);
      if (transactionData) setTransactions(transactionData);
      const { data: annoData } = await supabase.from("announcements").select("*").eq("is_active", true).in("target", ["all", "designer"]).order("created_at", { ascending: false }).limit(5);
      if (annoData) setAnnouncements(annoData);
      if (serviceData) setServices(serviceData);
      if (catData) setCategories(catData);
      if (designerData) setAllDesigners(designerData);
      setLoading(false);
    }
    fetchData();
  }, [router]);

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
  const displayBookings = tab === "today" ? todayBookings : tab === "upcoming" ? upcomingBookings : filteredByDesigner;
  const bookingTargetDesignerId = designer?.is_manager ? Number(newBooking.designer_id || 0) : designer?.id;

  function getDesignerName(id: number) {
    const item = allDesigners.find((d) => d.id === id);
    return item?.display_name || item?.name || "未指定設計師";
  }

  function getStatusMeta(status: string) {
    if (status === "confirmed") return { label: "已確認", background: "#E1F5EE", color: "#085041", border: "#BFE6D7" };
    if (status === "cancelled") return { label: "已取消", background: "#FCEBEB", color: "#A32D2D", border: "#F5C4C4" };
    return { label: "待確認", background: "#FAEEDA", color: "#633806", border: "#FAC775" };
  }

  function formatBookingDate(date: string) {
    const parsed = new Date(date + "T00:00:00");
    const weekday = ["日", "一", "二", "三", "四", "五", "六"][parsed.getDay()];
    return `${date.replace(/-/g, "/")}（${weekday}）`;
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
    <div style={{ minHeight: "100vh", background: "#F1EFE8", paddingBottom: 88 }}>
      {/* 頂部 */}
      <div style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.png" alt="logo" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{designer?.name}</div>
            <div style={{ fontSize: 10, color: "#888780" }}>{designer?.is_manager ? "店長模式" : designer?.nickname}</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#888780" }}>{today.replace(/-/g, "/")}</div>
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
          { key: "all", label: "全部", count: filteredByDesigner.length },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as "today" | "upcoming" | "all")} style={{ padding: "6px 14px", borderRadius: 20, border: "none", background: tab === t.key ? "#534AB7" : "#fff", color: tab === t.key ? "#fff" : "#5F5E5A", fontSize: 12, fontWeight: tab === t.key ? 600 : 400, cursor: "pointer" }}>
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
            const statusMeta = getStatusMeta(b.status);
            return (
            <div key={b.id} style={{ background: "#fff", borderRadius: 18, padding: 0, marginBottom: 12, border: "1px solid " + (b.status === "pending" ? "#FAC775" : "#D3D1C7"), overflow: "hidden", boxShadow: b.status === "pending" ? "0 8px 22px rgba(186,117,23,0.12)" : "0 6px 18px rgba(26,26,26,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: b.status === "pending" ? "#FFF8EA" : "#FBFAF7", borderBottom: "0.5px solid #ECE8DF" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <div style={{ fontSize: 22, fontWeight: 850, color: "#7A1F1F", letterSpacing: "-0.02em" }}>{b.booking_time}</div>
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
                    <a href={b.customer_phone ? `tel:${b.customer_phone}` : undefined} style={{ display: "inline-block", fontSize: 12, color: "#888780", marginTop: 3, textDecoration: "none" }}>{b.customer_phone || "未留電話"}</a>
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

                {b.status === "pending" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <button onClick={() => updateStatus(b.id, "confirmed")} style={{ padding: "11px 0", background: "#1A1A1A", color: "#fff", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>接受預約</button>
                    <button onClick={() => updateStatus(b.id, "cancelled")} style={{ padding: "11px 0", background: "#FCEBEB", color: "#A32D2D", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>婉拒預約</button>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: b.customer_phone ? "1fr 1fr" : "1fr", gap: 8 }}>
                    {b.customer_phone && <a href={`tel:${b.customer_phone}`} style={{ textAlign: "center", padding: "10px 0", background: "#F1EFE8", color: "#2C2C2A", borderRadius: 12, fontSize: 12, fontWeight: 800, textDecoration: "none" }}>聯絡客人</a>}
                    {b.status === "confirmed" && <button onClick={() => router.push("/designer/transaction")} style={{ padding: "10px 0", background: "#7A1F1F", color: "#fff", border: "none", borderRadius: 12, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>前往結帳</button>}
                  </div>
                )}
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
              <button onClick={handleAddBooking} disabled={addingSaving} style={{ width: "100%", padding: "14px 0", background: addingSaving ? "#D3D1C7" : "#1A1A1A", color: "#fff", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 850, cursor: addingSaving ? "default" : "pointer" }}>
                {addingSaving ? "建立中..." : "確認新增預約"}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav current="dashboard" />
    </div>
  );
}
