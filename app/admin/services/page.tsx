"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminBottomNav from "../components/BottomNav";

type Service = { id: number; name: string; duration: string; note: string; category_id: number; is_active: boolean; sort_order: number; default_price: number };
type ServiceCategory = { id: number; name: string; label: string; color: string; text_color: string; is_active: boolean; sort_order: number };

export default function AdminServices() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [activeTab, setActiveTab] = useState<"services" | "categories">("services");
  const [form, setForm] = useState({ name: "", duration: "", note: "", category_id: 0, default_price: 0, sort_order: 0 });
  const [catForm, setCatForm] = useState({ name: "", label: "", color: "#E1F5EE", text_color: "#085041", sort_order: 0 });
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<ServiceCategory | null>(null);
  const [saving, setSaving] = useState(false);

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
    const [{ data: sData }, { data: cData }] = await Promise.all([
      supabase.from("services").select("*").order("category_id").order("sort_order"),
      supabase.from("service_categories").select("*").order("sort_order"),
    ]);
    if (sData) setServices(sData);
    if (cData) setCategories(cData);
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setForm({ name: "", duration: "", note: "", category_id: categories[0]?.id || 0, default_price: 0, sort_order: 0 });
    setShowForm(true);
  }

  function openEdit(s: Service) {
    setEditing(s);
    setForm({ name: s.name, duration: s.duration || "", note: s.note || "", category_id: s.category_id, default_price: s.default_price || 0, sort_order: s.sort_order || 0 });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name) { alert("請填寫服務名稱"); return; }
    setSaving(true);
    if (editing) {
      await supabase.from("services").update(form).eq("id", editing.id);
      setServices(services.map(s => s.id === editing.id ? { ...s, ...form } : s));
    } else {
      const { data } = await supabase.from("services").insert({ ...form, is_active: true }).select().single();
      if (data) setServices([...services, data]);
    }
    setSaving(false);
    setShowForm(false);
  }

  async function toggleActive(s: Service) {
    await supabase.from("services").update({ is_active: !s.is_active }).eq("id", s.id);
    setServices(services.map(x => x.id === s.id ? { ...x, is_active: !x.is_active } : x));
  }

  async function handleCatSave() {
    if (!catForm.name || !catForm.label) { alert("請填寫分類資料"); return; }
    setSaving(true);
    if (editingCat) {
      await supabase.from("service_categories").update(catForm).eq("id", editingCat.id);
      setCategories(categories.map(c => c.id === editingCat.id ? { ...c, ...catForm } : c));
    } else {
      const { data } = await supabase.from("service_categories").insert({ ...catForm, is_active: true }).select().single();
      if (data) setCategories([...categories, data]);
    }
    setSaving(false);
    setShowCatForm(false);
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#534AB7", fontSize: 14 }}>載入中...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", paddingBottom: 70, paddingLeft: isDesktop ? 220 : 0 }}>
      <div style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>服務管理</div>
        <button onClick={activeTab === "services" ? openNew : () => { setEditingCat(null); setCatForm({ name: "", label: "", color: "#E1F5EE", text_color: "#085041", sort_order: 0 }); setShowCatForm(true); }} style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>＋ 新增</button>
      </div>

      {/* Tab */}
      <div style={{ display: "flex", gap: 6, padding: "12px 16px 8px" }}>
        {[{ key: "services", label: "服務項目" }, { key: "categories", label: "服務分類" }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as "services" | "categories")} style={{ padding: "6px 16px", borderRadius: 20, border: "none", background: activeTab === t.key ? "#534AB7" : "#fff", color: activeTab === t.key ? "#fff" : "#5F5E5A", fontSize: 12, fontWeight: activeTab === t.key ? 600 : 400, cursor: "pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 16px 16px" }}>
        {activeTab === "services" && (
          <>
            {categories.map(cat => {
              const catServices = services.filter(s => s.category_id === cat.id);
              if (catServices.length === 0) return null;
              return (
                <div key={cat.id} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#888780", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ background: cat.color, color: cat.text_color, padding: "2px 10px", borderRadius: 10, fontSize: 11 }}>{cat.label}</span>
                  </div>
                  {catServices.map(s => (
                    <div key={s.id} style={{ background: s.is_active ? "#fff" : "#F1EFE8", borderRadius: 12, padding: "12px 14px", marginBottom: 6, border: "0.5px solid #D3D1C7", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: s.is_active ? 1 : 0.6 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#2C2C2A" }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>
                          {s.duration && `${s.duration}`}{s.note && ` ・ ${s.note}`}{s.default_price ? ` ・ $${s.default_price.toLocaleString()}` : ""}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <button onClick={() => toggleActive(s)} style={{ padding: "3px 8px", background: s.is_active ? "#E1F5EE" : "#FAEEDA", color: s.is_active ? "#085041" : "#BA7517", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
                          {s.is_active ? "上架" : "下架"}
                        </button>
                        <button onClick={() => openEdit(s)} style={{ padding: "3px 8px", background: "#EEEDFE", color: "#534AB7", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>編輯</button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        )}

        {activeTab === "categories" && (
          <>
            {categories.map(cat => (
              <div key={cat.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, border: "0.5px solid #D3D1C7", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: cat.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 11, color: cat.text_color, fontWeight: 600 }}>{cat.label.slice(0, 2)}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#2C2C2A" }}>{cat.label}</div>
                    <div style={{ fontSize: 11, color: "#888780" }}>{cat.name}</div>
                  </div>
                </div>
                <button onClick={() => { setEditingCat(cat); setCatForm({ name: cat.name, label: cat.label, color: cat.color, text_color: cat.text_color, sort_order: cat.sort_order || 0 }); setShowCatForm(true); }} style={{ padding: "4px 10px", background: "#EEEDFE", color: "#534AB7", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>編輯</button>
              </div>
            ))}
          </>
        )}
      </div>

      {/* 服務表單 */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px 16px 32px", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{editing ? "編輯服務" : "新增服務"}</div>
              <button onClick={() => setShowForm(false)} style={{ background: "#F1EFE8", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>服務名稱 *</div>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>所屬分類</div>
              <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: parseInt(e.target.value) })} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none" }}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>預設金額</div>
                <input value={form.default_price || ""} onChange={(e) => setForm({ ...form, default_price: parseInt(e.target.value) || 0 })} type="number" placeholder="0" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>時長</div>
                <input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="60 分鐘" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>備註</div>
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="依髮長計價..." style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
            <button onClick={handleSave} disabled={saving} style={{ width: "100%", padding: "12px 0", background: saving ? "#D3D1C7" : "#534AB7", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: saving ? "default" : "pointer" }}>
              {saving ? "儲存中..." : "儲存"}
            </button>
          </div>
        </div>
      )}

      {/* 分類表單 */}
      {showCatForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px 16px 32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{editingCat ? "編輯分類" : "新增分類"}</div>
              <button onClick={() => setShowCatForm(false)} style={{ background: "#F1EFE8", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer" }}>✕</button>
            </div>
            {[
              { key: "name", label: "分類代碼", placeholder: "cut" },
              { key: "label", label: "顯示名稱", placeholder: "✂ 剪髮" },
              { key: "color", label: "背景色", placeholder: "#E1F5EE", type: "color" },
              { key: "text_color", label: "文字色", placeholder: "#085041", type: "color" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>{f.label}</div>
                <input
                  value={(catForm as any)[f.key]}
                  onChange={(e) => setCatForm({ ...catForm, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  type={(f as any).type || "text"}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
              </div>
            ))}
            <button onClick={handleCatSave} disabled={saving} style={{ width: "100%", padding: "12px 0", background: saving ? "#D3D1C7" : "#534AB7", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: saving ? "default" : "pointer" }}>
              {saving ? "儲存中..." : "儲存"}
            </button>
          </div>
        </div>
      )}

      <AdminBottomNav current="services" />
    </div>
  );
}

