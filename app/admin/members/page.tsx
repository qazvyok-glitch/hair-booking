"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminBottomNav from "../components/BottomNav";

type Member = {
  id: string;
  name: string;
  phone: string;
  email: string;
  customer_no: string;
  created_at: string;
};

type Booking = {
  id: number;
  user_id: string;
  booking_date: string;
  status: string;
};

export default function AdminMembers() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

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
      const [{ data: mData }, { data: bData }] = await Promise.all([
        supabase.from("customers").select("*").order("customer_no"),
        supabase.from("bookings").select("id, user_id, booking_date, status"),
      ]);
      if (mData) setMembers(mData);
      if (bData) setBookings(bData);
      setLoading(false);
    }
    fetchData();
  }, [router]);

  const filtered = members.filter(m =>
    (m.name || "").includes(search) ||
    (m.phone || "").includes(search) ||
    (m.email || "").includes(search) ||
    (m.customer_no || "").includes(search)
  );

  function getMemberBookings(userId: string) {
    return bookings.filter(b => b.user_id === userId);
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#534AB7", fontSize: 14 }}>載入中...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", paddingBottom: 70, paddingLeft: isDesktop ? 220 : 0 }}>
      <div style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>會員管理</div>
        <div style={{ fontSize: 12, color: "#888780" }}>共 {filtered.length} 位</div>
      </div>

      <div style={{ padding: "12px 16px 0" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋姓名、電話、Email、編號..."
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 12 }}
        />

        {isDesktop ? (
          <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #D3D1C7", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F1EFE8" }}>
                  {["編號", "姓名", "電話", "Email", "預約次數", "加入日期"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", fontSize: 12, color: "#888780", fontWeight: 600, textAlign: "left", borderBottom: "0.5px solid #D3D1C7" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const memberBookings = getMemberBookings(m.id);
                  return (
                    <tr key={m.id} onClick={() => setSelectedMember(m)} style={{ borderBottom: "0.5px solid #F1EFE8", cursor: "pointer" }}>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ fontSize: 12, color: "#534AB7", background: "#EEEDFE", borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>{m.customer_no || "—"}</span>
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: "#2C2C2A", fontWeight: 500 }}>{m.name || "—"}</td>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: "#5F5E5A" }}>{m.phone || "—"}</td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: "#888780" }}>{m.email || "—"}</td>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: "#2C2C2A" }}>{memberBookings.length} 次</td>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: "#888780" }}>{m.created_at?.slice(0, 10).replace(/-/g, "/")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          filtered.map((m) => {
            const memberBookings = getMemberBookings(m.id);
            const confirmedCount = memberBookings.filter(b => b.status === "confirmed").length;
            return (
              <div key={m.id} onClick={() => setSelectedMember(m)} style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 8, border: "0.5px solid #D3D1C7", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: "#534AB7", background: "#EEEDFE", borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>{m.customer_no || "—"}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#2C2C2A" }}>{m.name || "未填寫"}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#888780" }}>{m.phone || "—"}</div>
                    <div style={{ fontSize: 11, color: "#888780" }}>{m.email || "—"}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#534AB7" }}>{memberBookings.length} 次</div>
                    <div style={{ fontSize: 10, color: "#888780" }}>預約紀錄</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#888780", marginTop: 6 }}>
                  加入：{m.created_at?.slice(0, 10).replace(/-/g, "/")}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 會員詳情 Modal */}
      {selectedMember && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px 16px 32px", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: "#534AB7", background: "#EEEDFE", borderRadius: 8, padding: "3px 10px", fontWeight: 700 }}>{selectedMember.customer_no}</span>
                <span style={{ fontSize: 16, fontWeight: 600, color: "#2C2C2A" }}>{selectedMember.name || "未填寫"}</span>
              </div>
              <button onClick={() => setSelectedMember(null)} style={{ background: "#F1EFE8", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer" }}>x</button>
            </div>

            <div style={{ background: "#F1EFE8", borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#888780" }}>電話</span>
                  <span style={{ color: "#2C2C2A" }}>{selectedMember.phone || "—"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#888780" }}>Email</span>
                  <span style={{ color: "#2C2C2A", fontSize: 12 }}>{selectedMember.email || "—"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#888780" }}>加入日期</span>
                  <span style={{ color: "#2C2C2A" }}>{selectedMember.created_at?.slice(0, 10).replace(/-/g, "/")}</span>
                </div>
              </div>
            </div>

            <div style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A", marginBottom: 8 }}>
              預約紀錄（{getMemberBookings(selectedMember.id).length} 筆）
            </div>
            {getMemberBookings(selectedMember.id).length === 0 ? (
              <div style={{ textAlign: "center", padding: "16px 0", color: "#888780", fontSize: 13 }}>尚無預約紀錄</div>
            ) : (
              getMemberBookings(selectedMember.id)
                .sort((a, b) => b.booking_date.localeCompare(a.booking_date))
                .map(b => (
                  <div key={b.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "0.5px solid #F1EFE8" }}>
                    <span style={{ fontSize: 13, color: "#2C2C2A" }}>{b.booking_date.replace(/-/g, "/")}</span>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, background: b.status === "confirmed" ? "#E1F5EE" : b.status === "cancelled" ? "#FCEBEB" : "#FAEEDA", color: b.status === "confirmed" ? "#085041" : b.status === "cancelled" ? "#A32D2D" : "#633806" }}>
                      {b.status === "confirmed" ? "已確認" : b.status === "cancelled" ? "已取消" : "待確認"}
                    </span>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      <AdminBottomNav current="members" />
    </div>
  );
}
