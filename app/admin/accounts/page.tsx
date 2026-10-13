"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminBottomNav from "../components/BottomNav";
import { supabase } from "../../../lib/supabase";
import { adminRoleSettingKey, readAdminSession, type AdminRole } from "../../../lib/adminSession";
import { adminPermissionSettingKey, allAdminPermissions, defaultManagerPermissions, hasPermission, permissionGroups, permissionsForRole, type AdminAccess, type AdminPermission } from "../../../lib/adminPermissions";

type AdminAccount = {
  id: number;
  username: string;
  password_hash: string;
  role: AdminRole;
  role_name: string;
  permissions: AdminPermission[];
};

type RoleTemplate = AdminAccess & {
  id: string;
};

const roleTemplateKey = (id: string) => `admin_role_template_${id}`;

export default function AdminAccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [roleTemplates, setRoleTemplates] = useState<RoleTemplate[]>([]);
  const [selectedRole, setSelectedRole] = useState("new");
  const [resetTarget, setResetTarget] = useState<AdminAccount | null>(null);
  const [resetForm, setResetForm] = useState({ password: "", confirm: "", visible: false });
  const [resetSaving, setResetSaving] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", role: "manager" as AdminRole, role_name: "店長管理員", permissions: defaultManagerPermissions });
  const currentSession = readAdminSession();

  useEffect(() => {
    const session = readAdminSession();
    if (!session) {
      router.push("/admin/login");
      return;
    }
    if (!hasPermission("admin_accounts", permissionsForRole(session.role, session).permissions)) {
      router.push("/admin/dashboard");
      return;
    }
    async function load() {
      const [{ data: authData, error: authError }, { data: roleData, error: roleError }, { data: permissionData, error: permissionError }, { data: templateData, error: templateError }] = await Promise.all([
        supabase.from("admin_auth").select("id, username, password_hash").order("id"),
        supabase.from("shop_info").select("key, value").like("key", "admin_role_%"),
        supabase.from("shop_info").select("key, value").like("key", "admin_permissions_%"),
        supabase.from("shop_info").select("key, value").like("key", "admin_role_template_%").order("sort_order"),
      ]);
      if (authError || roleError || permissionError || templateError) {
        setNotice("帳號資料載入失敗，請重新整理");
        setLoading(false);
        return;
      }
      const roles = Object.fromEntries((roleData || []).map((item) => [item.key.replace("admin_role_", ""), item.value]));
      const accessByUsername = Object.fromEntries((permissionData || []).map((item) => {
        try {
          return [item.key.replace("admin_permissions_", ""), JSON.parse(item.value || "{}")];
        } catch {
          return [item.key.replace("admin_permissions_", ""), null];
        }
      }));
      setAccounts((authData || []).map((account) => ({
        ...account,
        role: roles[account.username] === "manager" ? "manager" : "owner",
        ...permissionsForRole(roles[account.username] === "manager" ? "manager" : "owner", accessByUsername[account.username]),
      })) as AdminAccount[]);
      setRoleTemplates((templateData || []).flatMap((item) => {
        try {
          const access = JSON.parse(item.value || "{}");
          return [{ id: item.key.replace("admin_role_template_", ""), ...permissionsForRole("manager", access) }];
        } catch {
          return [];
        }
      }));
      setLoading(false);
    }
    void load();
  }, [router]);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  async function saveRole(username: string, role: AdminRole) {
    const key = adminRoleSettingKey(username);
    const { data: existing, error: lookupError } = await supabase.from("shop_info").select("id").eq("key", key).maybeSingle();
    if (lookupError) throw lookupError;
    const result = existing
      ? await supabase.from("shop_info").update({ value: role, is_active: true }).eq("id", existing.id)
      : await supabase.from("shop_info").insert({ key, label: `${username} 後台權限`, value: role, is_active: true, sort_order: 95 });
    if (result.error) throw result.error;
  }

  async function saveAccess(username: string, access: AdminAccess) {
    const key = adminPermissionSettingKey(username);
    const { data: existing, error: lookupError } = await supabase.from("shop_info").select("id").eq("key", key).maybeSingle();
    if (lookupError) throw lookupError;
    const value = JSON.stringify(access);
    const result = existing
      ? await supabase.from("shop_info").update({ value, is_active: true }).eq("id", existing.id)
      : await supabase.from("shop_info").insert({ key, label: `${username} 後台功能權限`, value, is_active: true, sort_order: 96 });
    if (result.error) throw result.error;
  }

  async function applyRoleTemplate(account: AdminAccount, templateId: string) {
    if (templateId === "owner") {
      await changeRole(account, "owner");
      return;
    }
    const template = roleTemplates.find((item) => item.id === templateId);
    if (!template) return;
    try {
      await saveRole(account.username, "manager");
      await saveAccess(account.username, template);
      setAccounts(accounts.map((item) => item.id === account.id ? { ...item, role: "manager", ...template } : item));
      setNotice(`已套用「${template.role_name}」；該帳號下次登入時生效`);
    } catch {
      setNotice("角色套用失敗，請再試一次");
    }
  }

  async function addAccount() {
    if (!form.username.trim() || !form.password.trim()) {
      setNotice("請填寫帳號與密碼");
      return;
    }
    if (accounts.some((account) => account.username.toLowerCase() === form.username.trim().toLowerCase())) {
      setNotice("此帳號已存在");
      return;
    }
    if (form.role === "manager" && !form.role_name.trim()) {
      setNotice("請填寫角色名稱");
      return;
    }
    if (form.role === "manager" && selectedRole === "new" && roleTemplates.some((role) => role.role_name.toLowerCase() === form.role_name.trim().toLowerCase())) {
      setNotice("此角色名稱已存在，請直接選擇既有角色");
      return;
    }
    setSaving(true);
    setNotice("");
    const username = form.username.trim();
    const { data, error } = await supabase.from("admin_auth").insert({ username, password_hash: form.password }).select("id, username, password_hash").single();
    if (error || !data) {
      setNotice("新增帳號失敗，請再試一次");
      setSaving(false);
      return;
    }
    try {
      await saveRole(username, form.role);
      const access = permissionsForRole(form.role, { role_name: form.role_name, permissions: form.permissions });
      await saveAccess(username, access);
      if (form.role === "manager" && selectedRole === "new") {
        const id = `${Date.now()}`;
        const { error: templateError } = await supabase.from("shop_info").insert({
          key: roleTemplateKey(id),
          label: `${access.role_name} 權限角色`,
          value: JSON.stringify(access),
          is_active: true,
          sort_order: 94,
        });
        if (templateError) throw templateError;
        setRoleTemplates([...roleTemplates, { id, ...access }]);
      }
      setAccounts([...accounts, { ...data, role: form.role, ...access }]);
      setForm({ username: "", password: "", role: "manager", role_name: "店長管理員", permissions: defaultManagerPermissions });
      setSelectedRole("new");
      setNotice("後台帳號已新增");
    } catch {
      await supabase.from("admin_auth").delete().eq("id", data.id);
      setNotice("權限設定失敗，帳號未新增");
    }
    setSaving(false);
  }

  async function changeRole(account: AdminAccount, role: AdminRole) {
    const ownerCount = accounts.filter((item) => item.role === "owner").length;
    if (account.role === "owner" && role === "manager" && ownerCount <= 1) {
      setNotice("至少必須保留一位最高管理員");
      return;
    }
    try {
      await saveRole(account.username, role);
      const access = role === "owner"
        ? permissionsForRole("owner")
        : permissionsForRole("manager", account.role === "owner" ? { role_name: "店長管理員", permissions: defaultManagerPermissions } : account);
      await saveAccess(account.username, access);
      setAccounts(accounts.map((item) => item.id === account.id ? { ...item, role, ...access } : item));
      setNotice("權限已更新；該帳號下次登入時生效");
    } catch {
      setNotice("權限更新失敗，請再試一次");
    }
  }

  async function updateAccess(account: AdminAccount, next: Partial<AdminAccess>) {
    const access = permissionsForRole(account.role, { ...account, ...next });
    try {
      await saveAccess(account.username, access);
      setAccounts(accounts.map((item) => item.id === account.id ? { ...item, ...access } : item));
      setNotice("功能權限已更新；該帳號下次登入時生效");
    } catch {
      setNotice("功能權限更新失敗，請再試一次");
    }
  }

  async function resetPassword() {
    if (!resetTarget || resetForm.password.length < 8) { setNotice("新密碼至少需要 8 個字元"); return; }
    if (resetForm.password !== resetForm.confirm) { setNotice("兩次輸入的密碼不一致"); return; }
    if (!window.confirm(`確定要變更 ${resetTarget.username} 的登入密碼？變更後該帳號會立即登出。`)) return;
    setResetSaving(true);
    const { error } = await supabase.functions.invoke("admin-login", { body: { action: "reset", username: resetTarget.username, password: resetForm.password } });
    if (error) { setNotice("密碼更新失敗，請確認該帳號已完成首次登入"); setResetSaving(false); return; }
    const isCurrent = resetTarget.username === currentSession?.username;
    setResetTarget(null); setResetForm({ password: "", confirm: "", visible: false }); setResetSaving(false);
    if (isCurrent) { await supabase.auth.signOut(); sessionStorage.removeItem("adminSession"); router.replace("/admin/login"); return; }
    setNotice("密碼已更新，該帳號已登出，請使用新密碼重新登入");
  }

  async function deleteAccount(account: AdminAccount) {
    if (account.username === currentSession?.username) {
      setNotice("無法刪除目前登入中的帳號");
      return;
    }
    if (account.role === "owner" && accounts.filter((item) => item.role === "owner").length <= 1) {
      setNotice("至少必須保留一位最高管理員");
      return;
    }
    if (!window.confirm(`確定刪除後台帳號 ${account.username}？`)) return;
    const { error } = await supabase.functions.invoke("admin-login", { body: { action: "delete", username: account.username } });
    if (error) {
      setNotice("刪除失敗，請再試一次");
      return;
    }
    await Promise.all([
      supabase.from("shop_info").delete().eq("key", adminRoleSettingKey(account.username)),
      supabase.from("shop_info").delete().eq("key", adminPermissionSettingKey(account.username)),
    ]);
    setAccounts(accounts.filter((item) => item.id !== account.id));
    setNotice("帳號已刪除");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", paddingBottom: 80, paddingLeft: isDesktop ? 220 : 0 }}>
      <div className="admin-topbar" style={{ background: "#1A1A1A", padding: "14px 18px", color: "#fff", fontSize: 15, fontWeight: 800 }}>後台帳號權限</div>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: 18, display: "grid", gridTemplateColumns: isDesktop ? "320px minmax(0, 1fr)" : "1fr", gap: 14, alignItems: "start" }}>
        <div style={{ background: "#fff", border: "1px solid #E5E1D7", borderRadius: 18, padding: 18, gridColumn: isDesktop ? 2 : 1, gridRow: isDesktop ? 1 : 2 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#2C2C2A" }}>新增後台帳號</div>
          <div style={{ fontSize: 11, color: "#888780", marginTop: 4, marginBottom: 14 }}>最高管理員可查看合約與管理帳號；店長管理員只處理日常營運。</div>
          <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "minmax(0, 1fr) minmax(0, 1fr) 180px auto" : "1fr", gap: 10 }}>
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="登入帳號" style={{ padding: "10px 12px", border: "1px solid #D3D1C7", borderRadius: 10, fontSize: 13 }} />
            <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="登入密碼" style={{ padding: "10px 12px", border: "1px solid #D3D1C7", borderRadius: 10, fontSize: 13 }} />
            <select value={selectedRole} onChange={(e) => {
              const value = e.target.value;
              setSelectedRole(value);
              if (value === "owner") {
                setForm({ ...form, role: "owner", role_name: "最高管理員", permissions: allAdminPermissions });
                return;
              }
              const template = roleTemplates.find((item) => item.id === value);
              setForm(template
                ? { ...form, role: "manager", role_name: template.role_name, permissions: template.permissions }
                : { ...form, role: "manager", role_name: "", permissions: defaultManagerPermissions });
            }} style={{ padding: "10px 12px", border: "1px solid #D3D1C7", borderRadius: 10, background: "#fff", fontSize: 13 }}>
              <option value="new">＋新增角色</option>
              {roleTemplates.map((role) => <option key={role.id} value={role.id}>{role.role_name}</option>)}
              <option value="owner">最高管理員</option>
            </select>
            <button onClick={addAccount} disabled={saving} style={{ padding: "10px 18px", border: "none", borderRadius: 10, background: "#534AB7", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>{saving ? "新增中" : "新增帳號"}</button>
          </div>
          {form.role === "manager" && (
            <div style={{ marginTop: 14, background: "#F8F7F3", borderRadius: 14, padding: 14 }}>
              <div style={{ display: "flex", gap: 10, alignItems: isDesktop ? "center" : "stretch", flexDirection: isDesktop ? "row" : "column", marginBottom: 12 }}>
                <input value={form.role_name} onChange={(e) => setForm({ ...form, role_name: e.target.value })} disabled={selectedRole !== "new"} placeholder="角色名稱，例如：櫃台、店長" style={{ flex: 1, padding: "9px 11px", border: "1px solid #D3D1C7", borderRadius: 9, fontSize: 12, background: selectedRole === "new" ? "#fff" : "#F1EFE8" }} />
                <button type="button" disabled={selectedRole !== "new"} onClick={() => setForm({ ...form, permissions: allAdminPermissions })} style={{ padding: "8px 12px", border: "1px solid #D3D1C7", borderRadius: 9, background: "#fff", color: "#534AB7", fontSize: 11, fontWeight: 800, opacity: selectedRole === "new" ? 1 : 0.45 }}>全部勾選</button>
                <button type="button" disabled={selectedRole !== "new"} onClick={() => setForm({ ...form, permissions: [] })} style={{ padding: "8px 12px", border: "1px solid #D3D1C7", borderRadius: 9, background: "#fff", color: "#888780", fontSize: 11, fontWeight: 800, opacity: selectedRole === "new" ? 1 : 0.45 }}>全部清除</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(3, minmax(0, 1fr))" : "1fr", gap: 10 }}>
                {permissionGroups.map((group) => (
                  <div key={group.label} style={{ background: "#fff", borderRadius: 12, padding: 11 }}>
                    <div style={{ fontSize: 11, color: "#888780", fontWeight: 800, marginBottom: 7 }}>{group.label}</div>
                    {group.items.map((item) => (
                      <label key={item.key} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 0", color: "#2C2C2A", fontSize: 12, cursor: "pointer" }}>
                        <input type="checkbox" disabled={selectedRole !== "new"} checked={form.permissions.includes(item.key)} onChange={(e) => setForm({ ...form, permissions: e.target.checked ? [...form.permissions, item.key] : form.permissions.filter((permission) => permission !== item.key) })} />
                        {item.label}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {notice && <div style={{ padding: "10px 12px", borderRadius: 10, background: notice.includes("失敗") || notice.includes("無法") || notice.includes("至少") ? "#FCEBEB" : "#E1F5EE", color: notice.includes("失敗") || notice.includes("無法") || notice.includes("至少") ? "#A32D2D" : "#085041", fontSize: 12, fontWeight: 800, gridColumn: isDesktop ? 2 : 1, gridRow: isDesktop ? 2 : 3 }}>{notice}</div>}

        <div style={{ display: "grid", gap: 10, gridColumn: 1, gridRow: isDesktop ? "1 / span 2" : 1 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#2C2C2A", padding: "2px 2px 4px" }}>已新增帳號（{accounts.length}）</div>
          {loading ? <div style={{ color: "#888780" }}>載入中...</div> : accounts.map((account) => (
            <details key={account.id} style={{ background: "#fff", border: "1px solid #E5E1D7", borderRadius: 14, padding: "10px 12px" }}>
              <summary style={{ display: "grid", gridTemplateColumns: "44px minmax(0, 1fr) 28px", gap: 10, alignItems: "center", cursor: "pointer", listStyle: "none" }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", display: "grid", placeItems: "center", background: "#EEEDFE", color: "#534AB7", fontWeight: 900, fontSize: 16 }}>{account.username.charAt(0).toUpperCase()}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: "#2C2C2A", overflow: "hidden", textOverflow: "ellipsis" }}>{account.username}</span>
                    {account.username === currentSession?.username && <span style={{ padding: "2px 6px", borderRadius: 999, background: "#EEEDFE", color: "#534AB7", fontSize: 9, fontWeight: 800 }}>目前登入</span>}
                  </div>
                  <div style={{ fontSize: 10, color: "#888780", marginTop: 3 }}>{account.role_name}{account.role === "manager" ? ` · ${account.permissions.length} 項權限` : ""}</div>
                </div>
                <div style={{ width: 26, height: 26, borderRadius: "50%", display: "grid", placeItems: "center", background: "#F1EFE8", color: "#5F5E5A", fontSize: 16 }}>›</div>
              </summary>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #EEEAE2", display: "grid", gap: 8 }}>
                <select value={account.role === "owner" ? "owner" : roleTemplates.find((role) => role.role_name === account.role_name)?.id || "custom"} onChange={(e) => {
                  if (e.target.value === "custom") return;
                  void applyRoleTemplate(account, e.target.value);
                }} style={{ padding: "9px 10px", border: "1px solid #D3D1C7", borderRadius: 9, background: account.role === "owner" ? "#EEEDFE" : "#F8F7F3", color: account.role === "owner" ? "#534AB7" : "#5F5E5A", fontSize: 12, fontWeight: 800 }}>
                  <option value="owner">最高管理員</option>
                  <option value="custom">自訂：{account.role_name}</option>
                  {roleTemplates.map((role) => <option key={role.id} value={role.id}>{role.role_name}</option>)}
                </select>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button onClick={() => { setResetTarget(account); setResetForm({ password: "", confirm: "", visible: false }); setNotice(""); }} style={{ padding: "8px 10px", border: "1px solid #D3D1C7", borderRadius: 9, background: "#fff", color: "#534AB7", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>重設密碼</button>
                  <button onClick={() => deleteAccount(account)} disabled={account.username === currentSession?.username} style={{ padding: "8px 10px", border: "none", borderRadius: 9, background: account.username === currentSession?.username ? "#F1EFE8" : "#FCEBEB", color: account.username === currentSession?.username ? "#AAA" : "#A32D2D", fontSize: 11, fontWeight: 800, cursor: account.username === currentSession?.username ? "default" : "pointer" }}>刪除</button>
                </div>
                {account.role === "manager" && (
                  <div style={{ marginTop: 2 }}>
                    <div style={{ display: "flex", gap: 8, flexDirection: "column", marginBottom: 10 }}>
                      <input value={account.role_name} onChange={(e) => setAccounts(accounts.map((item) => item.id === account.id ? { ...item, role_name: e.target.value } : item))} onBlur={(e) => updateAccess(account, { role_name: e.target.value })} style={{ flex: 1, padding: "8px 10px", border: "1px solid #D3D1C7", borderRadius: 9, fontSize: 12 }} />
                      <button type="button" onClick={() => updateAccess(account, { permissions: allAdminPermissions })} style={{ padding: "8px 11px", border: "1px solid #D3D1C7", borderRadius: 9, background: "#fff", color: "#534AB7", fontSize: 11, fontWeight: 800 }}>全部勾選</button>
                      <button type="button" onClick={() => updateAccess(account, { permissions: [] })} style={{ padding: "8px 11px", border: "1px solid #D3D1C7", borderRadius: 9, background: "#fff", color: "#888780", fontSize: 11, fontWeight: 800 }}>全部清除</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                      {permissionGroups.map((group) => (
                        <div key={group.label} style={{ background: "#F8F7F3", borderRadius: 10, padding: 10 }}>
                          <div style={{ fontSize: 10, color: "#888780", fontWeight: 800, marginBottom: 5 }}>{group.label}</div>
                          {group.items.map((permission) => (
                            <label key={permission.key} style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 0", fontSize: 11, color: "#2C2C2A", cursor: "pointer" }}>
                              <input type="checkbox" checked={account.permissions.includes(permission.key)} onChange={(e) => updateAccess(account, { permissions: e.target.checked ? [...account.permissions, permission.key] : account.permissions.filter((item) => item !== permission.key) })} />
                              {permission.label}
                            </label>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </details>
          ))}
          {!loading && <div style={{ padding: "8px 4px", color: "#888780", fontSize: 10 }}>點選帳號可查看與編輯權限</div>}
        </div>
      </div>
      {resetTarget && <div onClick={() => !resetSaving && setResetTarget(null)} style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(24,24,22,.58)", display: "grid", placeItems: "center", padding: 18 }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 430, background: "#fff", borderRadius: 18, padding: 20, boxShadow: "0 24px 70px rgba(0,0,0,.25)" }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#2C2C2A" }}>重設 {resetTarget.username} 的密碼</div>
          <div style={{ marginTop: 5, marginBottom: 16, fontSize: 11, color: "#888780" }}>完成後會自動登出此帳號，所有裝置都必須使用新密碼重新登入。</div>
          {([{"key":"password","label":"新密碼"},{"key":"confirm","label":"再次輸入新密碼"}] as const).map((field) => <label key={field.key} style={{ display: "block", marginBottom: 12 }}>
            <span style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 800, color: "#5F5E5A" }}>{field.label}</span>
            <input type={resetForm.visible ? "text" : "password"} value={resetForm[field.key]} onChange={(e) => setResetForm({ ...resetForm, [field.key]: e.target.value })} autoComplete="new-password" style={{ width: "100%", boxSizing: "border-box", padding: "11px 12px", border: "1px solid #D3D1C7", borderRadius: 10, fontSize: 14 }} />
          </label>)}
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: 12, color: "#5F5E5A", cursor: "pointer" }}><input type="checkbox" checked={resetForm.visible} onChange={(e) => setResetForm({ ...resetForm, visible: e.target.checked })} />顯示密碼</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
            <button onClick={() => setResetTarget(null)} disabled={resetSaving} style={{ padding: 11, border: "1px solid #D3D1C7", borderRadius: 10, background: "#fff", color: "#5F5E5A", fontWeight: 800 }}>取消</button>
            <button onClick={resetPassword} disabled={resetSaving || !resetForm.password || !resetForm.confirm} style={{ padding: 11, border: "none", borderRadius: 10, background: resetSaving ? "#AAA" : "#534AB7", color: "#fff", fontWeight: 800 }}>{resetSaving ? "更新中..." : "確認變更密碼"}</button>
          </div>
        </div>
      </div>}
      <AdminBottomNav current="admin-accounts" />
    </div>
  );
}
