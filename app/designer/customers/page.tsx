"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import BottomNav from "../components/BottomNav";

type DesignerSession = { id: number; name: string; nickname: string };
type CustomerNote = {
  id: number;
  customer_name: string;
  customer_phone: string;
  hair_type: string;
  preferences: string;
  allergies: string;
  notes: string;
  last_visit: string;
};

export default function DesignerCustomers() {
  const router = useRouter();
  const [designer, setDesigner] = useState<DesignerSession | null>(null);
  const [customers, setCustomers] = useState<CustomerNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CustomerNote | null>(null);
  const [form, setForm] = useState({ customer_name: "", customer_phone: "", hair_type: "", preferences: "", allergies: "", notes: "", last_visit: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const session = sessionStorage.getItem("designerSession");
    if (!session) { router.push("/designer/login"); return; }
    const d = JSON.parse(session);
    setDesigner(d);

    supabase.from("customer_notes").select("*").eq("designer_id", d.id).order("customer_name").then(({ data }) => {
      if (data) setCustomers(data);
      setLoading(false);
    });
  }, [router]);

  function openNew() {
    setEditing(null);
    setForm({ customer_name: "", customer_phone: "", hair_type: "", preferences: "", allergies: "", notes: "", last_visit: "" });
    setShowForm(true);
  }

  function openEdit(c: CustomerNote) {
    setEditing(c);
    setForm({ customer_name: c.customer_name, customer_phone: c.customer_phone || "", hair_type: c.hair_type || "", preferences: c.preferences || "", allergies: c.allergies || "", notes: c.notes || "", last_visit: c.last_visit || "" });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.customer_name) { alert("請填寫顧客姓名"); return; }
    setSaving(true);
    if (editing) {
      await supabase.from("customer_notes").update({ ...form, updated_at: new Date().toISOString() }).eq("id", editing.id);
      setCustomers(customers.map(c => c.id === editing.id ? { ...c, ...form } : c));
    } else {
      const { data } = await supabase.from("customer_notes").insert({ ...form, designer_id: designer!.id }).select().single();
      if (data) setCustomers([...customers, data]);
    }
    setSaving(false);
    setShowForm(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("確定刪除這筆顧客紀錄？")) return;
    await supabase.from("customer_notes").delete().eq("id", id);
    setCustomers(customers.filter(c => c.id !== id));
  }

  const filtered = customers.filter(c =>
    c.customer_name.includes(search) || (c.customer_phone || "").includes(search)
  );

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#534AB7", fontSize: 14 }}>載入中...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", paddingBottom: 70 }}>
      <div style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>顧客備忘</div>
        <button onClick={openNew} style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>＋ 新增</button>
      </div>

      <div style={{ padding: "12px 16px 0" }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜尋顧客姓名或電話..." style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 12 }} />

        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#888780", fontSize: 14 }}>尚無顧客紀錄</div>
        ) : (
          filtered.map((c) => (
            <div key={c.id} style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, border: "0.5px solid #D3D1C7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#2C2C2A" }}>{c.customer_name}</div>
                  {c.customer_phone && <div style={{ fontSize: 12, color: "#888780" }}>{c.customer_phone}</div>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => openEdit(c)} style={{ background: "#EEEDFE", color: "#534AB7", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>編輯</button>
                  <button onClick={() => handleDelete(c.id)} style={{ background: "#FCEBEB", color: "#A32D2D", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>刪除</button>
                </div>
              </div>
              {c.hair_type && <div style={{ fontSize: 12, color: "#5F5E5A", marginBottom: 2 }}>髮質：{c.hair_type}</div>}
              {c.preferences && <div style={{ fontSize: 12, color: "#5F5E5A", marginBottom: 2 }}>喜好：{c.preferences}</div>}
              {c.allergies && <div style={{ fontSize: 12, color: "#A32D2D", marginBottom: 2 }}>過敏：{c.allergies}</div>}
              {c.notes && <div style={{ fontSize: 11, color: "#888780", background: "#F1EFE8", borderRadius: 6, padding: "4px 8px", marginTop: 4 }}>{c.notes}</div>}
              {c.last_visit && <div style={{ fontSize: 11, color: "#888780", marginTop: 4 }}>上次到訪：{c.last_visit.replace(/-/g, "/")}</div>}
            </div>
          ))
        )}
      </div>

      {/* 表單跳窗 */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 390, background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px 16px 32px", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#2C2C2A" }}>{editing ? "編輯顧客" : "新增顧客"}</div>
              <button onClick={() => setShowForm(false)} style={{ background: "#F1EFE8", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer" }}>✕</button>
            </div>
            {[
              { key: "customer_name", label: "姓名 *", placeholder: "王小明" },
              { key: "customer_phone", label: "電話", placeholder: "0912-345-678" },
              { key: "hair_type", label: "髮質", placeholder: "細軟、易毛躁..." },
              { key: "preferences", label: "喜好風格", placeholder: "自然系、日系..." },
              { key: "allergies", label: "過敏／注意事項", placeholder: "對XX染劑過敏..." },
              { key: "last_visit", label: "上次到訪", placeholder: "2024-01-01", type: "date" },
            ].map((f) => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>{f.label}</div>
                <input
                  value={(form as any)[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  type={(f as any).type || "text"}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>備忘筆記</div>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="特殊記錄、習慣..." style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", height: 80, resize: "none", boxSizing: "border-box" }} />
            </div>
            <button onClick={handleSave} disabled={saving} style={{ width: "100%", padding: "13px 0", background: saving ? "#D3D1C7" : "#534AB7", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: saving ? "default" : "pointer" }}>
              {saving ? "儲存中..." : "儲存"}
            </button>
          </div>
        </div>
      )}

      <BottomNav current="customers" />
    </div>
  );
}
