"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Booking = {
  id: number;
  booking_date: string;
  booking_time: string;
  service_ids: number[];
  status: string;
  note: string;
  designer_id: number;
};

type Designer = { id: number; name: string; nickname: string };
type Service = { id: number; name: string };

export default function MemberProfile() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [customerNo, setCustomerNo] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push("/member/login"); return; }
      setUser(session.user);
      setEditName(session.user.user_metadata?.full_name || "");

      const { data: customerData } = await supabase
        .from("customers")
        .select("phone, customer_no")
        .eq("id", session.user.id)
        .single();
      if (customerData?.phone) setEditPhone(customerData.phone);
      if (customerData?.customer_no) setCustomerNo(customerData.customer_no);

      const [{ data: bData }, { data: dData }, { data: sData }] = await Promise.all([
        supabase.from("bookings").select("*").eq("user_id", session.user.id).order("booking_date", { ascending: false }),
        supabase.from("designers").select("id, name, nickname"),
        supabase.from("services").select("id, name"),
      ]);
      if (bData) setBookings(bData);
      if (dData) setDesigners(dData);
      if (sData) setServices(sData);
      setLoading(false);
    });
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  function getDesignerName(id: number) {
    if (!id) return "不指定";
    return designers.find(d => d.id === id)?.name || "—";
  }

  function getServiceNames(ids: number[]) {
    if (!ids || ids.length === 0) return "—";
    return ids.map(id => services.find(s => s.id === id)?.name || "").filter(Boolean).join("、");
  }

  const today = new Date().toISOString().split("T")[0];
  const upcomingBookings = bookings.filter(b => b.booking_date >= today);
  const pastBookings = bookings.filter(b => b.booking_date < today);
  const displayBookings = tab === "upcoming" ? upcomingBookings : pastBookings;

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#534AB7", fontSize: 14 }}>載入中...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8" }}>
      <div style={{ background: "#fff", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "0.5px solid #D3D1C7" }}>
        <a href="/" style={{ fontSize: 14, color: "#534AB7", textDecoration: "none" }}>← 首頁</a>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#2C2C2A" }}>會員中心</span>
        <button onClick={handleLogout} style={{ fontSize: 12, color: "#888780", background: "none", border: "none", cursor: "pointer" }}>登出</button>
      </div>

      <div style={{ padding: 16 }}>
        {/* 會員資料 */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, border: "0.5px solid #D3D1C7" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <img src={user?.user_metadata?.avatar_url || "/logo.png"} alt="avatar" style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#2C2C2A" }}>{user?.user_metadata?.full_name || "會員"}</div>
              <div style={{ fontSize: 12, color: "#888780" }}>{user?.email}</div>
              {customerNo && <div style={{ fontSize: 11, color: "#534AB7", background: "#EEEDFE", borderRadius: 6, padding: "2px 8px", display: "inline-block", marginTop: 4 }}>{customerNo}</div>}
            </div>
            <button onClick={() => setShowEdit(!showEdit)} style={{ fontSize: 11, color: "#534AB7", background: "#EEEDFE", border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>
              編輯資料
            </button>
          </div>

          {showEdit && (
            <div style={{ background: "#F1EFE8", borderRadius: 10, padding: 12 }}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "#888780", marginBottom: 4 }}>姓名</div>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "#888780", marginBottom: 4 }}>手機號碼</div>
                <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="09xx-xxx-xxx" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              <button
                onClick={async () => {
                  setSaving(true);
                  await supabase.from("customers").upsert({ id: user.id, name: editName, phone: editPhone, email: user.email });
                  await supabase.auth.updateUser({ data: { full_name: editName } });
                  setSaving(false);
                  setShowEdit(false);
                  setUser((prev: any) => ({ ...prev, user_metadata: { ...prev.user_metadata, full_name: editName } }));
                }}
                style={{ width: "100%", padding: "9px 0", background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                {saving ? "儲存中..." : "儲存"}
              </button>
            </div>
          )}
        </div>

        {/* 預約紀錄 Tab */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {[
            { key: "upcoming", label: `即將到來 (${upcomingBookings.length})` },
            { key: "past", label: `歷史紀錄 (${pastBookings.length})` }
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key as "upcoming" | "past")} style={{ flex: 1, padding: "8px 0", borderRadius: 20, border: "none", background: tab === t.key ? "#534AB7" : "#fff", color: tab === t.key ? "#fff" : "#5F5E5A", fontSize: 12, fontWeight: tab === t.key ? 600 : 400, cursor: "pointer" }}>
              {t.label}
            </button>
          ))}
        </div>

        {displayBookings.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#888780", fontSize: 14 }}>
            {tab === "upcoming" ? "目前沒有即將到來的預約" : "沒有歷史預約紀錄"}
          </div>
        ) : (
          displayBookings.map((b) => (
            <div key={b.id} style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 8, border: "0.5px solid #D3D1C7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#2C2C2A" }}>
                  {b.booking_date.replace(/-/g, "/")} {b.booking_time}
                </div>
                <div style={{
                  fontSize: 10, padding: "3px 8px", borderRadius: 10, fontWeight: 500,
                  background: b.status === "confirmed" ? "#E1F5EE" : b.status === "cancelled" ? "#FCEBEB" : "#FAEEDA",
                  color: b.status === "confirmed" ? "#085041" : b.status === "cancelled" ? "#A32D2D" : "#633806",
                }}>
                  {b.status === "confirmed" ? "已確認" : b.status === "cancelled" ? "已取消" : "待確認"}
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#5F5E5A", marginBottom: 3 }}>設計師：{getDesignerName(b.designer_id)}</div>
              <div style={{ fontSize: 12, color: "#5F5E5A", marginBottom: b.note ? 3 : 0 }}>服務：{getServiceNames(b.service_ids)}</div>
              {b.note && <div style={{ fontSize: 11, color: "#888780", background: "#F1EFE8", borderRadius: 6, padding: "4px 8px", marginTop: 6 }}>備註：{b.note}</div>}
            </div>
          ))
        )}

        <div style={{ textAlign: "center", marginTop: 16, paddingBottom: 32 }}>
          <a href="/booking/step/1" style={{ display: "inline-block", padding: "12px 32px", background: "#534AB7", color: "#fff", borderRadius: 12, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
            ＋ 新增預約
          </a>
        </div>
      </div>
    </div>
  );
}
