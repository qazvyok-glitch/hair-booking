"use client";
import { useRouter } from "next/navigation";

export default function BottomNav({ current }: { current: string }) {
  const router = useRouter();
  const items = [
    { key: "dashboard", label: "今日", icon: "01", path: "/designer/dashboard" },
    { key: "schedule", label: "班表", icon: "02", path: "/designer/schedule" },
    { key: "transaction", label: "結帳", icon: "03", path: "/designer/transaction" },
    { key: "customers", label: "顧客", icon: "04", path: "/designer/customers" },
    { key: "account", label: "我的", icon: "05", path: "/designer/account" },
  ];
  return (
    <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "rgba(26,26,26,0.96)", borderTop: "0.5px solid rgba(255,255,255,0.12)", display: "flex", gap: 4, zIndex: 50, padding: "5px 8px calc(5px + env(safe-area-inset-bottom))", boxShadow: "0 -8px 22px rgba(26,26,26,0.16)", backdropFilter: "blur(16px)" }}>
      {items.map((item) => (
        <button key={item.key} onClick={() => router.push(item.path)} style={{ flex: 1, padding: "5px 0", minHeight: 44, background: current === item.key ? "#fff" : "transparent", border: "none", borderRadius: 13, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
          <span style={{ fontSize: 9, letterSpacing: "0.08em", color: current === item.key ? "#7A1F1F" : "rgba(255,255,255,0.46)", fontWeight: 850, lineHeight: 1 }}>{item.icon}</span>
          <span style={{ fontSize: 14, color: current === item.key ? "#1A1A1A" : "rgba(255,255,255,0.86)", fontWeight: current === item.key ? 850 : 650, lineHeight: 1.12 }}>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
