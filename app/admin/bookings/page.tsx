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
  const filtered = scheduleRows.filter(row => {
    if (filterStatus !== "all" && row.status !== filterStatus) return false;
    if (filterDesigner !== "all" && String(row.designer_id) !== filterDesigner) return false;
    if (filterDate && row.date !== filterDate) return false;
    if (search) {
      if (row.type !== "booking") return false;
      const b = row.booking;
      if (!b.customer_name?.includes(search) && !b.customer_phone?.includes(search)) return false;
    }
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
        )}
      </div>

      <AdminBottomNav current="bookings" />
    </div>
  );
}
