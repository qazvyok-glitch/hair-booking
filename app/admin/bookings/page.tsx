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
  designer_id: number;
  user_id: string;
};

type Customer = { id: string; phone: string; customer_no: string };

type Designer = { id: number; name: string };
type Service = { id: number; name: string };

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
      const [{ data: bData }, { data: dData }, { data: sData }, { data: cData }] = await Promise.all([
        supabase.from("bookings").select("*").order("booking_date", { ascending: false }).order("booking_time", { ascending: false }),
        supabase.from("designers").select("id, name"),
        supabase.from("services").select("id, name"),
        supabase.from("customers").select("id, phone, customer_no"),
      ]);
      if (bData) setBookings(bData);
      if (dData) setDesigners(dData);
      if (sData) setServices(sData);
      if (cData) setCustomers(cData);
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

  function getServiceNames(ids: number[]) {
    if (!ids || ids.length === 0) return "—";
    return ids.map(id => services.find(s => s.id === id)?.name || "").filter(Boolean).join("、");
  }

  async function updateStatus(id: number, status: string) {
    await supabase.from("bookings").update({ status }).eq("id", id);
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
  }

  const filtered = bookings.filter(b => {
    if (filterStatus !== "all" && b.status !== filterStatus) return false;
    if (filterDesigner !== "all" && String(b.designer_id) !== filterDesigner) return false;
    if (filterDate && b.booking_date !== filterDate) return false;
    if (search && !b.customer_name?.includes(search) && !b.customer_phone?.includes(search)) return false;
    return true;
  });

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#534AB7", fontSize: 14 }}>載入中...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", paddingBottom: 70, paddingLeft: isDesktop ? 220 : 0 }}>
      <div style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>預約管理</div>
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
            <option value="cancelled">已取消</option>
          </select>
          <select value={filterDesigner} onChange={(e) => setFilterDesigner(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 12, outline: "none", background: "#fff" }}>
            <option value="all">全部設計師</option>
            {designers.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
          </select>
          <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 12, outline: "none" }} />
          {(filterStatus !== "all" || filterDesigner !== "all" || filterDate || search) && (
            <button onClick={() => { setFilterStatus("all"); setFilterDesigner("all"); setFilterDate(""); setSearch(""); }} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "#FCEBEB", color: "#A32D2D", fontSize: 12, cursor: "pointer" }}>清除篩選</button>
          )}
        </div>

        {/* 預約列表 */}
        {isDesktop ? (
          <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #D3D1C7", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F1EFE8" }}>
                  {["日期", "時段", "客人", "電話", "設計師", "服務", "狀態", "操作"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", fontSize: 12, color: "#888780", fontWeight: 600, textAlign: "left", borderBottom: "0.5px solid #D3D1C7" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} style={{ borderBottom: "0.5px solid #F1EFE8" }}>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#2C2C2A" }}>{b.booking_date.replace(/-/g, "/")}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#2C2C2A" }}>{b.booking_time}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#2C2C2A" }}>{b.customer_name || "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#888780" }}>{b.customer_phone || "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#2C2C2A" }}>{getDesignerName(b.designer_id)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "#5F5E5A", maxWidth: 200 }}>{getServiceNames(b.service_ids)}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 10, fontWeight: 500, background: b.status === "confirmed" ? "#E1F5EE" : b.status === "cancelled" ? "#FCEBEB" : "#FAEEDA", color: b.status === "confirmed" ? "#085041" : b.status === "cancelled" ? "#A32D2D" : "#633806" }}>
                        {b.status === "confirmed" ? "已確認" : b.status === "cancelled" ? "已取消" : "待確認"}
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
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          filtered.map((b) => (
            <div key={b.id} style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 8, border: "0.5px solid #D3D1C7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#2C2C2A" }}>{b.customer_name || "訪客"}</div>
                  <div style={{ fontSize: 12, color: "#888780" }}>{b.customer_phone}</div>
                  {getCustomerNo(b.customer_phone) && (
                    <div style={{ fontSize: 10, color: "#534AB7", background: "#EEEDFE", borderRadius: 4, padding: "1px 6px", display: "inline-block", marginTop: 2 }}>{getCustomerNo(b.customer_phone)}</div>
                  )}
                </div>
                <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 10, fontWeight: 500, height: "fit-content", background: b.status === "confirmed" ? "#E1F5EE" : b.status === "cancelled" ? "#FCEBEB" : "#FAEEDA", color: b.status === "confirmed" ? "#085041" : b.status === "cancelled" ? "#A32D2D" : "#633806" }}>
                  {b.status === "confirmed" ? "已確認" : b.status === "cancelled" ? "已取消" : "待確認"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#5F5E5A", marginBottom: 2 }}>📅 {b.booking_date.replace(/-/g, "/")} {b.booking_time}</div>
              <div style={{ fontSize: 12, color: "#5F5E5A", marginBottom: 2 }}>設計師：{getDesignerName(b.designer_id)}</div>
              <div style={{ fontSize: 12, color: "#5F5E5A" }}>服務：{getServiceNames(b.service_ids)}</div>
              {b.status === "pending" && (
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button onClick={() => updateStatus(b.id, "confirmed")} style={{ flex: 1, padding: "8px 0", background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>確認</button>
                  <button onClick={() => updateStatus(b.id, "cancelled")} style={{ flex: 1, padding: "8px 0", background: "#FCEBEB", color: "#A32D2D", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>取消</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <AdminBottomNav current="bookings" />
    </div>
  );
}
