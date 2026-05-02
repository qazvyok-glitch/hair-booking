"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminBottomNav from "../components/BottomNav";

type Product = { id: number; name: string; unit: string; unit_price: number; category: string; is_active: boolean; sort_order: number };

export default function AdminProducts() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [form, setForm] = useState({ name: "", unit: "個", unit_price: 0, category: "", sort_order: 0 });
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
    supabase.from("products").select("*").order("category").order("sort_order").then(({ data }) => {
      if (data) setProducts(data);
      setLoading(false);
    });
  }, [router]);

  const categories = [...new Set(products.map(p => p.category))].filter(Boolean);

  const filtered = products.filter(p => {
    if (filterCategory !== "all" && p.category !== filterCategory) return false;
    if (search && !p.name.includes(search)) return false;
    return true;
  });

  function openNew() {
    setEditing(null);
    setForm({ name: "", unit: "個", unit_price: 0, category: categories[0] || "", sort_order: 0 });
    setShowForm(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({ name: p.name, unit: p.unit, unit_price: p.unit_price, category: p.category, sort_order: p.sort_order || 0 });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name) { alert("請填寫商品名稱"); return; }
    setSaving(true);
    if (editing) {
      await supabase.from("products").update(form).eq("id", editing.id);
      setProducts(products.map(p => p.id === editing.id ? { ...p, ...form } : p));
    } else {
      const { data } = await supabase.from("products").insert({ ...form, is_active: true }).select().single();
      if (data) setProducts([...products, data]);
    }
    setSaving(false);
    setShowForm(false);
  }

  async function toggleActive(p: Product) {
    await supabase.from("products").update({ is_active: !p.is_active }).eq("id", p.id);
    setProducts(products.map(x => x.id === p.id ? { ...x, is_active: !x.is_active } : x));
  }

  async function handleDelete(id: number) {
    if (!confirm("確定刪除這個商品？")) return;
    await supabase.from("products").delete().eq("id", id);
    setProducts(products.filter(p => p.id !== id));
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#534AB7", fontSize: 14 }}>載入中...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", paddingBottom: 70, paddingLeft: isDesktop ? 220 : 0 }}>
      <div style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>商品管理</div>
        <button onClick={openNew} style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>＋ 新增</button>
      </div>

      <div style={{ padding: "12px 16px 0" }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜尋商品名稱..." style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 10 }} />

        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          <button onClick={() => setFilterCategory("all")} style={{ padding: "5px 12px", borderRadius: 20, border: "none", background: filterCategory === "all" ? "#534AB7" : "#fff", color: filterCategory === "all" ? "#fff" : "#5F5E5A", fontSize: 11, cursor: "pointer" }}>全部</button>
          {categories.map(cat => (
            <button key={cat} onClick={() => setFilterCategory(cat)} style={{ padding: "5px 12px", borderRadius: 20, border: "none", background: filterCategory === cat ? "#534AB7" : "#fff", color: filterCategory === cat ? "#fff" : "#5F5E5A", fontSize: 11, cursor: "pointer" }}>{cat}</button>
          ))}
        </div>

        <div style={{ fontSize: 12, color: "#888780", marginBottom: 8 }}>共 {filtered.length} 項商品</div>

        {isDesktop ? (
          <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #D3D1C7", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F1EFE8" }}>
                  {["商品名稱", "分類", "單位", "售價", "狀態", "操作"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", fontSize: 12, color: "#888780", fontWeight: 600, textAlign: "left", borderBottom: "0.5px solid #D3D1C7" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "0.5px solid #F1EFE8", opacity: p.is_active ? 1 : 0.5 }}>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#2C2C2A" }}>{p.name}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "#888780" }}>{p.category}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "#888780" }}>{p.unit}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#534AB7", fontWeight: 600 }}>${p.unit_price.toLocaleString()}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, background: p.is_active ? "#E1F5EE" : "#F1EFE8", color: p.is_active ? "#085041" : "#888780" }}>
                        {p.is_active ? "上架" : "下架"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => toggleActive(p)} style={{ padding: "3px 8px", background: "#FAEEDA", color: "#BA7517", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>{p.is_active ? "下架" : "上架"}</button>
                        <button onClick={() => openEdit(p)} style={{ padding: "3px 8px", background: "#EEEDFE", color: "#534AB7", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>編輯</button>
                        <button onClick={() => handleDelete(p.id)} style={{ padding: "3px 8px", background: "#FCEBEB", color: "#A32D2D", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>刪除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          filtered.map((p) => (
            <div key={p.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, border: "0.5px solid #D3D1C7", opacity: p.is_active ? 1 : 0.6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#2C2C2A" }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>{p.category} ・ {p.unit} ・ ${p.unit_price.toLocaleString()}</div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => toggleActive(p)} style={{ padding: "3px 8px", background: p.is_active ? "#FAEEDA" : "#E1F5EE", color: p.is_active ? "#BA7517" : "#085041", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>{p.is_active ? "下架" : "上架"}</button>
                  <button onClick={() => openEdit(p)} style={{ padding: "3px 8px", background: "#EEEDFE", color: "#534AB7", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>編輯</button>
                  <button onClick={() => handleDelete(p.id)} style={{ padding: "3px 8px", background: "#FCEBEB", color: "#A32D2D", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>刪除</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 表單跳窗 */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px 16px 32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{editing ? "編輯商品" : "新增商品"}</div>
              <button onClick={() => setShowForm(false)} style={{ background: "#F1EFE8", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>商品名稱 *</div>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>分類</div>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="哥德式、沂樂..." style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>單位</div>
                <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none" }}>
                  <option value="個">個</option>
                  <option value="瓶">瓶</option>
                  <option value="罐">罐</option>
                  <option value="包">包</option>
                  <option value="組">組</option>
                  <option value="支">支</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>售價</div>
                <input value={form.unit_price || ""} onChange={(e) => setForm({ ...form, unit_price: parseInt(e.target.value) || 0 })} type="number" placeholder="0" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
            <button onClick={handleSave} disabled={saving} style={{ width: "100%", padding: "12px 0", background: saving ? "#D3D1C7" : "#534AB7", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: saving ? "default" : "pointer" }}>
              {saving ? "儲存中..." : "儲存"}
            </button>
          </div>
        </div>
      )}

      <AdminBottomNav current="products" />
    </div>
  );
}
