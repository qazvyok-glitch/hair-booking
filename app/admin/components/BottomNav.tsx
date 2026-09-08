"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type NavItem = {
  key: string;
  label: string;
  icon: string;
  path: string;
};

type NavSection =
  | (NavItem & { type: "single" })
  | {
      type: "group";
      key: string;
      label: string;
      icon: string;
      children: NavItem[];
    };

export default function AdminBottomNav({ current }: { current: string }) {
  const router = useRouter();
  const [isDesktop, setIsDesktop] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    reports: current === "report" || current.startsWith("report-"),
    work: current === "bookings",
    people: current === "designers" || current === "permissions",
    catalog: ["services", "products", "inventory", "prices"].includes(current),
  });

  function logout() {
    sessionStorage.removeItem("adminSession");
    router.push("/admin/login");
  }


  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const mobileItems = [
    { key: "dashboard", label: "總覽", icon: "📊", path: "/admin/dashboard" },
    { key: "bookings", label: "工作", icon: "📋", path: "/admin/bookings" },
    { key: "report", label: "報表", icon: "📈", path: "/admin/report" },
    { key: "members", label: "會員", icon: "👥", path: "/admin/members" },
    { key: "products", label: "商品", icon: "🛍️", path: "/admin/products" },
  ];

  const sidebarSections: NavSection[] = [
    {
      type: "single",
      key: "dashboard",
      label: "總覽",
      icon: "📊",
      path: "/admin/dashboard",
    },
    {
      type: "group",
      key: "reports",
      label: "報表",
      icon: "📈",
      children: [
        { key: "report-shop", label: "店舖報表", icon: "🏪", path: "/admin/report/shop" },
        { key: "report-designer", label: "設計師報表", icon: "🧾", path: "/admin/report/designer" },
      ],
    },
    {
      type: "group",
      key: "work",
      label: "工作管理",
      icon: "📋",
      children: [
        { key: "bookings", label: "預約總覽、管理", icon: "🗓️", path: "/admin/bookings?view=list" },
        { key: "schedule", label: "排班 / 公休", icon: "🕒", path: "/admin/bookings?view=calendar" },
      ],
    },
    {
      type: "group",
      key: "people",
      label: "人員管理",
      icon: "🧑‍💼",
      children: [
        { key: "designers", label: "設計師管理", icon: "💇", path: "/admin/designers" },
        { key: "permissions", label: "權限 / 職務", icon: "🔐", path: "/admin/designers/permissions" },
      ],
    },
    {
      type: "single",
      key: "members",
      label: "會員管理",
      icon: "👥",
      path: "/admin/members",
    },
    {
      type: "group",
      key: "catalog",
      label: "服務與商品",
      icon: "🧰",
      children: [
        { key: "prices", label: "價目表", icon: "💴", path: "/admin/prices" },
        { key: "products", label: "商品管理", icon: "🛍️", path: "/admin/products" },
        { key: "inventory", label: "庫存 / 進貨 / 盤點", icon: "📦", path: "/admin/inventory" },
        { key: "services", label: "服務分類設定", icon: "🏷️", path: "/admin/services" },
      ],
    },
    {
      type: "single",
      key: "announcements",
      label: "公告",
      icon: "📢",
      path: "/admin/announcements",
    },
  ];

  const isChildActive = (key: string) => {
    if (key === "report-shop") return current === "report" || current === "report-shop";
    if (key === "report-designer") return current === "report-designer";
    if (key === "bookings") return current === "bookings";
    if (key === "schedule") return false;
    if (key === "permissions") return current === "permissions";
    return current === key;
  };

  const isSectionActive = (section: NavSection) => {
    if (section.type === "single") return current === section.key;
    return section.children.some((child) => isChildActive(child.key));
  };

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const navigate = (path: string) => {
    router.push(path);
  };

  if (isDesktop) {
    return (
      <div style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 220, background: "#1A1A1A", display: "flex", flexDirection: "column", padding: "24px 0", zIndex: 50, borderRight: "0.5px solid #333" }}>
        <div style={{ padding: "0 20px 24px", borderBottom: "0.5px solid #333", marginBottom: 16 }}>
          <img src="/logo.png" alt="logo" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>後台管理</div>
          <div style={{ fontSize: 11, color: "#888780" }}>Bing Cherry Hair Salon</div>
        </div>
        <div style={{ overflowY: "auto", paddingBottom: 10 }}>
          {sidebarSections.map((section) => {
            const active = isSectionActive(section);
            if (section.type === "single") {
              return (
                <button key={section.key} onClick={() => navigate(section.path)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", background: active ? "#2C2840" : "none", border: "none", cursor: "pointer", borderLeft: active ? "3px solid #534AB7" : "3px solid transparent", textAlign: "left" }}>
                  <span style={{ fontSize: 20 }}>{section.icon}</span>
                  <span style={{ fontSize: 13, color: active ? "#C8C4F8" : "#fff", fontWeight: active ? 700 : 500 }}>{section.label}</span>
                </button>
              );
            }
            return (
              <div key={section.key}>
                <button onClick={() => toggleGroup(section.key)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", background: active ? "#2C2840" : "none", border: "none", cursor: "pointer", borderLeft: active ? "3px solid #534AB7" : "3px solid transparent", textAlign: "left" }}>
                  <span style={{ fontSize: 20 }}>{section.icon}</span>
                  <span style={{ flex: 1, fontSize: 13, color: active ? "#C8C4F8" : "#fff", fontWeight: active ? 700 : 500 }}>{section.label}</span>
                  <span style={{ fontSize: 12, color: active ? "#C8C4F8" : "#888780" }}>{openGroups[section.key] ? "⌄" : "›"}</span>
                </button>
                {openGroups[section.key] && (
                  <div style={{ padding: "2px 10px 8px 34px" }}>
                    {section.children.map((child) => {
                      const childActive = isChildActive(child.key);
                      return (
                        <button key={child.key} onClick={() => navigate(child.path)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", marginTop: 3, background: childActive ? "#F1EEFF" : "transparent", border: "none", borderRadius: 10, cursor: "pointer", textAlign: "left" }}>
                          <span style={{ fontSize: 15 }}>{child.icon}</span>
                          <span style={{ fontSize: 12, color: childActive ? "#534AB7" : "#D8D5CD", fontWeight: childActive ? 800 : 500 }}>{child.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={logout} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", background: "none", border: "none", cursor: "pointer", borderLeft: "3px solid transparent", textAlign: "left", width: "100%" }}>
          <span style={{ fontSize: 20 }}>⏏</span>
          <span style={{ fontSize: 13, color: "#888780" }}>登出</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 390, background: "#1A1A1A", borderTop: "0.5px solid #333", display: "flex", zIndex: 50 }}>
      {mobileItems.map((item) => (
        <button key={item.key} onClick={() => router.push(item.path)} style={{ flex: 1, padding: "10px 0", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <span style={{ fontSize: 22 }}>{item.icon}</span>
          <span style={{ fontSize: 11, color: current === item.key ? "#C8C4F8" : "#fff", fontWeight: current === item.key ? 600 : 400 }}>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
