"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Booking = {
  id: number;
  customer_name: string;
  customer_phone: string;
  booking_date: string;
  booking_time: string;
  service_ids: number[];
  note: string;
  status: string;
};

type Service = { id: number; name: string; category_id: number };
type ServiceCategory = { id: number; label: string; color: string; text_color: string };
type DesignerSession = { id: number; name: string; nickname: string };

function BottomNav({ current }: { current: string }) {
  const router = useRouter();
  const items = [
    { key: "dashboard", label: "預約", icon: "📅", path: "/designer/dashboard" },
    { key: "schedule", label: "班表", icon: "🗓", path: "/designer/schedule" },
    { key: "transaction", label: "帳務", icon: "💰", path: "/designer/transaction" },
    { key: "customers", label: "顧客", icon: "📋", path: "/designer/customers" },
    { key: "account", label: "我的", icon: "⚙️", path: "/designer/account" },
  ];
  return (
    <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 390, background: "#1A1A1A", borderTop: "0.5px solid #333", display: "flex", zIndex: 50 }}>
      {items.map((item) => (
        <button key={item.key} onClick={() => router.push(item.path)} style={{ flex: 1, padding: "10px 0", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <span style={{ fontSize: 22 }}>{item.icon}</span>
          <span style={{ fontSize: 11, color: current === item.key ? "#C8C4F8" : "#fff", fontWeight: current === item.key ? 600 : 400 }}>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

export default function DesignerDashboard() {
  const router = useRouter();
  const [designer, setDesigner] = useState<DesignerSession | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"today" | "upcoming" | "all">("today");
  const [showAddBooking, setShowAddBooking] = useState(false);
  const [newBooking, setNewBooking] = useState({ customer_name: "", customer_phone: "", booking_date: "", booking_time: "10:00", note: "" });
  const [newBookingServices, setNewBookingServices] = useState<number[]>([]);
  const [openCat, setOpenCat] = useState<number | null>(null);
  const [addingSaving, setAddingSaving] = useState(false);

  useEffect(() => {
    const session = sessionStorage.getItem("designerSession");
    if (!session) { router.push("/designer/login"); return; }
    const d = JSON.parse(session);
    setDesigner(d);

    async function fetchData() {
      const [{ data: bookingData }, { data: serviceData }, { data: catData }] = await Promise.all([
        supabase.from("bookings").select("*").eq("designer_id", d.id).order("booking_date").order("booking_time"),
        supabase.from("services").select("id, name, category_id").eq("is_active", true).order("sort_order"),
        supabase.from("service_categories").select("*").eq("is_active", true).order("sort_order"),
      ]);
      if (bookingData) setBookings(bookingData);
      if (serviceData) setServices(serviceData);
      if (catData) setCategories(catData);
      if (results[2].data) setCategories(results[2].data);
      setLoading(false);
    }
    fetchData();
  }, [router]);

  function getServiceNames(ids: number[]) {
    if (!ids || ids.length === 0) return "—";
    return ids.map((id) => services.find((s) => s.id === id)?.name || "").filter(Boolean).join("、");
  }

  const today = new Date().toISOString().split("T")[0];
  const todayBookings = bookings.filter((b) => b.booking_date === today);
  const upcomingBookings = bookings.filter((b) => b.booking_date > today);
  const displayBookings = tab === "today" ? todayBookings : tab === "upcoming" ? upcomingBookings : bookings;

  async function handleAddBooking() {
    if (!newBooking.customer_name || !newBooking.booking_date) { alert("請填寫客人姓名及日期"); return; }
    setAddingSaving(true);
    const { data } = await supabase.from("bookings").insert({
      designer_id: designer!.id,
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
    setNewBooking({ customer_name: "", customer_phone: "", booking_date: "", booking_time: "10:00", note: "" });
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
    <div style={{ minHeight: "100vh", background: "#F1EFE8", paddingBottom: 70 }}>
      {/* 頂部 */}
      <div style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.png" alt="logo" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{designer?.name}</div>
            {designer?.nickname && <div style={{ fontSize: 10, color: "#888780" }}>{designer.nickname}</div>}
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#888780" }}>{today.replace(/-/g, "/")}</div>
        <button onClick={() => setShowAddBooking(true)} style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>+ 新增預約</button>
      </div>

      {/* 統計卡 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "12px 16px 0" }}>
        {[
          { label: "今日預約", value: todayBookings.length, color: "#534AB7", bg: "#EEEDFE" },
          { label: "待確認", value: bookings.filter((b) => b.status === "pending").length, color: "#BA7517", bg: "#FAEEDA" },
          { label: "即將到來", value: upcomingBookings.length, color: "#1D9E75", bg: "#E1F5EE" },
        ].map((s) => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: "#888780", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab */}
      <div style={{ display: "flex", gap: 6, padding: "12px 16px 8px" }}>
        {[
          { key: "today", label: "今日" },
          { key: "upcoming", label: "即將到來" },
          { key: "all", label: "全部" },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as "today" | "upcoming" | "all")} style={{ padding: "6px 14px", borderRadius: 20, border: "none", background: tab === t.key ? "#534AB7" : "#fff", color: tab === t.key ? "#fff" : "#5F5E5A", fontSize: 12, fontWeight: tab === t.key ? 600 : 400, cursor: "pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 預約列表 */}
      <div style={{ padding: "0 16px" }}>
        {displayBookings.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#888780", fontSize: 14 }}>沒有預約紀錄</div>
        ) : (
          displayBookings.map((b) => (
            <div key={b.id} style={{ background: "#fff", borderRadius: 14, padding: "14px", marginBottom: 10, border: "0.5px solid #D3D1C7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#2C2C2A" }}>{b.customer_name || "訪客"}</div>
                  <div style={{ fontSize: 12, color: "#888780", marginTop: 2 }}>{b.customer_phone}</div>
                </div>
                <div style={{
                  fontSize: 10, padding: "3px 8px", borderRadius: 10, fontWeight: 500,
                  background: b.status === "confirmed" ? "#E1F5EE" : b.status === "cancelled" ? "#FCEBEB" : "#FAEEDA",
                  color: b.status === "confirmed" ? "#085041" : b.status === "cancelled" ? "#A32D2D" : "#633806",
                }}>
                  {b.status === "confirmed" ? "已確認" : b.status === "cancelled" ? "已取消" : "待確認"}
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#5F5E5A", marginBottom: 3 }}>📅 {b.booking_date.replace(/-/g, "/")} {b.booking_time}</div>
              <div style={{ fontSize: 12, color: "#5F5E5A", marginBottom: b.note ? 4 : 0 }}>✂ {getServiceNames(b.service_ids || [])}</div>
              {b.note && <div style={{ fontSize: 11, color: "#888780", background: "#F1EFE8", borderRadius: 6, padding: "4px 8px", marginTop: 4 }}>備註：{b.note}</div>}
              {b.status === "pending" && (
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <button onClick={() => updateStatus(b.id, "confirmed")} style={{ flex: 1, padding: "8px 0", background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>確認預約</button>
                  <button onClick={() => updateStatus(b.id, "cancelled")} style={{ flex: 1, padding: "8px 0", background: "#FCEBEB", color: "#A32D2D", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>取消預約</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showAddBooking && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 390, background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px 16px 32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#2C2C2A" }}>新增預約</div>
              <button onClick={() => setShowAddBooking(false)} style={{ background: "#F1EFE8", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer" }}>x</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>客人姓名 *</div>
              <input value={newBooking.customer_name} onChange={(e) => setNewBooking({ ...newBooking, customer_name: e.target.value })} placeholder="王小明" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>電話</div>
              <input value={newBooking.customer_phone} onChange={(e) => setNewBooking({ ...newBooking, customer_phone: e.target.value })} placeholder="09xx-xxx-xxx" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>日期 *</div>
                <input type="date" value={newBooking.booking_date} onChange={(e) => setNewBooking({ ...newBooking, booking_date: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>時期</div>
                <select value={newBooking.booking_time} onChange={(e) => setNewBooking({ ...newBooking, booking_time: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none" }}>
                  {["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00"].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 8 }}>服務項目</div>
              {categories.map(cat => {
                const catServices = services.filter(s => s.category_id === cat.id);
                const pickedCount = catServices.filter(s => newBookingServices.includes(s.id)).length;
                const isOpen = openCat === cat.id;
                return (
                  <div key={cat.id} style={{ marginBottom: 6 }}>
                    <div onClick={() => setOpenCat(isOpen ? null : cat.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: pickedCount > 0 ? cat.color : "#F1EFE8", borderRadius: isOpen ? "8px 8px 0 0" : 8, cursor: "pointer", border: "0.5px solid #D3D1C7" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: "#2C2C2A" }}>{cat.label}</span>
                        {pickedCount > 0 && <span style={{ fontSize: 10, background: cat.text_color, color: "#fff", borderRadius: 10, padding: "1px 7px" }}>{pickedCount}</span>}
                      </div>
                      <span style={{ fontSize: 11, color: "#888780" }}>{isOpen ? "▲" : "▼"}</span>
                    </div>
                    {isOpen && (
                      <div style={{ border: "0.5px solid #D3D1C7", borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
                        {catServices.map(s => {
                          const picked = newBookingServices.includes(s.id);
                          return (
                            <div key={s.id} onClick={() => setNewBookingServices(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: picked ? cat.color : "#fff", borderTop: "0.5px solid #F1EFE8", cursor: "pointer" }}>
                              <span style={{ fontSize: 12, color: "#2C2C2A" }}>{s.name}</span>
                              <div style={{ width: 20, height: 20, borderRadius: 6, border: "1.5px solid " + (picked ? cat.text_color : "#D3D1C7"), background: picked ? cat.text_color : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {picked && <span style={{ color: "#fff", fontSize: 12 }}>✓</span>}
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
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>備註</div>
              <textarea value={newBooking.note} onChange={(e) => setNewBooking({ ...newBooking, note: e.target.value })} placeholder="服務項目、特殊需求..." style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", height: 60, resize: "none", boxSizing: "border-box" }} />
            </div>
            <button onClick={handleAddBooking} disabled={addingSaving} style={{ width: "100%", padding: "13px 0", background: addingSaving ? "#D3D1C7" : "#534AB7", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: addingSaving ? "default" : "pointer" }}>
              {addingSaving ? "建立中..." : "確認新增預約"}
            </button>
          </div>
        </div>
      )}

      <BottomNav current="dashboard" />
    </div>
  );
}
