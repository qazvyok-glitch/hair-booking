"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminBottomNav from "../components/BottomNav";

type ShopInfo = { id: number; key: string; label: string; value: string; sort_order: number; is_active: boolean };

export default function AdminShop() {
  const router = useRouter();
  const [items, setItems] = useState<ShopInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [edited, setEdited] = useState<Record<number, string>>({});
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ key: "", label: "", value: "", sort_order: 0 });
  const [formSaving, setFormSaving] = useState(false);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const session = sessionStorage.getItem("adminSession");
    if (!session) { router.push("/admin/login"); return; }
    supabase.from("shop_info").select("*").order("sort_order").then(({ data }) => {
      if (data) setItems(data);
      setLoading(false);
    });
  }, [router]);

  async function handleSave(item: ShopInfo) {
    setSaving(item.id);
    const newValue = edited[item.id] ?? item.value;
    await supabase.from("shop_info").update({ value: newValue }).eq("id", item.id);
    setItems(items.map(i => i.id === item.id ? { ...i, value: newValue } : i));
    setSaving(null);
  }

  async function toggleActive(item: ShopInfo) {
    await supabase.from("shop_info").update({ is_active: !item.is_active }).eq("id", item.id);
    setItems(items.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i));
  }

  async function handleAdd() {
    if (!form.key || !form.label) { alert("請填寫 key 和標籤"); return; }
    setFormSaving(true);
    const { data } = await supabase.from("shop_info").insert({ ...form, is_active: true }).select().single();
    if (data) setItems([...items, data]);
    setFormSaving(false);
    setShowForm(false);
    setForm({ key: "", label: "", value: "", sort_order: 0 });
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#534AB7", fontSize: 14 }}>載入中...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", paddingBottom: 70, paddingLeft: isDesktop ? 220 : 0 }}>
      <div style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>店資訊設定</div>
        <button onClick={() => setShowForm(true)} style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>＋ 新增</button>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ background: "#FAEEDA", border: "0.5px solid #FAC775", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#633806" }}>
          修改後點「儲存」即時更新到關於我們頁面
        </div>

        {items.map((item) => (
          <div key={item.id} style={{ background: "#fff", borderRadius: 12, padding: "14px", marginBottom: 8, border: "0.5px solid #D3D1C7", opacity: item.is_active ? 1 : 0.6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A" }}>{item.label}</span>
                <span style={{ fontSize: 10, color: "#888780", marginLeft: 6 }}>({item.key})</span>
              </div>
              <button onClick={() => toggleActive(item)} style={{ padding: "3px 8px", background: item.is_active ? "#E1F5EE" : "#F1EFE8", color: item.is_active ? "#085041" : "#888780", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
                {item.is_active ? "顯示中" : "已隱藏"}
              </button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={edited[item.id] ?? item.value}
                onChange={(e) => setEdited({ ...edited, [item.id]: e.target.value })}
                style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none" }}
              />
              <button
                onClick={() => handleSave(item)}
                disabled={saving === item.id}
                style={{ padding: "8px 14px", background: saving === item.id ? "#D3D1C7" : "#534AB7", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, cursor: saving === item.id ? "default" : "pointer", whiteSpace: "nowrap" }}
              >
                {saving === item.id ? "..." : "儲存"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px 16px 32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>新增資訊項目</div>
              <button onClick={() => setShowForm(false)} style={{ background: "#F1EFE8", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer" }}>✕</button>
            </div>
            {[
              { key: "key", label: "識別碼（英文）", placeholder: "facebook" },
              { key: "label", label: "顯示標籤", placeholder: "Facebook" },
              { key: "value", label: "內容值", placeholder: "https://..." },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>{f.label}</div>
                <input value={(form as any)[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
            <button onClick={handleAdd} disabled={formSaving} style={{ width: "100%", padding: "12px 0", background: formSaving ? "#D3D1C7" : "#534AB7", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: formSaving ? "default" : "pointer" }}>
              {formSaving ? "新增中..." : "新增"}
            </button>
          </div>
        </div>
      )}

      <AdminBottomNav current="dashboard" />
    </div>
  );
}
