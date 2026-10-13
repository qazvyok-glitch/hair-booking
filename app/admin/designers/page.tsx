"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminBottomNav from "../components/BottomNav";
import { readAdminSession } from "../../../lib/adminSession";
import { hasPermission, permissionsForRole } from "../../../lib/adminPermissions";

type Designer = {
  id: number;
  name: string;
  display_name: string;
  nickname: string;
  initials: string;
  style: string;
  ig: string;
  bg_color: string;
  text_color: string;
  work_hours: string[];
  is_active: boolean;
  avatar_url: string;
  commission_rate: number;
  commission_base_deduction?: number;
  commission_threshold?: number;
  commission_rate_after?: number;
  brand_fee_rate?: number;
  product_commission_rate?: number;
  status: string;
  joined_date: string;
  left_date: string;
  can_view_members: boolean;
  is_manager: boolean;
  sort_order?: number | null;
};

type DesignerAuth = {
  designer_id: number;
  username: string;
  password_hash: string;
};

type SettlementItemType = "addition" | "deduction";
type SettlementCalculationType = "fixed" | "percent";
type SettlementCalculationBase = "service_revenue" | "product_revenue" | "total_revenue" | "net_income";

type SettlementItem = {
  id: number;
  designer_id: number;
  name: string;
  item_type: SettlementItemType;
  calculation_type: SettlementCalculationType;
  amount: number;
  rate: number;
  calculation_base: SettlementCalculationBase;
  include_in_bc_receivable: boolean;
  show_in_reports: boolean;
  note: string | null;
  sort_order: number;
  is_active: boolean;
};

type SettlementItemForm = {
  name: string;
  item_type: SettlementItemType;
  calculation_type: SettlementCalculationType;
  amount: number;
  rate: number;
  calculation_base: SettlementCalculationBase;
  include_in_bc_receivable: boolean;
  show_in_reports: boolean;
  note: string;
};

type FormSection = "profile" | "settlement";

type ContractVersion = {
  effective_date: string;
  monthly_rent: number;
  commission_threshold: number;
  commission_rate: number;
  marketing_rate: number;
  changed_at: string;
  changed_by: string;
};

type ContractSettings = {
  effective_date: string;
  monthly_rent: number;
  deposit_amount: number;
  deposit_received_date: string;
  deposit_refunded_date: string;
  deposit_status: "unpaid" | "received" | "refunded";
  note: string;
  versions: ContractVersion[];
  updated_at: string;
  updated_by: string;
};

const defaultContractSettings: ContractSettings = {
  effective_date: new Date().toISOString().split("T")[0],
  monthly_rent: 12000,
  deposit_amount: 0,
  deposit_received_date: "",
  deposit_refunded_date: "",
  deposit_status: "unpaid",
  note: "",
  versions: [],
  updated_at: "",
  updated_by: "",
};

const contractSettingKey = (designerId: number) => `designer_contract_${designerId}`;

const defaultWorkHours = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
const defaultSettlementItemForm: SettlementItemForm = {
  name: "",
  item_type: "deduction",
  calculation_type: "fixed",
  amount: 0,
  rate: 0,
  calculation_base: "service_revenue",
  include_in_bc_receivable: true,
  show_in_reports: true,
  note: "",
};

