"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminBottomNav from "../components/BottomNav";

type Designer = { id: number; name: string; nickname: string };

export default function AdminDashboard() {
  const router = useRouter();
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, today: 0, pending: 0, confirmed: 0 });
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [designerStats, setDesignerStats] = useState<Record<number, number>>({});

  useEffect(() => {
    const session = sessionStorage.getItem("adminSession");
    if (!session) { router.push("/admin/login"); return; }

    async function fetchData() {
      const today = new Date().toISOString().split("T")[0];
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;

      const [{ data: bookings }, { data: des }, { data: transactions }] = await Promise.all([
        supabase.from("bookings").select("*"),
        supabase.from("designers").select("id, name, nickname").eq("is_active", true),
        supabase.from("transactions").select("designer_id, total_amount").gte("created_at", monthStart),
      ]);

      if (bookings) {
        setStats({
          total: bookings.length,
          today: bookings.filter(b => b.booking_date === today).length,
          pending: bookings.filter(b => b.status === "pending").length,
          confirmed: bookings.filter(b => b.status === "confirmed").length,
        });
      }
      if (des) setDesigners(des);
      if (transactions) {
        const dStats: Record<number, number> = {};
        transactions.forEach((t: any) => {
          if (t.designer_id) dStats[t.designer_id] = (dStats[t.designer_id] || 0) + (t.total_amount || 0);
        });
        setDesignerStats(dStats);
      }
      setLoading(false);
    }
    fetchData();
  }, [router]);

  function logout() {
    sessionStorage.removeItem("adminSession");
    router.push("/admin/login");
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#534AB7", fontSize: 14 }}>載入中...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", paddingBottom: 70, paddingLeft: isDesktop ? 220 : 0 }}>
      <div style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.png" alt="logo" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>後台管理</div>
        </div>
        <button onClick={logout} style={{ background: "#333", color: "#888780", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>登出</button>
      </div>

      <div style={{ padding: 16 }}>
        {/* 預約統計 */}
        <div style={{ fontSize: 12, color: "#888780", marginBottom: 8, fontWeight: 600 }}>預約總覽</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { label: "今日預約", value: stats.today, color: "#534AB7", bg: "#EEEDFE" },
            { label: "待確認", value: stats.pending, color: "#BA7517", bg: "#FAEEDA" },
            { label: "已確認", value: stats.confirmed, color: "#1D9E75", bg: "#E1F5EE" },
            { label: "總預約數", value: stats.total, color: "#2C2C2A", bg: "#fff" },
          ].map((s) => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: "14px", border: "0.5px solid #D3D1C7" }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* 本月各設計師收入 */}
        <div style={{ fontSize: 12, color: "#888780", marginBottom: 8, fontWeight: 600 }}>本月設計師收入</div>
        <div style={{ background: "#fff", borderRadius: 14, padding: 14, border: "0.5px solid #D3D1C7", marginBottom: 16 }}>
          {designers.length === 0 ? (
            <div style={{ textAlign: "center", color: "#888780", fontSize: 13 }}>尚無資料</div>
          ) : (
            designers.map((d) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "0.5px solid #F1EFE8" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#2C2C2A" }}>{d.name}</div>
                  {d.nickname && <div style={{ fontSize: 11, color: "#888780" }}>{d.nickname}</div>}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#534AB7" }}>
                  ${(designerStats[d.id] || 0).toLocaleString()}
                </div>
              </div>
            ))
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid #D3D1C7" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A" }}>本月總計</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#534AB7" }}>
              ${Object.values(designerStats).reduce((a, b) => a + b, 0).toLocaleString()}
            </span>
          </div>
        </div>

        {/* 快速入口 */}
        <div style={{ fontSize: 12, color: "#888780", marginBottom: 8, fontWeight: 600 }}>快速管理</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { label: "查看所有預約", icon: "📅", path: "/admin/bookings" },
            { label: "設計師管理", icon: "💇", path: "/admin/designers" },
            { label: "管理服務項目", icon: "✂️", path: "/admin/services" },
            { label: "管理商品清單", icon: "🛍️", path: "/admin/products" },
            { label: "價目表管理", icon: "💴", path: "/admin/prices" },
            { label: "店資訊設定", icon: "🏪", path: "/admin/shop" },
          ].map((item) => (
            <button key={item.label} onClick={() => router.push(item.path)} style={{ background: "#fff", border: "0.5px solid #D3D1C7", borderRadius: 12, padding: "16px 12px", textAlign: "center", cursor: "pointer" }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{item.icon}</div>
              <div style={{ fontSize: 12, color: "#2C2C2A", fontWeight: 500 }}>{item.label}</div>
            </button>
          ))}
        </div>
      </div>

      <AdminBottomNav current="dashboard" />
    </div>
  );
}
