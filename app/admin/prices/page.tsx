"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminBottomNav from "../components/BottomNav";

type PriceItem = { id: number; category: string; name: string; price_range: string; duration?: string | null; sort_order: number };
type ShopInfo = { id: number; key: string; label: string; value: string; is_active: boolean };
type Designer = { id: number; name: string; display_name?: string; nickname?: string };

const publicCategoryOrderKey = "price_category_order";
const hairLengthImageKey = "hair_length_image_url";

function mergeCategoryOrder(savedOrder: string[], currentCategories: string[]) {
  return [...savedOrder.filter((category) => currentCategories.includes(category)), ...currentCategories.filter((category) => !savedOrder.includes(category))];
}

function readCategoryOrder(value?: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function sortPriceItems(list: PriceItem[], categoryOrder: string[] = []) {
  return [...list].sort((a, b) => {
    const aCategoryIndex = categoryOrder.indexOf(a.category);
    const bCategoryIndex = categoryOrder.indexOf(b.category);
    const categorySort = (aCategoryIndex === -1 ? Number.MAX_SAFE_INTEGER : aCategoryIndex) - (bCategoryIndex === -1 ? Number.MAX_SAFE_INTEGER : bCategoryIndex);
    return categorySort || a.category.localeCompare(b.category) || (a.sort_order || a.id) - (b.sort_order || b.id);
  });
}

const durationPresets = [30, 45, 60, 75, 90, 120, 150, 180, 240];

function parseDurationMinutes(duration?: string | null) {
  if (!duration) return 0;
  const text = String(duration).replace(/\s+/g, "");
  const hourMatch = text.match(/(\d+(?:\.\d+)?)小時/);
  const minuteMatch = text.match(/(\d+)分/);
  if (hourMatch || minuteMatch) {
    return Math.round((hourMatch ? Number(hourMatch[1]) * 60 : 0) + (minuteMatch ? Number(minuteMatch[1]) : 0));
  }
  const numberMatch = text.match(/\d+/);
  return numberMatch ? Number(numberMatch[0]) : 0;
}

function formatDuration(minutes: number) {
  if (!minutes) return "";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} 分鐘`;
  if (!rest) return `${hours} 小時`;
  return `${hours} 小時 ${rest} 分鐘`;
}

function formatDurationLabel(duration?: string | null) {
  const minutes = parseDurationMinutes(duration);
  return minutes ? formatDuration(minutes) : "未設定";
}

export default function AdminPrices() {
  const router = useRouter();
  const [items, setItems] = useState<PriceItem[]>([]);
  const [draggingPriceId, setDraggingPriceId] = useState<number | null>(null);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [draggingCategory, setDraggingCategory] = useState<string | null>(null);
  const [hairLengthImage, setHairLengthImage] = useState<ShopInfo | null>(null);
  const [hairLengthDraft, setHairLengthDraft] = useState("");
  const [hairLengthPending, setHairLengthPending] = useState("");
  const [showHairLengthConfirm, setShowHairLengthConfirm] = useState(false);
  const [savingHairLength, setSavingHairLength] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PriceItem | null>(null);
  const [filterCategory, setFilterCategory] = useState("all");
  const [form, setForm] = useState({ category: "", name: "", price_range: "", duration: "", sort_order: 0 });
  const [syncDesignerIds, setSyncDesignerIds] = useState<number[]>([]);
  const [syncExpanded, setSyncExpanded] = useState(false);
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
    const [{ data }, { data: categorySetting }, { data: hairLengthSetting }, { data: designerData }] = await Promise.all([
      supabase.from("price_items").select("*").order("category").order("sort_order"),
      supabase.from("shop_info").select("id, value").eq("key", publicCategoryOrderKey).maybeSingle(),
      supabase.from("shop_info").select("id, key, label, value, is_active").eq("key", hairLengthImageKey).maybeSingle(),
      supabase.from("designers").select("id, name, display_name, nickname").order("sort_order", { nullsFirst: false }).order("id"),
    ]);
    setDesigners(designerData || []);
    if (hairLengthSetting) {
      setHairLengthImage(hairLengthSetting);
      setHairLengthDraft(hairLengthSetting.value || "");
    }
    if (data) {
      const currentCategories = [...new Set(data.map((p) => p.category))].filter(Boolean);
      const nextCategoryOrder = mergeCategoryOrder(readCategoryOrder(categorySetting?.value), currentCategories);
      setCategoryOrder(nextCategoryOrder);
      setItems(sortPriceItems(data, nextCategoryOrder));
      setLoading(false);
    }
  }

  function handleHairLengthFile(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setHairLengthPending(reader.result);
        setShowHairLengthConfirm(true);
      }
    };
    reader.readAsDataURL(file);
  }

  async function saveHairLengthImage() {
    if (!hairLengthPending.trim()) {
      alert("請先選擇圖片");
      return;
    }
    setSavingHairLength(true);
    if (hairLengthImage?.id) {
      const { data, error } = await supabase
        .from("shop_info")
        .update({ label: "髮長說明圖", value: hairLengthPending, is_active: true })
        .eq("id", hairLengthImage.id)
        .select("id, key, label, value, is_active")
        .single();
      if (error) alert("髮長說明圖儲存失敗，請再試一次");
      if (data) {
        setHairLengthImage(data);
        setHairLengthDraft(data.value || "");
        setHairLengthPending("");
        setShowHairLengthConfirm(false);
      }
    } else {
      const { data, error } = await supabase
        .from("shop_info")
        .insert({ key: hairLengthImageKey, label: "髮長說明圖", value: hairLengthPending, sort_order: 13, is_active: true })
        .select("id, key, label, value, is_active")
        .single();
      if (error) alert("髮長說明圖儲存失敗，請再試一次");
      if (data) {
        setHairLengthImage(data);
        setHairLengthDraft(data.value || "");
        setHairLengthPending("");
        setShowHairLengthConfirm(false);
      }
    }
    setSavingHairLength(false);
  }

  const categories = mergeCategoryOrder(categoryOrder, [...new Set(items.map(p => p.category))].filter(Boolean));
  const filtered = filterCategory === "all" ? sortPriceItems(items, categories) : sortPriceItems(items.filter(p => p.category === filterCategory), categories);

  function openNew() {
    setEditing(null);
    const defaultCategory = categories[0] || "";
    const nextSortOrder = items.filter((item) => item.category === defaultCategory).reduce((max, item) => Math.max(max, item.sort_order || 0), 0) + 1;
    setForm({ category: defaultCategory, name: "", price_range: "", duration: "", sort_order: nextSortOrder });
    setSyncDesignerIds([]);
    setSyncExpanded(false);
    setShowForm(true);
  }

  function openEdit(p: PriceItem) {
    setEditing(p);
    setForm({ category: p.category, name: p.name, price_range: p.price_range, duration: p.duration || "", sort_order: p.sort_order || 0 });
    setSyncDesignerIds([]);
    setSyncExpanded(false);
    setShowForm(true);
  }

  function toggleSyncDesigner(designerId: number) {
    setSyncDesignerIds((current) => current.includes(designerId) ? current.filter((id) => id !== designerId) : [...current, designerId]);
  }

  async function handleSave() {
    if (!form.name || !form.price_range) { alert("請填寫名稱與價格"); return; }
    setSaving(true);
    const payload = { ...form, duration: form.duration || null };
    if (editing) {
      const { error } = await supabase.from("price_items").update(payload).eq("id", editing.id);
      if (error) {
        alert(`儲存失敗：${error.message}`);
        setSaving(false);
        return;
      }
      const nextCategories = mergeCategoryOrder(categoryOrder, [...new Set(items.map(p => p.id === editing.id ? form.category : p.category))].filter(Boolean));
      const updatedPrice = { ...editing, ...payload };
      setCategoryOrder(nextCategories);
      setItems(sortPriceItems(items.map(p => p.id === editing.id ? updatedPrice : p), nextCategories));
      await syncPriceToDesigners(updatedPrice);
    } else {
      const nextSortOrder = items.filter((item) => item.category === form.category).reduce((max, item) => Math.max(max, item.sort_order || 0), 0) + 1;
      const { data, error } = await supabase.from("price_items").insert({ ...payload, sort_order: nextSortOrder }).select().single();
      if (error) {
        alert(`新增失敗：${error.message}`);
        setSaving(false);
        return;
      }
      if (data) {
        const nextCategories = mergeCategoryOrder(categoryOrder, [...new Set([...items.map((item) => item.category), data.category])].filter(Boolean));
        setCategoryOrder(nextCategories);
        setItems(sortPriceItems([...items, data], nextCategories));
        await syncPriceToDesigners(data);
      }
    }
    setSaving(false);
    setShowForm(false);
  }

  async function syncPriceToDesigners(priceItem: PriceItem) {
    const targetDesignerIds = syncDesignerIds;
    if (targetDesignerIds.length === 0) return;

    const { data: existingRows, error: findError } = await supabase
      .from("designer_price_items")
      .select("designer_id")
      .eq("price_item_id", priceItem.id)
      .in("designer_id", targetDesignerIds);
    if (findError) {
      alert(`公版已儲存，但讀取設計師專屬價目失敗：${findError.message}`);
      return;
    }

    const syncPayload = {
      category: priceItem.category,
      name: priceItem.name,
      price_range: priceItem.price_range,
      duration: priceItem.duration || null,
      sort_order: priceItem.sort_order || 0,
      updated_at: new Date().toISOString(),
    };
    const existingDesignerIds = new Set((existingRows || []).map((row) => Number(row.designer_id)));
    const { error: updateError } = await supabase
      .from("designer_price_items")
      .update(syncPayload)
      .eq("price_item_id", priceItem.id)
      .in("designer_id", targetDesignerIds);
    if (updateError) {
      alert(`公版已儲存，但同步更新設計師專屬價目失敗：${updateError.message}`);
      return;
    }

    const missingDesignerIds = targetDesignerIds.filter((designerId) => !existingDesignerIds.has(designerId));
    if (missingDesignerIds.length === 0) return;
    const { error: insertError } = await supabase.from("designer_price_items").insert(
      missingDesignerIds.map((designerId) => ({
        designer_id: designerId,
        price_item_id: priceItem.id,
        ...syncPayload,
        is_active: true,
      }))
    );
    if (insertError) {
      alert(`公版已儲存，但同步新增設計師專屬價目失敗：${insertError.message}`);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("確定刪除這筆價格？")) return;
    await supabase.from("price_items").delete().eq("id", id);
    setItems(items.filter(p => p.id !== id));
  }

  async function reorderPriceItem(target: PriceItem) {
    if (!draggingPriceId || draggingPriceId === target.id) return;
    const dragged = items.find((item) => item.id === draggingPriceId);
    if (!dragged || dragged.category !== target.category) {
      setDraggingPriceId(null);
      return;
    }

    const categoryItems = sortPriceItems(items.filter((item) => item.category === target.category), categoryOrder);
    const fromIndex = categoryItems.findIndex((item) => item.id === dragged.id);
    const toIndex = categoryItems.findIndex((item) => item.id === target.id);
    if (fromIndex < 0 || toIndex < 0) return;

    const reordered = [...categoryItems];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const nextCategoryItems = reordered.map((item, index) => ({ ...item, sort_order: index + 1 }));
    const nextItems = sortPriceItems(items.map((item) => nextCategoryItems.find((next) => next.id === item.id) || item), categoryOrder);
    setItems(nextItems);
    setDraggingPriceId(null);

    const results = await Promise.all(nextCategoryItems.map((item) => supabase.from("price_items").update({ sort_order: item.sort_order }).eq("id", item.id)));
    if (results.some(({ error }) => error)) {
      alert("排序更新失敗，請再試一次");
      fetchData();
    }
  }

  async function saveCategoryOrder(nextOrder: string[]) {
    const { data: existing } = await supabase.from("shop_info").select("id").eq("key", publicCategoryOrderKey).maybeSingle();
    if (existing?.id) {
      return supabase.from("shop_info").update({ value: JSON.stringify(nextOrder), is_active: true }).eq("id", existing.id);
    }
    return supabase.from("shop_info").insert({ key: publicCategoryOrderKey, label: "價目表大項目排序", value: JSON.stringify(nextOrder), sort_order: 20, is_active: true });
  }

  async function reorderCategory(targetCategory: string) {
    if (!draggingCategory || draggingCategory === targetCategory) return;
    const fromIndex = categories.indexOf(draggingCategory);
    const toIndex = categories.indexOf(targetCategory);
    if (fromIndex < 0 || toIndex < 0) return;

    const nextOrder = [...categories];
    const [moved] = nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, moved);
    setCategoryOrder(nextOrder);
    setItems(sortPriceItems(items, nextOrder));
    setDraggingCategory(null);

    const { error } = await saveCategoryOrder(nextOrder);
    if (error) {
      alert("大項目排序更新失敗，請再試一次");
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
      <div className="admin-topbar" style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => router.push("/admin/dashboard")} style={{ background: "#2C2C2A", color: "#fff", border: "1px solid #5F5E5A", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>← 返回</button>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>店公版價目表</div>
        </div>
      </div>

      <div style={{ padding: "12px 16px 0" }}>
        <div style={{ background: "#fff", border: "0.5px solid #D3D1C7", borderRadius: 14, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#2C2C2A" }}>髮長說明圖</div>
              <div style={{ fontSize: 11, color: "#888780", marginTop: 3 }}>此圖片會同步顯示於顧客預約端的服務選擇頁。</div>
            </div>
            <label style={{ padding: "6px 12px", background: "#F8F7F3", color: "#5F5E5A", border: "1px solid #D3D1C7", borderRadius: 8, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
              {hairLengthDraft ? "變更圖片" : "選擇圖片"}
              <input type="file" accept="image/*" onChange={(event) => { handleHairLengthFile(event.target.files?.[0]); event.currentTarget.value = ""; }} style={{ display: "none" }} />
            </label>
          </div>
          <div style={{ maxWidth: 220 }}>
            <img src={hairLengthDraft || "/hair-length.png"} alt="髮長說明圖預覽" style={{ width: "100%", borderRadius: 10, border: "1px solid #E8E5D8", background: "#F8F7F3" }} />
          </div>
        </div>

        {/* 分類篩選 */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
          <button onClick={() => setFilterCategory("all")} style={{ padding: "5px 12px", borderRadius: 20, border: "none", background: filterCategory === "all" ? "#534AB7" : "#fff", color: filterCategory === "all" ? "#fff" : "#5F5E5A", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>全部</button>
          {categories.map(cat => (
            <button
              key={cat}
              draggable
              onDragStart={() => setDraggingCategory(cat)}
              onDragEnd={() => setDraggingCategory(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => reorderCategory(cat)}
              onClick={() => setFilterCategory(cat)}
              title="拖曳調整大項目排序"
              style={{ padding: "5px 10px 5px 12px", borderRadius: 20, border: "none", background: filterCategory === cat ? "#534AB7" : draggingCategory === cat ? "#F8F7F3" : "#fff", color: filterCategory === cat ? "#fff" : "#5F5E5A", fontSize: 11, cursor: "grab", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {cat}<span style={{ fontSize: 12, opacity: 0.75 }}>☰</span>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#2C2C2A" }}>價目表</div>
          <button onClick={openNew} style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>＋ 新增</button>
        </div>

        {isDesktop ? (
          <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #D3D1C7", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F1EFE8" }}>
                  {["分類", "項目名稱", "價格", "時長", "操作"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", fontSize: 12, color: "#888780", fontWeight: 600, textAlign: "left", borderBottom: "0.5px solid #D3D1C7" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} onDragOver={(event) => event.preventDefault()} onDrop={() => reorderPriceItem(p)} style={{ borderBottom: "0.5px solid #F1EFE8", background: draggingPriceId === p.id ? "#F8F7F3" : "#fff" }}>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "#888780" }}>{p.category}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#2C2C2A" }}>{p.name}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#534AB7", fontWeight: 500 }}>{p.price_range}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: p.duration ? "#2C2C2A" : "#888780", fontWeight: p.duration ? 600 : 400 }}>{formatDurationLabel(p.duration)}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <button onClick={() => openEdit(p)} style={{ padding: "3px 8px", background: "#EEEDFE", color: "#534AB7", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>編輯</button>
                        <button onClick={() => handleDelete(p.id)} style={{ padding: "3px 8px", background: "#FCEBEB", color: "#A32D2D", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>刪除</button>
                        <button
                          draggable
                          onDragStart={() => setDraggingPriceId(p.id)}
                          onDragEnd={() => setDraggingPriceId(null)}
                          title="拖曳調整排序"
                          style={{ width: 28, height: 28, background: "#F8F7F3", color: "#888780", border: "1px solid #D3D1C7", borderRadius: 6, fontSize: 15, lineHeight: 1, cursor: "grab" }}
                        >
                          ☰
                        </button>
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
                <div key={p.id} onDragOver={(event) => event.preventDefault()} onDrop={() => reorderPriceItem(p)} style={{ background: draggingPriceId === p.id ? "#F8F7F3" : "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 6, border: "0.5px solid #D3D1C7" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#2C2C2A" }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: "#534AB7", marginTop: 2 }}>{p.price_range}</div>
                      <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>時長：{formatDurationLabel(p.duration)}</div>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button onClick={() => openEdit(p)} style={{ padding: "3px 8px", background: "#EEEDFE", color: "#534AB7", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>編輯</button>
                      <button onClick={() => handleDelete(p.id)} style={{ padding: "3px 8px", background: "#FCEBEB", color: "#A32D2D", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>刪除</button>
                      <button draggable onDragStart={() => setDraggingPriceId(p.id)} onDragEnd={() => setDraggingPriceId(null)} title="拖曳調整排序" style={{ width: 28, height: 24, background: "#F8F7F3", color: "#888780", border: "1px solid #D3D1C7", borderRadius: 6, fontSize: 15, lineHeight: 1, cursor: "grab" }}>☰</button>
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center", overflowY: "auto", paddingTop: 24 }}>
          <div style={{ width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto", background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px 16px 32px", boxSizing: "border-box" }}>
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
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>預設時長</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
                <input
                  value={parseDurationMinutes(form.duration) || ""}
                  onChange={(e) => setForm({ ...form, duration: e.target.value ? formatDuration(Number(e.target.value) || 0) : "" })}
                  type="number"
                  min={0}
                  step={15}
                  placeholder="輸入分鐘"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 15, outline: "none", boxSizing: "border-box" }}
                />
                <div style={{ minWidth: 92, padding: "10px 12px", borderRadius: 8, background: "#F1EFE8", color: "#2C2C2A", fontSize: 13, fontWeight: 700, textAlign: "center" }}>{formatDurationLabel(form.duration)}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {durationPresets.map((minutes) => (
                  <button key={minutes} onClick={() => setForm({ ...form, duration: formatDuration(minutes) })} type="button" style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid #D3D1C7", background: parseDurationMinutes(form.duration) === minutes ? "#534AB7" : "#fff", color: parseDurationMinutes(form.duration) === minutes ? "#fff" : "#5F5E5A", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{formatDuration(minutes)}</button>
                ))}
                <button onClick={() => setForm({ ...form, duration: "" })} type="button" style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid #E7C9C9", background: "#FFF7F7", color: "#A32D2D", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>清除</button>
              </div>
            </div>
            <div style={{ marginBottom: 16, padding: 12, borderRadius: 12, background: "#F8F7F3", border: "1px solid #E8E5D8" }}>
              <button type="button" onClick={() => setSyncExpanded(!syncExpanded)} style={{ width: "100%", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", padding: 0, background: "transparent", border: "none", textAlign: "left", cursor: "pointer" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#5F5E5A", fontWeight: 700 }}>
                    {editing ? "同步本次變更到設計師專屬價目表" : "同步到設計師專屬價目表"}
                  </div>
                  <div style={{ fontSize: 11, color: "#888780", marginTop: 3, lineHeight: 1.5 }}>
                    {syncDesignerIds.length === 0 ? "目前不同步，僅儲存公版價目表。" : syncDesignerIds.length === designers.length ? `已選全部 ${syncDesignerIds.length} 位設計師。` : `已選 ${syncDesignerIds.length} 位設計師。`}
                  </div>
                </div>
                <span style={{ flex: "0 0 auto", padding: "4px 10px", borderRadius: 999, border: "1px solid #D3D1C7", background: "#fff", color: "#534AB7", fontSize: 11, fontWeight: 700 }}>{syncExpanded ? "收合" : "展開"}</span>
              </button>
              {syncExpanded && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginBottom: 8 }}>
                    <button type="button" onClick={() => setSyncDesignerIds(designers.map((designer) => designer.id))} style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #D3D1C7", background: "#fff", color: "#534AB7", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>全選</button>
                    <button type="button" onClick={() => setSyncDesignerIds([])} style={{ padding: "4px 8px", borderRadius: 999, border: "1px solid #E7C9C9", background: "#FFF7F7", color: "#A32D2D", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>清除</button>
                  </div>
                  <div style={{ display: "grid", gap: 6, maxHeight: 220, overflowY: "auto", paddingRight: 2 }}>
                    {designers.map((designer) => {
                      const checked = syncDesignerIds.includes(designer.id);
                      return (
                        <label key={designer.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, border: `1px solid ${checked ? "#BEB8F5" : "#E8E5D8"}`, background: checked ? "#EEEDFE" : "#fff", color: "#2C2C2A", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleSyncDesigner(designer.id)} />
                          <span>{designer.display_name || designer.name || designer.nickname || `設計師 ${designer.id}`}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: "#888780", lineHeight: 1.5, marginTop: 6 }}>
                    {syncDesignerIds.length === 0 ? (editing ? "未勾選時，只更新公版價目表。" : "未勾選時，只新增公版價目表。") : `${editing ? "儲存後會同步分類、名稱、價格、時長；若沒有此項目，會自動補新增。" : "儲存後會同步新增到設計師專屬價目表。"}`}
                  </div>
                </div>
              )}
            </div>
            <button onClick={handleSave} disabled={saving} style={{ width: "100%", padding: "12px 0", background: saving ? "#D3D1C7" : "#534AB7", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: saving ? "default" : "pointer" }}>
              {saving ? "儲存中..." : "儲存"}
            </button>
          </div>
        </div>
      )}

      {showHairLengthConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 16, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#2C2C2A" }}>確認髮長說明圖</div>
              <button onClick={() => { setShowHairLengthConfirm(false); setHairLengthPending(""); }} style={{ background: "#F1EFE8", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer" }}>✕</button>
            </div>
            <img src={hairLengthPending} alt="新髮長說明圖預覽" style={{ width: "100%", borderRadius: 12, border: "1px solid #E8E5D8", background: "#F8F7F3", marginBottom: 14 }} />
            <button onClick={saveHairLengthImage} disabled={savingHairLength} style={{ width: "100%", padding: "12px 0", background: savingHairLength ? "#D3D1C7" : "#534AB7", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: savingHairLength ? "default" : "pointer" }}>
              {savingHairLength ? "儲存中..." : "儲存圖片"}
            </button>
          </div>
        </div>
      )}

      <AdminBottomNav current="prices" />
    </div>
  );
}
