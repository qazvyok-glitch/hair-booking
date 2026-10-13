"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { refreshAdminSession } from "../../lib/adminSession";
import { supabase } from "../../lib/supabase";
import { firstAdminPath, hasPermission, permissionForPath, permissionsForRole } from "../../lib/adminPermissions";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [allowed, setAllowed] = useState(pathname === "/admin/login" || pathname === "/admin");

  useEffect(() => {
    if (pathname === "/admin/login" || pathname === "/admin") {
      queueMicrotask(() => setAllowed(true));
      return;
    }
    void refreshAdminSession(supabase).then((session) => {
    if (!session) {
      queueMicrotask(() => setAllowed(false));
      router.replace("/admin/login");
      return;
    }
    const permission = permissionForPath(`${pathname}${window.location.search}`);
    const access = permissionsForRole(session.role, session);
    if (permission && !hasPermission(permission, access.permissions)) {
      queueMicrotask(() => setAllowed(false));
      router.replace(firstAdminPath(access.permissions));
      return;
    }
    queueMicrotask(() => setAllowed(true));
    });
  }, [pathname, router]);

  if (!allowed) return <div style={{ minHeight: "100vh", background: "#F1EFE8" }} />;
  return children;
}
