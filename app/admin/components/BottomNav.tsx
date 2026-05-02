"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminBottomNav({ current }: { current: string }) {
  const router = useRouter();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const items = [
    { key: "dashboard", label: "總覽", icon: "📊", path: "/admin/dashboard" },
    { key: "bookings", label: "預約", icon: "📅", path: "/admin/bookings" },
    { key: "members", label: "會員", icon: "👥", path: "/admin/members" },
    { key: "designers", label: "設計師", icon: "💇", path: "/admin/designers" },
    { key: "report", label: "報表", icon: "📈", path: "/admin/report" },
    { key: "services", label: "服務", icon: "✂️", path: "/admin/services" },
    { key: "products", label: "商品", icon: "🛍️", path: "/admin/products" },
    { key: "prices", label: "價目表", icon: "💴", path: "/admin/prices" },
  ];

  if (isDesktop) {
    return (
      <div style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 220, background: "#1A1A1A", display: "flex", flexDirection: "column", padding: "24px 0", zIndex: 50, borderRight: "0.5px solid #333" }}>
        <div style={{ padding: "0 20px 24px", borderBottom: "0.5px solid #333", marginBottom: 16 }}>
          <img src="/logo.png" alt="logo" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>後台管理</div>
          <div style={{ fontSize: 11, color: "#888780" }}>Bing Cherry Hair Salon</div>
        </div>
        {items.map((item) => (
          <button key={item.key} onClick={() => router.push(item.path)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", background: current === item.key ? "#2C2840" : "none", border: "none", cursor: "pointer", borderLeft: current === item.key ? "3px solid #534AB7" : "3px solid transparent", textAlign: "left" }}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span style={{ fontSize: 13, color: current === item.key ? "#C8C4F8" : "#fff", fontWeight: current === item.key ? 600 : 400 }}>{item.label}</span>
          </button>
        ))}
      </div>
    );
  }

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
