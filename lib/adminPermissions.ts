import type { AdminRole } from "./adminSession";

export type AdminPermission =
  | "dashboard"
  | "report_shop"
  | "report_designer"
  | "bookings"
  | "schedule"
  | "designers"
  | "designer_contracts"
  | "members"
  | "prices"
  | "products"
  | "inventory"
  | "services"
  | "shop"
  | "announcements"
  | "admin_accounts";

export const permissionGroups: Array<{ label: string; items: Array<{ key: AdminPermission; label: string }> }> = [
  { label: "總覽與帳務", items: [
    { key: "dashboard", label: "總覽" },
    { key: "report_shop", label: "店舖帳務與月結" },
    { key: "report_designer", label: "設計師月結" },
  ] },
  { label: "工作管理", items: [
    { key: "bookings", label: "預約總覽與管理" },
    { key: "schedule", label: "排班／公休" },
  ] },
  { label: "人員與會員", items: [
    { key: "designers", label: "設計師基本資料" },
    { key: "designer_contracts", label: "設計師合約與月結" },
    { key: "members", label: "會員管理" },
    { key: "admin_accounts", label: "後台帳號權限" },
  ] },
  { label: "服務與商品", items: [
    { key: "prices", label: "價目表" },
    { key: "products", label: "商品管理" },
    { key: "inventory", label: "庫存／進貨／盤點" },
    { key: "services", label: "服務分類設定" },
  ] },
  { label: "店家設定", items: [
    { key: "shop", label: "店家資訊" },
    { key: "announcements", label: "公告" },
  ] },
];

export const allAdminPermissions = permissionGroups.flatMap((group) => group.items.map((item) => item.key));

export const defaultManagerPermissions: AdminPermission[] = [
  "dashboard", "bookings", "schedule", "designers", "members", "prices", "products", "inventory", "services", "announcements",
];

export type AdminAccess = {
  role_name: string;
  permissions: AdminPermission[];
};

export function permissionsForRole(role: AdminRole, saved?: Partial<AdminAccess> | null): AdminAccess {
  if (role === "owner") return { role_name: "最高管理員", permissions: allAdminPermissions };
  return {
    role_name: saved?.role_name || "店長管理員",
    permissions: Array.isArray(saved?.permissions) ? saved.permissions : defaultManagerPermissions,
  };
}

export function hasPermission(permission: AdminPermission, permissions?: AdminPermission[]) {
  return Boolean(permissions?.includes(permission));
}

export function permissionForPath(pathname: string): AdminPermission | null {
  if (pathname === "/admin/login" || pathname === "/admin") return null;
  if (pathname.startsWith("/admin/accounts")) return "admin_accounts";
  if (pathname.startsWith("/admin/report/import")) return "admin_accounts";
  if (pathname.startsWith("/admin/report/designer")) return "report_designer";
  if (pathname.startsWith("/admin/report/settlement")) return "report_shop";
  if (pathname.startsWith("/admin/report/shop") || pathname === "/admin/report") return "report_shop";
  if (pathname.startsWith("/admin/bookings")) return pathname.includes("view=calendar") ? "schedule" : "bookings";
  if (pathname.startsWith("/admin/designer-prices")) return "prices";
  if (pathname.startsWith("/admin/designers")) return "designers";
  if (pathname.startsWith("/admin/members")) return "members";
  if (pathname.startsWith("/admin/prices")) return "prices";
  if (pathname.startsWith("/admin/products")) return "products";
  if (pathname.startsWith("/admin/inventory")) return "inventory";
  if (pathname.startsWith("/admin/services")) return "services";
  if (pathname.startsWith("/admin/shop")) return "shop";
  if (pathname.startsWith("/admin/announcements")) return "announcements";
  if (pathname.startsWith("/admin/dashboard")) return "dashboard";
  return null;
}

export const adminPermissionSettingKey = (username: string) => `admin_permissions_${username}`;

export function firstAdminPath(permissions: AdminPermission[]) {
  const routes: Array<[AdminPermission, string]> = [
    ["dashboard", "/admin/dashboard"],
    ["bookings", "/admin/bookings?view=list"],
    ["schedule", "/admin/bookings?view=calendar"],
    ["members", "/admin/members"],
    ["designers", "/admin/designers"],
    ["report_shop", "/admin/report/shop"],
    ["report_designer", "/admin/report/designer"],
    ["prices", "/admin/prices"],
    ["products", "/admin/products"],
    ["inventory", "/admin/inventory"],
    ["services", "/admin/services"],
    ["shop", "/admin/shop"],
    ["announcements", "/admin/announcements"],
    ["admin_accounts", "/admin/accounts"],
  ];
  return routes.find(([permission]) => permissions.includes(permission))?.[1] || "/admin/login";
}
