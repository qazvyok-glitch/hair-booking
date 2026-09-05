"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminBottomNav from "../components/BottomNav";

type PriceItem = { id: number; category: string; name: string; price_range: string; sort_order: number };

function sortPriceItems(list: PriceItem[]) {
  return [...list].sort((a, b) => a.category.localeCompare(b.category) || (a.sort_order || a.id) - (b.sort_order || b.id));
}

export default function AdminPrices() {
  const router = useRouter();
  const [items, setItems] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PriceItem | null>(null);
  const [filterCategory, setFilterCategory] = useState("all");
  const [form, setForm] = useState({ category: "", name: "", price_range: "", sort_order: 0 });
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

  function fetchData() {
    supabase.from("price_items").select("*").order("category").order("sort_order").then(({ data }) => {
      if (data) setItems(sortPriceItems(data));
      setLoading(false);
    });
  }

  const categories = [...new Set(items.map(p => p.category))].filter(Boolean);
  const filtered = filterCategory === "all" ? items : items.filter(p => p.category === filterCategory);

  function openNew() {
    setEditing(null);
    const defaultCategory = categories[0] || "";
    const nextSortOrder = items.filter((item) => item.category === defaultCategory).reduce((max, item) => Math.max(max, item.sort_order || 0), 0) + 1;
    setForm({ category: defaultCategory, name: "", price_range: "", sort_order: nextSortOrder });
    setShowForm(true);
  }

  function openEdit(p: PriceItem) {
    setEditing(p);
    setForm({ category: p.category, name: p.name, price_range: p.price_range, sort_order: p.sort_order || 0 });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name || !form.price_range) { alert("請填寫名稱與價格"); return; }
    setSaving(true);
    if (editing) {
      await supabase.from("price_items").update(form).eq("id", editing.id);
      setItems(sortPriceItems(items.map(p => p.id === editing.id ? { ...p, ...form } : p)));
    } else {
      const nextSortOrder = items.filter((item) => item.category === form.category).reduce((max, item) => Math.max(max, item.sort_order || 0), 0) + 1;
      const { data } = await supabase.from("price_items").insert({ ...form, sort_order: nextSortOrder }).select().single();
      if (data) setItems(sortPriceItems([...items, data]));
    }
    setSaving(false);
    setShowForm(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("確定刪除這筆價格？")) return;
    await supabase.from("price_items").delete().eq("id", id);
    setItems(items.filter(p => p.id !== id));
  }

  async function movePriceItem(item: PriceItem, direction: -1 | 1) {
    const categoryItems = sortPriceItems(items.filter((price) => price.category === item.category));
    const index = categoryItems.findIndex((price) => price.id === item.id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= categoryItems.length) return;

    const target = categoryItems[targetIndex];
    const currentOrder = item.sort_order || index + 1;
    const targetOrder = target.sort_order || targetIndex + 1;
    setItems(sortPriceItems(items.map((price) => {
      if (price.id === item.id) return { ...price, sort_order: targetOrder };
      if (price.id === target.id) return { ...price, sort_order: currentOrder };
      return price;
    })));

    const [{ error: currentError }, { error: targetError }] = await Promise.all([
      supabase.from("price_items").update({ sort_order: targetOrder }).eq("id", item.id),
      supabase.from("price_items").update({ sort_order: currentOrder }).eq("id", target.id),
    ]);

    if (currentError || targetError) {
      alert("排序更新失敗，請再試一次");
      fetchData();
    }
  }

  function canMove(item: PriceItem, direction: -1 | 1) {
    const categoryItems = sortPriceItems(items.filter((price) => price.category === item.category));
    const index = categoryItems.findIndex((price) => price.id === item.id);
    const targetIndex = index + direction;
    return index >= 0 && targetIndex >= 0 && targetIndex < categoryItems.length;
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#534AB7", fontSize: 14 }}>載入中...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", paddingBottom: 70, paddingLeft: isDesktop ? 220 : 0 }}>
      <div style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>店公版價目表</div>
        <button onClick={openNew} style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>＋ 新增</button>
      </div>

      <div style={{ padding: "12px 16px 0" }}>
        {/* 分類篩選 */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
          <button onClick={() => setFilterCategory("all")} style={{ padding: "5px 12px", borderRadius: 20, border: "none", background: filterCategory === "all" ? "#534AB7" : "#fff", color: filterCategory === "all" ? "#fff" : "#5F5E5A", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>全部</button>
          {categories.map(cat => (
            <button key={cat} onClick={() => setFilterCategory(cat)} style={{ padding: "5px 12px", borderRadius: 20, border: "none", background: filterCategory === cat ? "#534AB7" : "#fff", color: filterCategory === cat ? "#fff" : "#5F5E5A", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>{cat}</button>
          ))}
        </div>

        {isDesktop ? (
          <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #D3D1C7", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F1EFE8" }}>
                  {["排序", "分類", "項目名稱", "價格", "操作"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", fontSize: 12, color: "#888780", fontWeight: 600, textAlign: "left", borderBottom: "0.5px solid #D3D1C7" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "0.5px solid #F1EFE8" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button disabled={!canMove(p, -1)} onClick={() => movePriceItem(p, -1)} style={{ padding: "3px 8px", background: canMove(p, -1) ? "#F8F7F3" : "#F1EFE8", color: canMove(p, -1) ? "#5F5E5A" : "#B8B6AF", border: "1px solid #D3D1C7", borderRadius: 6, fontSize: 11, cursor: canMove(p, -1) ? "pointer" : "default" }}>上移</button>
                        <button disabled={!canMove(p, 1)} onClick={() => movePriceItem(p, 1)} style={{ padding: "3px 8px", background: canMove(p, 1) ? "#F8F7F3" : "#F1EFE8", color: canMove(p, 1) ? "#5F5E5A" : "#B8B6AF", border: "1px solid #D3D1C7", borderRadius: 6, fontSize: 11, cursor: canMove(p, 1) ? "pointer" : "default" }}>下移</button>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "#888780" }}>{p.category}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#2C2C2A" }}>{p.name}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#534AB7", fontWeight: 500 }}>{p.price_range}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
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
          categories.filter(cat => filterCategory === "all" || cat === filterCategory).map(cat => (
            <div key={cat} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#888780", marginBottom: 6, padding: "4px 10px", background: "#fff", borderRadius: 8, display: "inline-block" }}>{cat}</div>
              {items.filter(p => p.category === cat).map(p => (
                <div key={p.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 6, border: "0.5px solid #D3D1C7" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#2C2C2A" }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: "#534AB7", marginTop: 2 }}>{p.price_range}</div>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button disabled={!canMove(p, -1)} onClick={() => movePriceItem(p, -1)} style={{ padding: "3px 8px", background: canMove(p, -1) ? "#F8F7F3" : "#F1EFE8", color: canMove(p, -1) ? "#5F5E5A" : "#B8B6AF", border: "1px solid #D3D1C7", borderRadius: 6, fontSize: 11, cursor: canMove(p, -1) ? "pointer" : "default" }}>上移</button>
                      <button disabled={!canMove(p, 1)} onClick={() => movePriceItem(p, 1)} style={{ padding: "3px 8px", background: canMove(p, 1) ? "#F8F7F3" : "#F1EFE8", color: canMove(p, 1) ? "#5F5E5A" : "#B8B6AF", border: "1px solid #D3D1C7", borderRadius: 6, fontSize: 11, cursor: canMove(p, 1) ? "pointer" : "default" }}>下移</button>
                      <button onClick={() => openEdit(p)} style={{ padding: "3px 8px", background: "#EEEDFE", color: "#534AB7", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>編輯</button>
                      <button onClick={() => handleDelete(p.id)} style={{ padding: "3px 8px", background: "#FCEBEB", color: "#A32D2D", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>刪除</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* 表單跳窗 */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px 16px 32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{editing ? "編輯價格" : "新增價格"}</div>
              <button onClick={() => setShowForm(false)} style={{ background: "#F1EFE8", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>分類</div>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="染髮 COLOR" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              {categories.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                  {categories.map(cat => (
                    <button key={cat} onClick={() => setForm({ ...form, category: cat })} style={{ padding: "2px 8px", borderRadius: 6, border: "1px solid #D3D1C7", background: form.category === cat ? "#534AB7" : "#fff", color: form.category === cat ? "#fff" : "#5F5E5A", fontSize: 11, cursor: "pointer" }}>{cat}</button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>項目名稱 *</div>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="設計染（單色）" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>價格說明 *</div>
              <input value={form.price_range} onChange={(e) => setForm({ ...form, price_range: e.target.value })} placeholder="$2,200 / $2,500 / $3,000" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
            <button onClick={handleSave} disabled={saving} style={{ width: "100%", padding: "12px 0", background: saving ? "#D3D1C7" : "#534AB7", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: saving ? "default" : "pointer" }}>
              {saving ? "儲存中..." : "儲存"}
            </button>
          </div>
        </div>
      )}

      <AdminBottomNav current="prices" />
    </div>
  );
}