export function AdminDesignersContent() {
  const router = useRouter();
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [authByDesignerId, setAuthByDesignerId] = useState<Record<number, DesignerAuth>>({});
  const [settlementItems, setSettlementItems] = useState<SettlementItem[]>([]);
  const [contractByDesignerId, setContractByDesignerId] = useState<Record<number, ContractSettings>>({});
  const [contractForm, setContractForm] = useState<ContractSettings>(defaultContractSettings);
  const [loading, setLoading] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Designer | null>(null);
  const [sortDesignerIndex, setSortDesignerIndex] = useState<number | null>(null);
  const [formSection, setFormSection] = useState<FormSection>("profile");
  const [showSettlementForm, setShowSettlementForm] = useState(false);
  const [showOtherSettlementItems, setShowOtherSettlementItems] = useState(false);
  const [editingSettlementItemId, setEditingSettlementItemId] = useState<number | null>(null);
  const [settlementForm, setSettlementForm] = useState<SettlementItemForm>(defaultSettlementItemForm);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  const [canViewContracts, setCanViewContracts] = useState(true);
  const [form, setForm] = useState({
    name: "", display_name: "", nickname: "", initials: "", style: "", ig: "", avatar_url: "",
    bg_color: "#EEEDFE", text_color: "#3C3489",
    commission_rate: 0.5,
    commission_base_deduction: 50000,
    commission_threshold: 0,
    commission_rate_after: 0.5,
    brand_fee_rate: 0.03,
    product_commission_rate: 0,
    joined_date: "", left_date: "",
    can_view_members: true, is_manager: false, status: "active",
    login_username: "", login_password: "",
    work_hours: defaultWorkHours,
  });

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const session = sessionStorage.getItem("adminSession");
    if (!session) { router.push("/admin/login"); return; }
    queueMicrotask(() => {
      const currentSession = readAdminSession();
      const role = currentSession?.role || "owner";
      setCanViewContracts(hasPermission("designer_contracts", permissionsForRole(role, currentSession).permissions));
    });
    fetchData();
  }, [router]);

  async function fetchData() {
    const [{ data }, { data: authData }, { data: settlementData }, { data: contractData }] = await Promise.all([
      supabase.from("designers").select("*").order("sort_order", { nullsFirst: false }).order("id"),
      supabase.from("designer_auth").select("designer_id, username, password_hash"),
      supabase.from("designer_settlement_items").select("*").order("sort_order").order("id"),
      supabase.from("shop_info").select("key, value").like("key", "designer_contract_%"),
    ]);
    if (data) setDesigners(data);
    if (authData) {
      setAuthByDesignerId(Object.fromEntries((authData as DesignerAuth[]).map((auth) => [auth.designer_id, auth])));
    }
    if (settlementData) setSettlementItems(settlementData as SettlementItem[]);
    if (contractData) {
      const contracts = Object.fromEntries(contractData.map((item) => {
        const designerId = Number(item.key.replace("designer_contract_", ""));
        try {
          return [designerId, { ...defaultContractSettings, ...JSON.parse(item.value || "{}") }];
        } catch {
          return [designerId, { ...defaultContractSettings }];
        }
      }));
      setContractByDesignerId(contracts);
    }
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setSaveNotice("");
    setFormSection("profile");
    setForm({
      name: "", display_name: "", nickname: "", initials: "", style: "", ig: "", avatar_url: "",
      bg_color: "#EEEDFE", text_color: "#3C3489",
      commission_rate: 0.5,
      commission_base_deduction: 50000,
      commission_threshold: 0,
      commission_rate_after: 0.5,
      brand_fee_rate: 0.03,
      product_commission_rate: 0,
      joined_date: new Date().toISOString().split("T")[0], left_date: "",
      can_view_members: true, is_manager: false, status: "active",
      login_username: "", login_password: "",
      work_hours: defaultWorkHours,
    });
    setShowSettlementForm(false);
    setShowOtherSettlementItems(false);
    setEditingSettlementItemId(null);
    setSettlementForm({ ...defaultSettlementItemForm });
    setContractForm({ ...defaultContractSettings });
    setShowForm(true);
  }

  function openEdit(d: Designer, section: FormSection = "profile") {
    const auth = authByDesignerId[d.id];
    setEditing(d);
    setSaveNotice("");
    setFormSection(section);
    setForm({
      name: d.name,
      display_name: d.display_name || "",
      nickname: d.nickname || "",
      initials: d.initials || "",
      style: d.style || "",
      ig: d.ig || "",
      avatar_url: d.avatar_url || "",
      bg_color: d.bg_color || "#EEEDFE",
      text_color: d.text_color || "#3C3489",
      commission_rate: d.commission_rate ?? 0.5,
      commission_base_deduction: d.commission_base_deduction ?? 0,
      commission_threshold: d.commission_threshold ?? 0,
      commission_rate_after: d.commission_rate_after ?? 0.5,
      brand_fee_rate: d.brand_fee_rate ?? 0,
      product_commission_rate: d.product_commission_rate ?? 0,
      joined_date: d.joined_date || "",
      left_date: d.left_date || "",
      can_view_members: d.can_view_members ?? true,
      is_manager: d.is_manager ?? false,
      status: d.status || "active",
      login_username: auth?.username || d.name.toLowerCase(),
      login_password: auth?.password_hash || "",
      work_hours: d.work_hours || defaultWorkHours,
    });
    setShowSettlementForm(false);
    setShowOtherSettlementItems(false);
    setEditingSettlementItemId(null);
    setSettlementForm({ ...defaultSettlementItemForm });
    setContractForm({ ...(contractByDesignerId[d.id] || defaultContractSettings) });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name) { alert("請填寫設計師姓名"); return; }
    if (!form.login_username) { alert("請填寫登入帳號"); return; }
    if (!editing && !form.login_password) { alert("新增設計師時請設定登入密碼"); return; }
    if (!contractForm.effective_date) { alert("請設定合約生效日期"); return; }
    if (form.commission_base_deduction < 0 || form.commission_rate < 0 || form.commission_rate > 1 || form.brand_fee_rate < 0 || form.brand_fee_rate > 1 || contractForm.monthly_rent < 0 || contractForm.deposit_amount < 0) {
      alert("金額不得為負數，抽成比例須介於 0% 至 100%");
      return;
    }
    if (form.status === "inactive" && contractForm.deposit_status === "received") {
      alert("押金仍為「已收取」。請先登記退還日期並將押金狀態改為「已退還」，再辦理退租停用。");
      return;
    }
    if (form.status === "inactive" && editing && !window.confirm("設為退租後，將立即關閉此設計師的登入與預約使用權限。確定繼續嗎？")) return;
    setSaving(true);
    setSaveNotice("");
    try {
      let auditUsername = "admin";
      try {
        auditUsername = JSON.parse(sessionStorage.getItem("adminSession") || "{}").username || "admin";
      } catch {
        // Older sessions may not be JSON; keep the fallback audit name.
      }
      const isActive = form.status === "active";
      const nextSortOrder = designers.reduce((max, designer) => Math.max(max, designer.sort_order || 0), 0) + 1;
      const { login_username, login_password, ...designerForm } = form;
      const saveData = { ...designerForm, is_active: isActive, joined_date: form.joined_date || null, left_date: form.left_date || null, sort_order: editing?.sort_order || nextSortOrder };
      let savedDesignerId = editing?.id || 0;

      if (editing) {
        const { error: designerError } = await supabase.from("designers").update(saveData).eq("id", editing.id);
        if (designerError) throw designerError;
        const authPayload = {
          designer_id: editing.id,
          username: login_username,
          password_hash: login_password || authByDesignerId[editing.id]?.password_hash || "",
        };
        const { error: authUpdateError } = await supabase.from("designer_auth").update(authPayload).eq("designer_id", editing.id);
        if (authUpdateError) throw authUpdateError;
        setAuthByDesignerId({ ...authByDesignerId, [editing.id]: authPayload });
        setDesigners(designers.map(d => d.id === editing.id ? { ...d, ...designerForm, is_active: isActive } : d));
      } else {
        const { data, error: designerError } = await supabase.from("designers").insert(saveData).select().single();
        if (designerError || !data) throw designerError || new Error("設計師資料新增失敗");
        savedDesignerId = data.id;
        setDesigners([...designers, data].sort((a, b) => (a.sort_order || a.id) - (b.sort_order || b.id)));
        const authPayload = { designer_id: data.id, username: login_username, password_hash: login_password };
        const { error: authError } = await supabase.from("designer_auth").insert(authPayload);
        if (authError) throw authError;
        setAuthByDesignerId({ ...authByDesignerId, [data.id]: authPayload });
      }

      const previousContract = contractByDesignerId[savedDesignerId];
      const financialChanged = Boolean(previousContract) && (
        previousContract.monthly_rent !== contractForm.monthly_rent
        || editing?.commission_base_deduction !== form.commission_base_deduction
        || editing?.commission_rate !== form.commission_rate
        || editing?.brand_fee_rate !== form.brand_fee_rate
        || previousContract.effective_date !== contractForm.effective_date
      );
      const previousVersion: ContractVersion | null = previousContract && financialChanged ? {
        effective_date: previousContract.effective_date,
        monthly_rent: previousContract.monthly_rent,
        commission_threshold: editing?.commission_base_deduction || 0,
        commission_rate: editing?.commission_rate || 0,
        marketing_rate: editing?.brand_fee_rate || 0,
        changed_at: previousContract.updated_at || new Date().toISOString(),
        changed_by: previousContract.updated_by || auditUsername,
      } : null;
      const nextContract: ContractSettings = {
        ...contractForm,
        versions: previousVersion ? [...(contractForm.versions || []), previousVersion] : (contractForm.versions || []),
        updated_at: new Date().toISOString(),
        updated_by: auditUsername,
      };
      const key = contractSettingKey(savedDesignerId);
      const value = JSON.stringify(nextContract);
      const { data: existingContract, error: lookupError } = await supabase.from("shop_info").select("id").eq("key", key).maybeSingle();
      if (lookupError) throw lookupError;
      const contractResult = existingContract
        ? await supabase.from("shop_info").update({ value, label: `${form.display_name || form.name} 合約與月結設定`, is_active: true }).eq("id", existingContract.id)
        : await supabase.from("shop_info").insert({ key, value, label: `${form.display_name || form.name} 合約與月結設定`, is_active: true, sort_order: 90 });
      if (contractResult.error) throw contractResult.error;
      setContractByDesignerId({ ...contractByDesignerId, [savedDesignerId]: nextContract });
      setContractForm(nextContract);
      setSaveNotice("設定已成功儲存");
      setTimeout(() => setShowForm(false), 700);
    } catch (error) {
      console.error("Designer save failed", error);
      setSaveNotice("儲存失敗，資料尚未完整更新，請再試一次");
    } finally {
      setSaving(false);
    }
  }

  function openSettlementItemForm(item?: SettlementItem) {
    if (!editing) {
      alert("請先儲存設計師資料，再新增其他結算項目");
      return;
    }
    if (item) {
      setEditingSettlementItemId(item.id);
      setSettlementForm({
        name: item.name,
        item_type: item.item_type,
        calculation_type: item.calculation_type,
        amount: item.amount || 0,
        rate: Number(item.rate || 0),
        calculation_base: item.calculation_base,
        include_in_bc_receivable: item.include_in_bc_receivable,
        show_in_reports: item.show_in_reports,
        note: item.note || "",
      });
    } else {
      setEditingSettlementItemId(null);
      setSettlementForm({ ...defaultSettlementItemForm });
    }
    setShowSettlementForm(true);
  }

  async function saveSettlementItem() {
    if (!editing) {
      alert("請先儲存設計師資料，再新增其他結算項目");
      return;
    }
    if (!settlementForm.name.trim()) {
      alert("請填寫項目名稱");
      return;
    }

    const designerItems = settlementItems.filter((item) => item.designer_id === editing.id);
    const payload = {
      ...settlementForm,
      designer_id: editing.id,
      amount: Number(settlementForm.amount || 0),
      rate: Number(settlementForm.rate || 0),
      sort_order: editingSettlementItemId ? designerItems.find((item) => item.id === editingSettlementItemId)?.sort_order || 0 : designerItems.length + 1,
      is_active: true,
    };

    if (editingSettlementItemId) {
      const { data, error } = await supabase
        .from("designer_settlement_items")
        .update(payload)
        .eq("id", editingSettlementItemId)
        .select()
        .single();
      if (error) {
        alert("結算項目更新失敗，請再試一次");
        return;
      }
      setSettlementItems(settlementItems.map((item) => (item.id === editingSettlementItemId ? data as SettlementItem : item)));
    } else {
      const { data, error } = await supabase
        .from("designer_settlement_items")
        .insert(payload)
        .select()
        .single();
      if (error) {
        alert("結算項目新增失敗，請再試一次");
        return;
      }
      setSettlementItems([...settlementItems, data as SettlementItem]);
    }

    setShowSettlementForm(false);
    setEditingSettlementItemId(null);
    setSettlementForm({ ...defaultSettlementItemForm });
  }

  async function deleteSettlementItem(itemId: number) {
    const ok = window.confirm("確定要刪除此結算項目嗎？");
    if (!ok) return;
    const { error } = await supabase.from("designer_settlement_items").delete().eq("id", itemId);
    if (error) {
      alert("刪除失敗，請再試一次");
      return;
    }
    setSettlementItems(settlementItems.filter((item) => item.id !== itemId));
  }

  function formatSettlementItemValue(item: SettlementItem) {
    const sign = item.item_type === "addition" ? "+" : "-";
    if (item.calculation_type === "percent") return `${sign}${Math.round(Number(item.rate || 0) * 100)}%`;
    return `${sign}NT$${Number(item.amount || 0).toLocaleString()}`;
  }

  async function moveDesigner(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= designers.length) return;

    const current = designers[index];
    const target = designers[targetIndex];
    const currentOrder = current.sort_order ?? index + 1;
    const targetOrder = target.sort_order ?? targetIndex + 1;
    const nextDesigners = [...designers];
    nextDesigners[index] = { ...target, sort_order: currentOrder };
    nextDesigners[targetIndex] = { ...current, sort_order: targetOrder };
    setDesigners(nextDesigners);

    const [{ error: currentError }, { error: targetError }] = await Promise.all([
      supabase.from("designers").update({ sort_order: targetOrder }).eq("id", current.id),
      supabase.from("designers").update({ sort_order: currentOrder }).eq("id", target.id),
    ]);

    if (currentError || targetError) {
      alert("排序更新失敗，請再試一次");
      fetchData();
    }
  }

  async function handleMoveDesigner(index: number, direction: -1 | 1) {
    await moveDesigner(index, direction);
    setSortDesignerIndex(null);
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#534AB7", fontSize: 14 }}>載入中...</div>
    </div>
  );

  const currentSettlementItems = editing
    ? settlementItems
        .filter((item) => item.designer_id === editing.id)
        .sort((a, b) => (a.sort_order || a.id) - (b.sort_order || b.id))
    : [];

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", paddingBottom: 70, paddingLeft: isDesktop ? 220 : 0 }}>
      <div className="admin-topbar" style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => router.push("/admin/dashboard")} style={{ background: "#2C2C2A", color: "#fff", border: "1px solid #5F5E5A", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>← 返回</button>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>設計師管理</div>
        </div>
        <div style={{ display: "flex", gap: 8, paddingRight: isDesktop ? 92 : 76 }}>
          <button onClick={() => router.push("/admin/prices")} style={{ background: "#2C2C2A", color: "#fff", border: "1px solid #5F5E5A", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>公版價目表</button>
          <button onClick={openNew} style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>＋ 新增設計師</button>
        </div>
      </div>

      <div style={{ padding: isDesktop ? 22 : 14, display: "grid", gridTemplateColumns: isDesktop ? "repeat(auto-fill, minmax(190px, 1fr))" : "repeat(2, minmax(0, 1fr))", gap: isDesktop ? 14 : 10 }}>
        {designers.map((d) => (
          <button key={d.id} onClick={() => openEdit(d)} style={{ minHeight: isDesktop ? 230 : 190, background: "#fff", borderRadius: 18, padding: isDesktop ? 22 : 16, border: "1px solid #DDD9D0", opacity: d.status === "active" ? 1 : 0.65, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 13, boxShadow: "0 8px 24px rgba(44,44,42,.04)" }}>
            <div style={{ width: isDesktop ? 108 : 82, height: isDesktop ? 108 : 82, borderRadius: "50%", background: d.bg_color, color: d.text_color, display: "grid", placeItems: "center", fontSize: isDesktop ? 32 : 25, fontWeight: 800, overflow: "hidden" }}>
              {d.avatar_url ? <img src={d.avatar_url} alt={`${d.name} 頭像`} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : d.initials}
            </div>
            <div style={{ fontSize: isDesktop ? 18 : 15, fontWeight: 900, color: "#2C2C2A", textAlign: "center" }}>{d.name}</div>
            <div style={{ color: "#534AB7", fontSize: 12, fontWeight: 800 }}>查看設定 →</div>
          </button>
        ))}
      </div>

      {sortDesignerIndex !== null && designers[sortDesignerIndex] && (
        <div onClick={() => setSortDesignerIndex(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 320, background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 18px 40px rgba(0,0,0,0.18)" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#2C2C2A", marginBottom: 4 }}>調整排序</div>
            <div style={{ fontSize: 12, color: "#888780", marginBottom: 14 }}>{designers[sortDesignerIndex].name}</div>
            <button onClick={() => handleMoveDesigner(sortDesignerIndex, -1)} disabled={sortDesignerIndex === 0} style={{ width: "100%", padding: "12px 0", marginBottom: 8, background: sortDesignerIndex === 0 ? "#F1EFE8" : "#fff", color: sortDesignerIndex === 0 ? "#C0BDB5" : "#2C2C2A", border: "1px solid #D3D1C7", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: sortDesignerIndex === 0 ? "default" : "pointer" }}>上移一格</button>
            <button onClick={() => handleMoveDesigner(sortDesignerIndex, 1)} disabled={sortDesignerIndex === designers.length - 1} style={{ width: "100%", padding: "12px 0", marginBottom: 8, background: sortDesignerIndex === designers.length - 1 ? "#F1EFE8" : "#fff", color: sortDesignerIndex === designers.length - 1 ? "#C0BDB5" : "#2C2C2A", border: "1px solid #D3D1C7", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: sortDesignerIndex === designers.length - 1 ? "default" : "pointer" }}>下移一格</button>
            <button onClick={() => setSortDesignerIndex(null)} style={{ width: "100%", padding: "11px 0", background: "#F1EFE8", color: "#5F5E5A", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>取消</button>
          </div>
        </div>
      )}

      {/* 表單跳窗 */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: isDesktop ? "center" : "flex-end", justifyContent: "center", padding: isDesktop ? 24 : 0 }}>
          <div style={{ width: "100%", maxWidth: isDesktop ? 1040 : 480, background: "#fff", borderRadius: isDesktop ? 22 : "20px 20px 0 0", padding: isDesktop ? 24 : "20px 16px 32px", maxHeight: isDesktop ? "86vh" : "90vh", overflowY: "auto", boxShadow: isDesktop ? "0 24px 70px rgba(0,0,0,0.25)" : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: isDesktop ? 24 : 15, fontWeight: 900, color: "#2C2C2A" }}>{editing ? "編輯設計師" : "新增設計師"}</div>
                <div style={{ fontSize: 12, color: "#888780", marginTop: 4 }}>依設定分類編輯，儲存後同步後台、設計師端與顧客端公開資訊</div>
              </div>
              <button onClick={() => setShowForm(false)} style={{ background: "#F1EFE8", border: "none", borderRadius: isDesktop ? 14 : 8, width: isDesktop ? 44 : 32, height: isDesktop ? 44 : 32, fontSize: isDesktop ? 24 : 16, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(3, minmax(0, 1fr))" : "1fr", gap: 10, marginBottom: 18, background: isDesktop ? "#F8F7F3" : "transparent", padding: isDesktop ? 8 : 0, borderRadius: 18 }}>
              {[
                { key: "profile", label: "個人基本設定" },
                ...(canViewContracts ? [{ key: "settlement", label: "合約與月結設定" }] : []),
                { key: "prices", label: "專屬價目表" },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    if (item.key === "prices") {
                      if (!editing) {
                        alert("請先儲存設計師資料，再設定專屬價目表");
                        return;
                      }
                      router.push(`/admin/designer-prices?designerId=${editing.id}`);
                      return;
                    }
                    setFormSection(item.key as FormSection);
                  }}
                  style={{ padding: isDesktop ? "14px 10px" : "10px 8px", borderRadius: 14, border: "none", background: formSection === item.key ? "#534AB7" : "#EFEBE4", color: formSection === item.key ? "#fff" : "#5F5E5A", fontSize: isDesktop ? 14 : 12, fontWeight: 900, cursor: "pointer" }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {formSection === "profile" && (
              <>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#888780", marginBottom: 10 }}>基本資料</div>
            <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(2, minmax(0, 1fr))" : "1fr", columnGap: 14 }}>
            {([
              { key: "name", label: "英文名 *", placeholder: "Cherry" },
              { key: "display_name", label: "中文名", placeholder: "林亮瑩" },
              { key: "nickname", label: "暱稱", placeholder: "扁頭救星" },
              { key: "initials", label: "縮寫", placeholder: "C" },
              { key: "style", label: "專長", placeholder: "日系、剪髮、染髮" },
              { key: "ig", label: "Instagram", placeholder: "bingcherry_cherry" },
            ] as const).map(f => (
              <div key={f.key} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>{f.label}</div>
                <input
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
              </div>
            ))}
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>頭像圖片網址</div>
              <input
                value={form.avatar_url}
                onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                placeholder="貼上圖片網址，會同步設計師端頭像"
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
              <div style={{ fontSize: 11, color: "#888780", marginTop: 4 }}>此區資料會同步到設計師端個人資料與顧客端設計師資訊。</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>背景色</div>
                <input type="color" value={form.bg_color} onChange={(e) => setForm({ ...form, bg_color: e.target.value })} style={{ width: "100%", height: 38, borderRadius: 8, border: "1px solid #D3D1C7", cursor: "pointer" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>文字色</div>
                <input type="color" value={form.text_color} onChange={(e) => setForm({ ...form, text_color: e.target.value })} style={{ width: "100%", height: 38, borderRadius: 8, border: "1px solid #D3D1C7", cursor: "pointer" }} />
              </div>
            </div>

            <div style={{ height: 1, background: "#EEEAE2", margin: isDesktop ? "22px 0 18px" : "18px 0 14px" }} />

            <div style={{ fontSize: 13, fontWeight: 800, color: "#888780", marginBottom: 10 }}>登入帳號密碼</div>
            <div style={{ background: "#F8F7F3", border: "1px solid #E5E1D7", borderRadius: 16, padding: isDesktop ? 18 : 12, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#888780", marginBottom: 10, lineHeight: 1.6 }}>
                此帳號密碼會同步到設計師端登入使用，由後台統一管理。
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr", gap: isDesktop ? 14 : 0 }}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>登入帳號 *</div>
                <input
                  value={form.login_username}
                  onChange={(e) => setForm({ ...form, login_username: e.target.value })}
                  placeholder="例如 cherry"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>登入密碼 {editing ? "" : "*"}</div>
                <input
                  value={form.login_password}
                  onChange={(e) => setForm({ ...form, login_password: e.target.value })}
                  type="text"
                  placeholder={editing ? "輸入新密碼即可變更" : "請設定登入密碼"}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              </div>
            </div>

            <div style={{ height: 1, background: "#EEEAE2", margin: isDesktop ? "22px 0 18px" : "18px 0 14px" }} />

            <div style={{ fontSize: 13, fontWeight: 800, color: "#888780", marginBottom: 10 }}>職務與權限</div>
            <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>加入日期</div>
                <input type="date" value={form.joined_date} onChange={(e) => setForm({ ...form, joined_date: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>離職日期</div>
                <input type="date" value={form.left_date} onChange={(e) => setForm({ ...form, left_date: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, color: "#888780", marginBottom: 8, marginTop: 4 }}>權限設定</div>
            <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: isDesktop ? 16 : "10px 12px", background: "#F1EFE8", borderRadius: 16, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 13, color: "#2C2C2A" }}>可查看會員資料</div>
                <div style={{ fontSize: 11, color: "#888780" }}>關閉後設計師無法查看客人聯絡資料</div>
              </div>
              <div onClick={() => setForm({ ...form, can_view_members: !form.can_view_members })} style={{ width: 44, height: 24, borderRadius: 12, background: form.can_view_members ? "#534AB7" : "#D3D1C7", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: form.can_view_members ? 22 : 2, transition: "left 0.2s" }} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: isDesktop ? 16 : "10px 12px", background: "#F1EFE8", borderRadius: 16, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 13, color: "#2C2C2A" }}>店長權限</div>
                <div style={{ fontSize: 11, color: "#888780" }}>可查看全店預約，並協助新增、確認或取消預約</div>
              </div>
              <div onClick={() => setForm({ ...form, is_manager: !form.is_manager })} style={{ width: 44, height: 24, borderRadius: 12, background: form.is_manager ? "#534AB7" : "#D3D1C7", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: form.is_manager ? 22 : 2, transition: "left 0.2s" }} />
              </div>
            </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>狀態</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[{ val: "active", label: "在職" }, { val: "inactive", label: "退租並停用" }].map(s => (
                  <button key={s.val} onClick={() => setForm({ ...form, status: s.val })} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: form.status === s.val ? (s.val === "active" ? "#E1F5EE" : "#FCEBEB") : "#F1EFE8", color: form.status === s.val ? (s.val === "active" ? "#085041" : "#A32D2D") : "#888780", fontWeight: form.status === s.val ? 600 : 400, fontSize: 13, cursor: "pointer" }}>
                    {s.label}
                  </button>
                ))}
              </div>
              {form.status === "inactive" && <div style={{ marginTop: 8, padding: "9px 12px", borderRadius: 10, background: "#FCEBEB", color: "#A32D2D", fontSize: 11, lineHeight: 1.5 }}>儲存後將關閉此設計師的登入及顧客端預約權限，過去紀錄仍會保留。</div>}
            </div>
              </>
            )}

            {formSection === "settlement" && (
              <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, marginTop: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#2C2C2A" }}>合約與月結設定</div>
              <span style={{ padding: "5px 10px", borderRadius: 999, background: form.status === "active" ? "#E1F5EE" : "#FCEBEB", color: form.status === "active" ? "#08785E" : "#A32D2D", fontSize: 11, fontWeight: 800 }}>{form.status === "active" ? "● 合約生效中" : "已退租停用"}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "320px minmax(0, 1fr)" : "1fr", gap: 14, alignItems: "start" }}>
              <div style={{ background: "#FBFAF7", border: "1px solid #E5E1D7", borderRadius: 18, padding: isDesktop ? 18 : 14, position: isDesktop ? "sticky" : "static", top: 0 }}>
                <div style={{ fontSize: 15, color: "#2C2C2A", fontWeight: 900, marginBottom: 12 }}>本月合約摘要</div>
                {[
                  { label: "合約生效", value: contractForm.effective_date ? contractForm.effective_date.replace(/-/g, "/") : "未設定" },
                  { label: "每月租金", value: `NT$${contractForm.monthly_rent.toLocaleString()}` },
                  { label: "營業抽成", value: `超過 NT$${form.commission_base_deduction.toLocaleString()} 後 ${Math.round(form.commission_rate * 100)}%` },
                  { label: "行銷抽成", value: `${Math.round(form.brand_fee_rate * 100)}%` },
                  { label: "合約押金", value: contractForm.deposit_amount ? `NT$${contractForm.deposit_amount.toLocaleString()}・${contractForm.deposit_status === "received" ? "已收取" : contractForm.deposit_status === "refunded" ? "已退還" : "未收取"}` : "未設定" },
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", background: "#fff", borderRadius: 12, padding: "11px 12px", marginBottom: 8 }}>
                    <span style={{ color: "#888780", fontSize: 11, fontWeight: 700 }}>{item.label}</span>
                    <span style={{ color: "#2C2C2A", fontSize: 12, fontWeight: 900, textAlign: "right" }}>{item.value}</span>
                  </div>
                ))}
                <div style={{ marginTop: 14, background: "#EEEDFE", borderRadius: 14, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <span style={{ color: "#534AB7", fontSize: 12, fontWeight: 900 }}>本月應收試算</span>
                    <span style={{ color: "#534AB7", fontSize: 20, fontWeight: 900 }}>NT${(contractForm.monthly_rent + Math.max(0, 100000 - form.commission_base_deduction) * form.commission_rate + 100000 * form.brand_fee_rate).toLocaleString()}</span>
                  </div>
                  <div style={{ color: "#7B6FD4", fontSize: 10, lineHeight: 1.7, marginTop: 8 }}>
                    以服務實收 NT$100,000 試算<br/>
                    月租 NT${contractForm.monthly_rent.toLocaleString()}＋營業抽成 NT${(Math.max(0, 100000 - form.commission_base_deduction) * form.commission_rate).toLocaleString()}＋行銷抽成 NT${(100000 * form.brand_fee_rate).toLocaleString()}
                  </div>
                </div>
                {contractForm.versions.length > 0 && (
                  <details style={{ marginTop: 12, borderTop: "1px solid #E5E1D7", paddingTop: 10 }}>
                    <summary style={{ color: "#5F5E5A", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>查看異動紀錄（{contractForm.versions.length}）</summary>
                    <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                      {[...contractForm.versions].reverse().map((version, index) => (
                        <div key={`${version.changed_at}-${index}`} style={{ background: "#fff", borderRadius: 10, padding: "8px 10px", fontSize: 10, color: "#888780", lineHeight: 1.6 }}>
                          <div style={{ color: "#2C2C2A", fontWeight: 800 }}>生效 {version.effective_date?.replace(/-/g, "/") || "未記錄"}</div>
                          月租 NT${Number(version.monthly_rent || 0).toLocaleString()}｜門檻 NT${Number(version.commission_threshold || 0).toLocaleString()}｜營業 {Math.round(Number(version.commission_rate || 0) * 100)}%｜行銷 {Math.round(Number(version.marketing_rate || 0) * 100)}%
                          <div>{version.changed_by || "管理者"}・{version.changed_at ? new Date(version.changed_at).toLocaleString("zh-TW") : ""}</div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            <div style={{ background: "#F1EFE8", borderRadius: 16, padding: isDesktop ? 18 : 12, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexDirection: isDesktop ? "row" : "column", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, color: "#2C2C2A", fontWeight: 700, marginBottom: 4 }}>每月租金</div>
                  <div style={{ fontSize: 11, color: "#888780", lineHeight: 1.6 }}>選擇常用租金，或直接輸入個別合約金額。</div>
                </div>
                <div style={{ width: isDesktop ? 190 : "100%" }}>
                  <div style={{ fontSize: 11, color: "#888780", marginBottom: 4 }}>合約生效日期 *</div>
                  <input type="date" value={contractForm.effective_date} onChange={(e) => setContractForm({ ...contractForm, effective_date: e.target.value })} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 12, outline: "none", boxSizing: "border-box", background: "#fff" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {[12000, 15000].map((amount) => (
                  <button key={amount} type="button" onClick={() => setContractForm({ ...contractForm, monthly_rent: amount })} style={{ flex: 1, padding: "9px 8px", borderRadius: 9, border: contractForm.monthly_rent === amount ? "2px solid #534AB7" : "1px solid #D3D1C7", background: contractForm.monthly_rent === amount ? "#EEEDFE" : "#fff", color: contractForm.monthly_rent === amount ? "#534AB7" : "#5F5E5A", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>NT${amount.toLocaleString()}</button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>租金金額（元）</div>
              <input value={contractForm.monthly_rent || ""} onChange={(e) => setContractForm({ ...contractForm, monthly_rent: parseInt(e.target.value) || 0 })} type="number" min="0" placeholder="輸入自訂金額" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>

            <div style={{ background: "#F1EFE8", borderRadius: 16, padding: isDesktop ? 18 : 12, marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: "#2C2C2A", fontWeight: 700, marginBottom: 6 }}>營業抽成</div>
              <div style={{ fontSize: 11, color: "#888780", marginBottom: 10, lineHeight: 1.6 }}>
                依服務實收業績計算：超過免抽門檻的部分 × 抽成比例。
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>免抽門檻（元）</div>
                <input value={form.commission_base_deduction || ""} onChange={(e) => setForm({ ...form, commission_base_deduction: parseInt(e.target.value) || 0 })} type="number" placeholder="0" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>超過門檻抽成比例</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input value={Math.round(form.commission_rate * 100) || ""} onChange={(e) => setForm({ ...form, commission_rate: (parseInt(e.target.value) || 0) / 100 })} type="number" min="0" max="100" placeholder="0" style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#534AB7" }}>%</span>
                </div>
              </div>
              <div style={{ background: "#EEEDFE", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#534AB7" }}>
                預覽：服務實收 NT$100,000 → 抽成 NT${(Math.max(0, 100000 - form.commission_base_deduction) * form.commission_rate).toLocaleString()}
              </div>
            </div>

            <div style={{ background: "#F1EFE8", borderRadius: 16, padding: isDesktop ? 18 : 12, marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: "#2C2C2A", fontWeight: 700, marginBottom: 6 }}>行銷抽成</div>
              <div style={{ fontSize: 11, color: "#888780", marginBottom: 8, lineHeight: 1.6 }}>
                計算方式：服務實收業績 × 行銷抽成比例。
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {[0.03, 0.05].map((rate) => (
                  <button key={rate} type="button" onClick={() => setForm({ ...form, brand_fee_rate: rate })} style={{ flex: 1, padding: "9px 8px", borderRadius: 9, border: form.brand_fee_rate === rate ? "2px solid #534AB7" : "1px solid #D3D1C7", background: form.brand_fee_rate === rate ? "#EEEDFE" : "#fff", color: form.brand_fee_rate === rate ? "#534AB7" : "#5F5E5A", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>{Math.round(rate * 100)}%</button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input value={Math.round((form.brand_fee_rate || 0) * 100) || ""} onChange={(e) => setForm({ ...form, brand_fee_rate: (parseInt(e.target.value) || 0) / 100 })} type="number" min="0" max="100" placeholder="0" style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: "#534AB7" }}>%</span>
              </div>
            </div>

            <div style={{ background: "#F1EFE8", borderRadius: 16, padding: isDesktop ? 18 : 12, marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: "#2C2C2A", fontWeight: 700, marginBottom: 6 }}>合約押金</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>押金金額（元）</div>
                  <input value={contractForm.deposit_amount || ""} onChange={(e) => setContractForm({ ...contractForm, deposit_amount: parseInt(e.target.value) || 0 })} type="number" min="0" placeholder="0" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>押金狀態</div>
                  <select value={contractForm.deposit_status} onChange={(e) => setContractForm({ ...contractForm, deposit_status: e.target.value as ContractSettings["deposit_status"] })} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box", background: "#fff" }}>
                    <option value="unpaid">未收取</option>
                    <option value="received">已收取</option>
                    <option value="refunded">已退還</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>收取日期</div>
                  <input type="date" value={contractForm.deposit_received_date} onChange={(e) => setContractForm({ ...contractForm, deposit_received_date: e.target.value, deposit_status: e.target.value ? "received" : contractForm.deposit_status })} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>退還日期</div>
                  <input type="date" value={contractForm.deposit_refunded_date} onChange={(e) => setContractForm({ ...contractForm, deposit_refunded_date: e.target.value, deposit_status: e.target.value ? "refunded" : contractForm.deposit_status })} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>備註</div>
                  <textarea value={contractForm.note} onChange={(e) => setContractForm({ ...contractForm, note: e.target.value })} placeholder="例如：押金於幾月幾日收取，退租時退還。" rows={3} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical" }} />
                </div>
                {editing && form.status === "active" && (
                  <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
                    <button type="button" onClick={() => {
                      if (contractForm.deposit_status === "received") {
                        alert("押金尚未退還，請先填寫退還日期並將狀態改為「已退還」。");
                        return;
                      }
                      setForm({ ...form, status: "inactive", left_date: form.left_date || new Date().toISOString().split("T")[0] });
                    }} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid #D84A4A", background: "#fff", color: "#A32D2D", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>退租並停用帳號</button>
                  </div>
                )}
              </div>
            </div>
            </div>
            </div>

            <div style={{ marginTop: 6, background: "#fff", border: "1px solid #E5E1D7", borderRadius: 18, padding: isDesktop ? 18 : 12 }}>
              <button type="button" onClick={() => setShowOtherSettlementItems(!showOtherSettlementItems)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, border: "none", background: "transparent", padding: 0, cursor: "pointer", textAlign: "left" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, color: "#2C2C2A", fontWeight: 900 }}>其他月結項目</span>
                    <span style={{ background: "#F1EFE8", color: "#888780", borderRadius: 999, padding: "3px 8px", fontSize: 10, fontWeight: 800 }}>{currentSettlementItems.length} 項</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#888780", marginTop: 4, lineHeight: 1.5 }}>可新增清潔費、補貼、特殊扣款或其他分潤，會同步到線上資料庫供報表使用。</div>
                </div>
                <span style={{ color: "#534AB7", fontSize: 18, transform: showOtherSettlementItems ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }}>⌄</span>
              </button>

              {showOtherSettlementItems && (<>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12, marginBottom: 12 }}>
                <button onClick={() => openSettlementItemForm()} style={{ width: isDesktop ? "auto" : "100%", padding: "10px 14px", borderRadius: 12, border: "none", background: "#534AB7", color: "#fff", fontSize: 13, fontWeight: 900, cursor: "pointer" }}>＋ 新增項目</button>
              </div>

              {!editing && (
                <div style={{ background: "#FFF7E8", color: "#BA7517", borderRadius: 12, padding: "10px 12px", fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
                  新增設計師時，請先儲存設計師資料，再回來新增其他結算項目。
                </div>
              )}

              {editing && currentSettlementItems.length === 0 && !showSettlementForm && (
                <div style={{ background: "#F8F7F3", borderRadius: 12, padding: "14px 12px", color: "#888780", fontSize: 12, textAlign: "center", marginBottom: 12 }}>
                  尚未新增其他結算項目
                </div>
              )}

              {currentSettlementItems.length > 0 && (
                <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                  {currentSettlementItems.map((item) => (
                    <div key={item.id} style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr auto auto auto" : "1fr", gap: 8, alignItems: "center", background: "#F8F7F3", border: "1px solid #E5E1D7", borderRadius: 14, padding: "11px 12px" }}>
                      <div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, color: "#2C2C2A", fontWeight: 900 }}>{item.name}</span>
                          <span style={{ padding: "3px 8px", borderRadius: 999, background: item.item_type === "addition" ? "#E1F5EE" : "#FCEBEB", color: item.item_type === "addition" ? "#085041" : "#A32D2D", fontSize: 11, fontWeight: 800 }}>
                            {item.item_type === "addition" ? "加項" : "扣項"}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: "#888780", marginTop: 4, lineHeight: 1.5 }}>
                          {item.calculation_type === "fixed" ? "固定金額" : "百分比計算"}｜{item.include_in_bc_receivable ? "列入 BC 應收" : "不列入 BC 應收"}｜{item.show_in_reports ? "顯示報表" : "不顯示報表"}
                          {item.note ? `｜${item.note}` : ""}
                        </div>
                      </div>
                      <div style={{ color: item.item_type === "addition" ? "#085041" : "#A32D2D", fontSize: 14, fontWeight: 900, whiteSpace: "nowrap" }}>{formatSettlementItemValue(item)}</div>
                      <button onClick={() => openSettlementItemForm(item)} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #D3D1C7", background: "#fff", color: "#534AB7", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>編輯</button>
                      <button onClick={() => deleteSettlementItem(item.id)} style={{ padding: "8px 12px", borderRadius: 10, border: "none", background: "#FCEBEB", color: "#A32D2D", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>刪除</button>
                    </div>
                  ))}
                </div>
              )}

              {showSettlementForm && (
                <div style={{ background: "#EEEDFE", borderRadius: 16, padding: isDesktop ? 16 : 12 }}>
                  <div style={{ fontSize: 13, color: "#534AB7", fontWeight: 900, marginBottom: 12 }}>{editingSettlementItemId ? "編輯結算項目" : "新增結算項目"}</div>
                  <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(2, minmax(0, 1fr))" : "1fr", gap: 10 }}>
                    <div style={{ gridColumn: isDesktop ? "1 / -1" : "auto" }}>
                      <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>項目名稱 *</div>
                      <input value={settlementForm.name} onChange={(e) => setSettlementForm({ ...settlementForm, name: e.target.value })} placeholder="例如 固定租金、清潔費、活動獎金" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>類型</div>
                      <select value={settlementForm.item_type} onChange={(e) => setSettlementForm({ ...settlementForm, item_type: e.target.value as SettlementItemType })} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box", background: "#fff" }}>
                        <option value="deduction">扣項</option>
                        <option value="addition">加項</option>
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>計算方式</div>
                      <select value={settlementForm.calculation_type} onChange={(e) => setSettlementForm({ ...settlementForm, calculation_type: e.target.value as SettlementCalculationType })} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box", background: "#fff" }}>
                        <option value="fixed">固定金額</option>
                        <option value="percent">百分比</option>
                      </select>
                    </div>
                    {settlementForm.calculation_type === "fixed" ? (
                      <div>
                        <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>金額（元）</div>
                        <input value={settlementForm.amount || ""} onChange={(e) => setSettlementForm({ ...settlementForm, amount: parseInt(e.target.value) || 0 })} type="number" min="0" placeholder="0" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                      </div>
                    ) : (
                      <>
                        <div>
                          <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>百分比</div>
                          <input value={Math.round((settlementForm.rate || 0) * 100) || ""} onChange={(e) => setSettlementForm({ ...settlementForm, rate: (parseInt(e.target.value) || 0) / 100 })} type="number" min="0" max="100" placeholder="0" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>計算來源</div>
                          <select value={settlementForm.calculation_base} onChange={(e) => setSettlementForm({ ...settlementForm, calculation_base: e.target.value as SettlementCalculationBase })} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box", background: "#fff" }}>
                            <option value="service_revenue">服務業績</option>
                            <option value="net_income">實收金額</option>
                          </select>
                        </div>
                      </>
                    )}
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "#2C2C2A", fontWeight: 700 }}>
                      <input type="checkbox" checked={settlementForm.include_in_bc_receivable} onChange={(e) => setSettlementForm({ ...settlementForm, include_in_bc_receivable: e.target.checked })} />
                      列入 BC 應收
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "#2C2C2A", fontWeight: 700 }}>
                      <input type="checkbox" checked={settlementForm.show_in_reports} onChange={(e) => setSettlementForm({ ...settlementForm, show_in_reports: e.target.checked })} />
                      顯示於報表
                    </label>
                    <div style={{ gridColumn: isDesktop ? "1 / -1" : "auto" }}>
                      <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>備註</div>
                      <input value={settlementForm.note} onChange={(e) => setSettlementForm({ ...settlementForm, note: e.target.value })} placeholder="例如 每月固定清潔分攤費" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                    <button onClick={() => { setShowSettlementForm(false); setEditingSettlementItemId(null); setSettlementForm({ ...defaultSettlementItemForm }); }} style={{ padding: "9px 16px", borderRadius: 10, border: "1px solid #D3D1C7", background: "#fff", color: "#5F5E5A", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>取消</button>
                    <button onClick={saveSettlementItem} style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "#534AB7", color: "#fff", fontSize: 12, fontWeight: 900, cursor: "pointer" }}>{editingSettlementItemId ? "更新項目" : "新增項目"}</button>
                  </div>
                </div>
              )}
              </>)}
            </div>
              </>
            )}

            {saveNotice && <div style={{ marginTop: 12, marginBottom: 10, marginLeft: isDesktop ? "auto" : 0, width: isDesktop ? 320 : "100%", padding: "10px 12px", borderRadius: 10, background: saveNotice.includes("成功") ? "#E1F5EE" : "#FCEBEB", color: saveNotice.includes("成功") ? "#085041" : "#A32D2D", fontSize: 12, fontWeight: 800, textAlign: "center", boxSizing: "border-box" }}>{saveNotice}</div>}
            <button onClick={handleSave} disabled={saving} style={{ width: isDesktop ? 220 : "100%", display: "block", marginLeft: isDesktop ? "auto" : 0, padding: "12px 0", background: saving ? "#D3D1C7" : "#534AB7", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: saving ? "default" : "pointer" }}>
              {saving ? "儲存中..." : "儲存"}
            </button>
          </div>
        </div>
      )}

      <AdminBottomNav current="designers" />
    </div>
  );
}

export default function AdminDesigners() {
  return <AdminDesignersContent />;
}
