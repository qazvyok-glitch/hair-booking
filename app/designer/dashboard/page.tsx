"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

type Service = { id: number; name: string };

type DesignerSession = { id: number; name: string; nickname: string };

export default function DesignerDashboard() {
  const router = useRouter();
  const [designer, setDesigner] = useState<DesignerSession | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"today" | "upcoming" | "all">("today");

  useEffect(() => {
    const session = sessionStorage.getItem("designerSession");
    if (!session) { router.push("/designer/login"); return; }
    const d = JSON.parse(session);
    setDesigner(d);

    async function fetchData() {
      const [{ data: bookingData }, { data: serviceData }] = await Promise.all([
        supabase.from("bookings").select("*").eq("designer_id", d.id).order("booking_date").order("booking_time"),
        supabase.from("services").select("id, name"),
      ]);
      if (bookingData) setBookings(bookingData);
      if (serviceData) setServices(serviceData);
      setLoading(false);
    }
    fetchData();
  }, [router]);

  function getServiceNames(ids: number[]) {
    return ids.map((id) => services.find((s) => s.id === id)?.name || "").filter(Boolean).join("、");
  }

  const today = new Date().toISOString().split("T")[0];
  const todayBookings = bookings.filter((b) => b.booking_date === today);
  const upcomingBookings = bookings.filter((b) => b.booking_date > today);
  const displayBookings = tab === "today" ? todayBookings : tab === "upcoming" ? upcomingBookings : bookings;

  async function updateStatus(id: number, status: string) {
    await supabase.from("bookings").update({ status }).eq("id", id);
    setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status } : b));
  }

  function logout() {
    sessionStorage.removeItem("designerSession");
    router.push("/designer/login");
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#534AB7", fontSize: 14 }}>載入中...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8" }}>
      {/* 頂部 */}
      <div style={{ background: "#1A1A1A", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo.png" alt="logo" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{designer?.name}</div>
            {designer?.nickname && <div style={{ fontSize: 11, color: "#888780" }}>{designer.nickname}</div>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => router.push("/designer/transaction")} style={{ background: "#1D9E75", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>交易明細</button>
          <button onClick={() => router.push("/designer/schedule")} style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>排班設定</button>
          <button onClick={logout} style={{ background: "#333", color: "#888780", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>登出</button>
        </div>
      </div>

      {/* 統計 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "16px 16px 0" }}>
        {[
          { label: "今日預約", value: todayBookings.length, color: "#534AB7" },
          { label: "待確認", value: bookings.filter((b) => b.status === "pending").length, color: "#BA7517" },
          { label: "即將到來", value: upcomingBookings.length, color: "#1D9E75" },
        ].map((s) => (
          <div key={s.label} style={{ background: "#fff", borderRadius: 12, padding: "12px 10px", textAlign: "center", border: "0.5px solid #D3D1C7" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: "#888780", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab */}
      <div style={{ display: "flex", gap: 6, padding: "14px 16px 8px" }}>
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
      <div style={{ padding: "0 16px 32px" }}>
        {displayBookings.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#888780", fontSize: 14 }}>
            沒有預約紀錄
          </div>
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
              <div style={{ fontSize: 12, color: "#5F5E5A", marginBottom: 4 }}>
                📅 {b.booking_date.replace(/-/g, "/")} {b.booking_time}
              </div>
              <div style={{ fontSize: 12, color: "#5F5E5A", marginBottom: b.note ? 4 : 0 }}>
                ✂ {getServiceNames(b.service_ids || [])}
              </div>
              {b.note && <div style={{ fontSize: 11, color: "#888780", background: "#F1EFE8", borderRadius: 6, padding: "4px 8px", marginTop: 6 }}>備註：{b.note}</div>}
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
    </div>
  );
}
