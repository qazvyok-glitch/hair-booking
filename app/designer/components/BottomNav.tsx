"use client";
import { useRouter } from "next/navigation";

export default function BottomNav({ current }: { current: string }) {
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
