"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminBottomNav from "../components/BottomNav";

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
  status: string;
  joined_date: string;
  left_date: string;
  can_view_members: boolean;
  is_manager: boolean;
  sort_order?: number | null;
};

const defaultWorkHours = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

export default function AdminDesigners() {
  const router = useRouter();
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Designer | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", display_name: "", nickname: "", initials: "", style: "", ig: "",
    bg_color: "#EEEDFE", text_color: "#3C3489",
    commission_rate: 0.5,
    commission_base_deduction: 0,
    commission_threshold: 0,
    commission_rate_after: 0.5,
    brand_fee_rate: 0,
    product_commission_rate: 0,
    joined_date: "", left_date: "",
    can_view_members: true, is_manager: false, status: "active",
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
    fetchData();
  }, [router]);

  async function fetchData() {
    const { data } = await supabase.from("designers").select("*").order("sort_order", { nullsFirst: false }).order("id");
    if (data) setDesigners(data);
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setForm({
      name: "", display_name: "", nickname: "", initials: "", style: "", ig: "",
      bg_color: "#EEEDFE", text_color: "#3C3489",
      commission_rate: 0.5,
      commission_base_deduction: 0,
      commission_threshold: 0,
      commission_rate_after: 0.5,
      brand_fee_rate: 0,
      product_commission_rate: 0,
      joined_date: new Date().toISOString().split("T")[0], left_date: "",
      can_view_members: true, is_manager: false, status: "active",
      work_hours: defaultWorkHours,
    } as any);
    setShowForm(true);
  }

  function openEdit(d: Designer) {
    setEditing(d);
    setForm({
      name: d.name,
      display_name: d.display_name || "",
      nickname: d.nickname || "",
      initials: d.initials || "",
      style: d.style || "",
      ig: d.ig || "",
      bg_color: d.bg_color || "#EEEDFE",
      text_color: d.text_color || "#3C3489",
      commission_rate: d.commission_rate ?? 0.5,
      commission_base_deduction: (d as any).commission_base_deduction ?? 0,
      commission_threshold: (d as any).commission_threshold ?? 0,
      commission_rate_after: (d as any).commission_rate_after ?? 0.5,
      brand_fee_rate: (d as any).brand_fee_rate ?? 0,
      product_commission_rate: (d as any).product_commission_rate ?? 0,
      joined_date: d.joined_date || "",
      left_date: d.left_date || "",
      can_view_members: d.can_view_members ?? true,
      is_manager: d.is_manager ?? false,
      status: d.status || "active",
      work_hours: d.work_hours || defaultWorkHours,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name) { alert("請填寫設計師姓名"); return; }
    setSaving(true);
    const isActive = form.status === "active";
    const nextSortOrder = designers.reduce((max, designer) => Math.max(max, designer.sort_order || 0), 0) + 1;
    const saveData = { ...form, is_active: isActive, joined_date: form.joined_date || null, left_date: form.left_date || null, sort_order: editing?.sort_order || nextSortOrder };
    if (editing) {
      await supabase.from("designers").update(saveData).eq("id", editing.id);
      await supabase.from("designer_auth").update({ username: form.name.toLowerCase() }).eq("designer_id", editing.id);
      setDesigners(designers.map(d => d.id === editing.id ? { ...d, ...form, is_active: isActive } : d));
    } else {
      const { data } = await supabase.from("designers").insert(saveData).select().single();
      if (data) {
        setDesigners([...designers, data].sort((a, b) => (a.sort_order || a.id) - (b.sort_order || b.id)));
        await supabase.from("designer_auth").insert({
          designer_id: data.id,
          username: form.name.toLowerCase(),
          password_hash: "bc2024" + form.name.toLowerCase(),
        });
      }
    }
    setSaving(false);
    setShowForm(false);
  }

  async function toggleStatus(d: Designer) {
    const newStatus = d.status === "active" ? "inactive" : "active";
    const isActive = newStatus === "active";
    const leftDate = newStatus === "inactive" ? new Date().toISOString().split("T")[0] : null;
    await supabase.from("designers").update({ status: newStatus, is_active: isActive, left_date: leftDate }).eq("id", d.id);
    setDesigners(designers.map(x => x.id === d.id ? { ...x, status: newStatus, is_active: isActive, left_date: leftDate || "" } : x));
  }

  async function toggleMemberAccess(d: Designer) {
    const newVal = !d.can_view_members;
    await supabase.from("designers").update({ can_view_members: newVal }).eq("id", d.id);
    setDesigners(designers.map(x => x.id === d.id ? { ...x, can_view_members: newVal } : x));
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

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#534AB7", fontSize: 14 }}>載入中...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", paddingBottom: 70, paddingLeft: isDesktop ? 220 : 0 }}>
      <div style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>設計師管理</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => router.push("/admin/prices")} style={{ background: "#2C2C2A", color: "#fff", border: "1px solid #5F5E5A", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>公版價目表</button>
          <button onClick={openNew} style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>＋ 新增</button>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {designers.map((d, index) => (
          <div key={d.id} style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, border: "0.5px solid #D3D1C7", opacity: d.status === "active" ? 1 : 0.7 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: d.bg_color, color: d.text_color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, flexShrink: 0, overflow: "hidden" }}>
                {d.avatar_url ? <img src={d.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : d.initials}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#2C2C2A" }}>
                      {d.name}
                      {d.display_name && (
                        <span style={{ fontSize: 13, color: "#7B6FD4", marginLeft: 6 }}>（{d.display_name}）</span>
                      )}
                    </div>
                    {d.nickname && <div style={{ fontSize: 11, color: "#7B6FD4" }}>{d.nickname}</div>}
                    <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>{d.style}</div>
                  </div>
                  <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 10, background: d.status === "active" ? "#E1F5EE" : "#FCEBEB", color: d.status === "active" ? "#085041" : "#A32D2D", fontWeight: 500 }}>
                    {d.status === "active" ? "在職" : "離職"}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 8, fontSize: 11, color: "#5F5E5A", flexWrap: "wrap" }}>
                  <span style={{ background: "#EEEDFE", color: "#534AB7", padding: "2px 8px", borderRadius: 6 }}>
                    服務抽成 {Math.round((d.commission_rate || 0) * 100)}%
                    {(d as any).commission_base_deduction > 0 && ` (底扣 $${((d as any).commission_base_deduction || 0).toLocaleString()})`}
                  </span>
                  {(d as any).product_commission_rate > 0 && (
                    <span style={{ background: "#E1F5EE", color: "#085041", padding: "2px 8px", borderRadius: 6 }}>
                      商品抽成 {Math.round(((d as any).product_commission_rate || 0) * 100)}%
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 11, color: "#888780" }}>
                  {d.joined_date && <span>加入：{d.joined_date.replace(/-/g, "/")}</span>}
                  {d.left_date && <span style={{ color: "#A32D2D" }}>離職：{d.left_date.replace(/-/g, "/")}</span>}
                </div>

                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: d.can_view_members ? "#E1F5EE" : "#FCEBEB", color: d.can_view_members ? "#085041" : "#A32D2D" }}>
                    {d.can_view_members ? "✓ 可查看會員" : "✕ 禁止查看會員"}
                  </span>
                  {d.is_manager && (
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: "#EEEDFE", color: "#534AB7", fontWeight: 600 }}>
                      店長權限
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  <button onClick={() => moveDesigner(index, -1)} disabled={index === 0} style={{ padding: "5px 10px", background: index === 0 ? "#F1EFE8" : "#fff", color: index === 0 ? "#C0BDB5" : "#5F5E5A", border: "1px solid #D3D1C7", borderRadius: 6, fontSize: 11, cursor: index === 0 ? "default" : "pointer" }}>上移</button>
                  <button onClick={() => moveDesigner(index, 1)} disabled={index === designers.length - 1} style={{ padding: "5px 10px", background: index === designers.length - 1 ? "#F1EFE8" : "#fff", color: index === designers.length - 1 ? "#C0BDB5" : "#5F5E5A", border: "1px solid #D3D1C7", borderRadius: 6, fontSize: 11, cursor: index === designers.length - 1 ? "default" : "pointer" }}>下移</button>
                  <button onClick={() => openEdit(d)} style={{ padding: "5px 10px", background: "#EEEDFE", color: "#534AB7", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>編輯</button>
                  <button onClick={() => router.push(`/admin/designer-prices?designerId=${d.id}`)} style={{ padding: "5px 10px", background: "#F8F7F3", color: "#5F5E5A", border: "1px solid #D3D1C7", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>專屬價目表</button>
                  <button onClick={() => toggleStatus(d)} style={{ padding: "5px 10px", background: d.status === "active" ? "#FCEBEB" : "#E1F5EE", color: d.status === "active" ? "#A32D2D" : "#085041", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
                    {d.status === "active" ? "設為離職" : "恢復在職"}
                  </button>
                  <button onClick={() => toggleMemberAccess(d)} style={{ padding: "5px 10px", background: "#FAEEDA", color: "#BA7517", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
                    {d.can_view_members ? "禁止查看會員" : "允許查看會員"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 表單跳窗 */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px 16px 32px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{editing ? "編輯設計師" : "新增設計師"}</div>
              <button onClick={() => setShowForm(false)} style={{ background: "#F1EFE8", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, color: "#888780", marginBottom: 8 }}>基本資料</div>
            {[
              { key: "name", label: "英文名 *", placeholder: "Cherry" },
              { key: "display_name", label: "中文名", placeholder: "林亮瑩" },
              { key: "nickname", label: "暱稱", placeholder: "扁頭救星" },
              { key: "initials", label: "縮寫", placeholder: "C" },
              { key: "style", label: "專長", placeholder: "日系、剪髮、染髮" },
              { key: "ig", label: "Instagram", placeholder: "bingcherry_cherry" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>{f.label}</div>
                <input
                  value={(form as any)[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
              </div>
            ))}

            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>背景色</div>
                <input type="color" value={form.bg_color} onChange={(e) => setForm({ ...form, bg_color: e.target.value })} style={{ width: "100%", height: 38, borderRadius: 8, border: "1px solid #D3D1C7", cursor: "pointer" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>文字色</div>
                <input type="color" value={form.text_color} onChange={(e) => setForm({ ...form, text_color: e.target.value })} style={{ width: "100%", height: 38, borderRadius: 8, border: "1px solid #D3D1C7", cursor: "pointer" }} />
              </div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, color: "#888780", marginBottom: 8, marginTop: 4 }}>服務業績抽成</div>
            <div style={{ background: "#F1EFE8", borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#888780", marginBottom: 10, lineHeight: 1.6 }}>
                計算方式：(業績 - 底扣) × 抽成%<br/>
                例：業績 10萬，底扣 5萬，抽 20% → (10萬-5萬)×20% = 1萬
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>每月底扣金額（元）</div>
                <input value={form.commission_base_deduction || ""} onChange={(e) => setForm({ ...form, commission_base_deduction: parseInt(e.target.value) || 0 })} type="number" placeholder="0" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>抽成比例（底扣後）</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input value={Math.round(form.commission_rate * 100) || ""} onChange={(e) => setForm({ ...form, commission_rate: (parseInt(e.target.value) || 0) / 100 })} type="number" min="0" max="100" placeholder="0" style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#534AB7" }}>%</span>
                </div>
              </div>
              <div style={{ background: "#EEEDFE", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#534AB7" }}>
                預覽：業績 $100,000 → 抽成 ${(Math.max(0, 100000 - form.commission_base_deduction) * form.commission_rate).toLocaleString()}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#F1EFE8", borderRadius: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 13, color: "#2C2C2A" }}>可查看會員資料</div>
                <div style={{ fontSize: 11, color: "#888780" }}>關閉後設計師無法查看客人聯絡資料</div>
              </div>
              <div onClick={() => setForm({ ...form, can_view_members: !form.can_view_members })} style={{ width: 44, height: 24, borderRadius: 12, background: form.can_view_members ? "#534AB7" : "#D3D1C7", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: form.can_view_members ? 22 : 2, transition: "left 0.2s" }} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#F1EFE8", borderRadius: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 13, color: "#2C2C2A" }}>店長權限</div>
                <div style={{ fontSize: 11, color: "#888780" }}>可查看全店預約，並協助新增、確認或取消預約</div>
              </div>
              <div onClick={() => setForm({ ...form, is_manager: !form.is_manager })} style={{ width: 44, height: 24, borderRadius: 12, background: form.is_manager ? "#534AB7" : "#D3D1C7", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: form.is_manager ? 22 : 2, transition: "left 0.2s" }} />
              </div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, color: "#888780", marginBottom: 8 }}>品牌社群資源共享費</div>
            <div style={{ background: "#F1EFE8", borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#888780", marginBottom: 8, lineHeight: 1.6 }}>
                計算方式：總服務業績 × %<br/>從抽成中扣除
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input value={Math.round((form.brand_fee_rate || 0) * 100) || ""} onChange={(e) => setForm({ ...form, brand_fee_rate: (parseInt(e.target.value) || 0) / 100 })} type="number" min="0" max="100" placeholder="0" style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: "#534AB7" }}>%</span>
              </div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, color: "#888780", marginBottom: 8 }}>商品抽成</div>
            <div style={{ background: "#F1EFE8", borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#888780", marginBottom: 8, lineHeight: 1.6 }}>
                計算方式：商品銷售額 × %
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  value={Math.round((form.product_commission_rate || 0) * 100) || ""}
                  onChange={(e) => setForm({ ...form, product_commission_rate: (parseInt(e.target.value) || 0) / 100 })}
                  type="number" min="0" max="100" placeholder="0"
                  style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
                <span style={{ fontSize: 14, fontWeight: 600, color: "#534AB7" }}>%</span>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>狀態</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[{ val: "active", label: "在職" }, { val: "inactive", label: "離職" }].map(s => (
                  <button key={s.val} onClick={() => setForm({ ...form, status: s.val })} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: form.status === s.val ? (s.val === "active" ? "#E1F5EE" : "#FCEBEB") : "#F1EFE8", color: form.status === s.val ? (s.val === "active" ? "#085041" : "#A32D2D") : "#888780", fontWeight: form.status === s.val ? 600 : 400, fontSize: 13, cursor: "pointer" }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleSave} disabled={saving} style={{ width: "100%", padding: "12px 0", background: saving ? "#D3D1C7" : "#534AB7", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: saving ? "default" : "pointer" }}>
              {saving ? "儲存中..." : "儲存"}
            </button>
          </div>
        </div>
      )}

      <AdminBottomNav current="designers" />
    </div>
  );
}
