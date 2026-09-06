"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminBottomNav from "../components/BottomNav";

type Designer = { id: number; name: string; display_name?: string; nickname?: string };
type PriceItem = { id: number; category: string; name: string; price_range: string; sort_order: number };
type ShopInfo = { id: number; key: string; label: string; value: string; is_active: boolean };
type DesignerPriceItem = PriceItem & {
  designer_id: number;
  price_item_id: number | null;
  is_active: boolean;
};

const publicCategoryOrderKey = "price_category_order";
const hairLengthImageKey = "hair_length_image_url";

function designerCategoryOrderKey(designerId: number) {
  return `designer_price_category_order_${designerId}`;
}

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

function sortPriceItems<T extends PriceItem>(list: T[], categoryOrder: string[] = []) {
  return [...list].sort((a, b) => {
    const aCategoryIndex = categoryOrder.indexOf(a.category);
    const bCategoryIndex = categoryOrder.indexOf(b.category);
    const categorySort = (aCategoryIndex === -1 ? Number.MAX_SAFE_INTEGER : aCategoryIndex) - (bCategoryIndex === -1 ? Number.MAX_SAFE_INTEGER : bCategoryIndex);
    return categorySort || a.category.localeCompare(b.category) || (a.sort_order || a.id) - (b.sort_order || b.id);
  });
}

export default function AdminDesignerPrices() {
  const router = useRouter();
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [baseItems, setBaseItems] = useState<PriceItem[]>([]);
  const [items, setItems] = useState<DesignerPriceItem[]>([]);
  const [draggingPriceId, setDraggingPriceId] = useState<number | null>(null);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [draggingCategory, setDraggingCategory] = useState<string | null>(null);
  const [hairLengthImage, setHairLengthImage] = useState<ShopInfo | null>(null);
  const [hairLengthDraft, setHairLengthDraft] = useState("");
  const [savingHairLength, setSavingHairLength] = useState(false);
  const [selectedDesignerId, setSelectedDesignerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DesignerPriceItem | null>(null);
  const [filterCategory, setFilterCategory] = useState("all");
  const [form, setForm] = useState({ category: "", name: "", price_range: "", sort_order: 0, is_active: true });
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

    async function fetchInitialData() {
      const params = new URLSearchParams(window.location.search);
      const designerIdFromUrl = Number(params.get("designerId") || 0);
      const [{ data: designerData }, { data: priceData }, { data: hairLengthSetting }] = await Promise.all([
        supabase.from("designers").select("id, name, display_name, nickname").order("sort_order", { nullsFirst: false }).order("id"),
        supabase.from("price_items").select("*").order("category").order("sort_order"),
        supabase.from("shop_info").select("id, key, label, value, is_active").eq("key", hairLengthImageKey).maybeSingle(),
      ]);
      const loadedDesigners = designerData || [];
      setDesigners(loadedDesigners);
      const publicCategories = [...new Set((priceData || []).map((p) => p.category))].filter(Boolean);
      setBaseItems(sortPriceItems(priceData || [], publicCategories));
      if (hairLengthSetting) {
        setHairLengthImage(hairLengthSetting);
        setHairLengthDraft(hairLengthSetting.value || "");
      }
      setSelectedDesignerId(designerIdFromUrl || loadedDesigners[0]?.id || null);
      setLoading(false);
    }

    fetchInitialData();
  }, [router]);

  useEffect(() => {
    if (!selectedDesignerId) return;
    fetchDesignerPrices(selectedDesignerId);
  }, [selectedDesignerId]);

  async function fetchDesignerPrices(designerId: number) {
    const [{ data }, { data: designerCategorySetting }, { data: publicCategorySetting }] = await Promise.all([
      supabase
        .from("designer_price_items")
        .select("*")
        .eq("designer_id", designerId)
        .order("category")
        .order("sort_order"),
      supabase.from("shop_info").select("id, value").eq("key", designerCategoryOrderKey(designerId)).maybeSingle(),
      supabase.from("shop_info").select("id, value").eq("key", publicCategoryOrderKey).maybeSingle(),
    ]);
    const currentCategories = [...new Set((data || []).map((p) => p.category))].filter(Boolean);
    const nextCategoryOrder = mergeCategoryOrder(readCategoryOrder(designerCategorySetting?.value || publicCategorySetting?.value), currentCategories);
    setCategoryOrder(nextCategoryOrder);
    setItems(sortPriceItems(data || [], nextCategoryOrder));
  }

  function handleHairLengthFile(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setHairLengthDraft(reader.result);
    };
    reader.readAsDataURL(file);
  }

  async function saveHairLengthImage() {
    if (!hairLengthDraft.trim()) {
      alert("請先選擇圖片或貼上圖片網址");
      return;
    }
    setSavingHairLength(true);
    if (hairLengthImage?.id) {
      const { data, error } = await supabase
        .from("shop_info")
        .update({ label: "髮長說明圖", value: hairLengthDraft, is_active: true })
        .eq("id", hairLengthImage.id)
        .select("id, key, label, value, is_active")
        .single();
      if (error) alert("髮長說明圖儲存失敗，請再試一次");
      if (data) setHairLengthImage(data);
    } else {
      const { data, error } = await supabase
        .from("shop_info")
        .insert({ key: hairLengthImageKey, label: "髮長說明圖", value: hairLengthDraft, sort_order: 13, is_active: true })
        .select("id, key, label, value, is_active")
        .single();
      if (error) alert("髮長說明圖儲存失敗，請再試一次");
      if (data) setHairLengthImage(data);
    }
    setSavingHairLength(false);
  }

  const selectedDesigner = designers.find((d) => d.id === selectedDesignerId);
  const visibleCategories = mergeCategoryOrder(categoryOrder, [...new Set(items.map((p) => p.category))].filter(Boolean));
  const allCategories = mergeCategoryOrder(categoryOrder, [...new Set([...baseItems.map((p) => p.category), ...items.map((p) => p.category)])].filter(Boolean));
  const filtered = filterCategory === "all" ? sortPriceItems(items, visibleCategories) : sortPriceItems(items.filter((p) => p.category === filterCategory), visibleCategories);

  function openNew() {
    setEditing(null);
    const defaultCategory = allCategories[0] || "";
    const nextSortOrder = items.filter((item) => item.category === defaultCategory).reduce((max, item) => Math.max(max, item.sort_order || 0), 0) + 1;
    setForm({ category: defaultCategory, name: "", price_range: "", sort_order: nextSortOrder, is_active: true });
    setShowForm(true);
  }

  function openEdit(item: DesignerPriceItem) {
    setEditing(item);
    setForm({
      category: item.category,
      name: item.name,
      price_range: item.price_range,
      sort_order: item.sort_order || 0,
      is_active: item.is_active,
    });
    setShowForm(true);
  }

  async function copyBasePrices() {
    if (!selectedDesignerId) return;
    if (items.length > 0 && !confirm("這會用店公版重新建立此設計師價目表，現有專屬項目會被覆蓋。確定繼續？")) return;
    setSaving(true);
    await supabase.from("designer_price_items").delete().eq("designer_id", selectedDesignerId);
    if (baseItems.length > 0) {
      await supabase.from("designer_price_items").insert(
        baseItems.map((item) => ({
          designer_id: selectedDesignerId,
          price_item_id: item.id,
          category: item.category,
          name: item.name,
          price_range: item.price_range,
          sort_order: item.sort_order || 0,
          is_active: true,
        }))
      );
    }
    await fetchDesignerPrices(selectedDesignerId);
    setSaving(false);
  }

  async function handleSave() {
    if (!selectedDesignerId || !form.category || !form.name || !form.price_range) {
      alert("請填寫分類、名稱與價格");
      return;
    }
    setSaving(true);
    const nextSortOrder = editing ? form.sort_order || 0 : items.filter((item) => item.category === form.category).reduce((max, item) => Math.max(max, item.sort_order || 0), 0) + 1;
    const payload = {
      designer_id: selectedDesignerId,
      category: form.category,
      name: form.name,
      price_range: form.price_range,
      sort_order: nextSortOrder,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      await supabase.from("designer_price_items").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("designer_price_items").insert({ ...payload, price_item_id: null });
    }
    await fetchDesignerPrices(selectedDesignerId);
    setSaving(false);
    setShowForm(false);
  }

  async function toggleActive(item: DesignerPriceItem) {
    await supabase.from("designer_price_items").update({ is_active: !item.is_active, updated_at: new Date().toISOString() }).eq("id", item.id);
    setItems(items.map((p) => p.id === item.id ? { ...p, is_active: !p.is_active } : p));
  }

  async function handleDelete(item: DesignerPriceItem) {
    if (!confirm("確定刪除這筆專屬價格？")) return;
    await supabase.from("designer_price_items").delete().eq("id", item.id);
    setItems(items.filter((p) => p.id !== item.id));
  }

  async function reorderPriceItem(target: DesignerPriceItem) {
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
    setItems(sortPriceItems(items.map((item) => nextCategoryItems.find((next) => next.id === item.id) || item), categoryOrder));
    setDraggingPriceId(null);

    const results = await Promise.all(nextCategoryItems.map((item) => (
      supabase.from("designer_price_items").update({ sort_order: item.sort_order, updated_at: new Date().toISOString() }).eq("id", item.id)
    )));

    if (results.some(({ error }) => error)) {
      alert("排序更新失敗，請再試一次");
      if (selectedDesignerId) fetchDesignerPrices(selectedDesignerId);
    }
  }

  async function saveCategoryOrder(nextOrder: string[]) {
    if (!selectedDesignerId) return { error: new Error("No designer selected") };
    const key = designerCategoryOrderKey(selectedDesignerId);
    const { data: existing } = await supabase.from("shop_info").select("id").eq("key", key).maybeSingle();
    if (existing?.id) {
      return supabase.from("shop_info").update({ value: JSON.stringify(nextOrder), is_active: true }).eq("id", existing.id);
    }
    return supabase.from("shop_info").insert({ key, label: `${selectedDesigner?.display_name || selectedDesigner?.name || "設計師"}價目表大項目排序`, value: JSON.stringify(nextOrder), sort_order: 21, is_active: true });
  }

  async function reorderCategory(targetCategory: string) {
    if (!draggingCategory || draggingCategory === targetCategory) return;
    const fromIndex = visibleCategories.indexOf(draggingCategory);
    const toIndex = visibleCategories.indexOf(targetCategory);
    if (fromIndex < 0 || toIndex < 0) return;

    const nextOrder = [...visibleCategories];
    const [moved] = nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, moved);
    setCategoryOrder(nextOrder);
    setItems(sortPriceItems(items, nextOrder));
    setDraggingCategory(null);

    const { error } = await saveCategoryOrder(nextOrder);
    if (error) {
      alert("大項目排序更新失敗，請再試一次");
      if (selectedDesignerId) fetchDesignerPrices(selectedDesignerId);
    }
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#534AB7", fontSize: 14 }}>載入中...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", paddingBottom: 70, paddingLeft: isDesktop ? 220 : 0 }}>
      <div style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>設計師專屬價目表</div>
          <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>{selectedDesigner?.display_name || selectedDesigner?.name || "請選擇設計師"}</div>
        </div>
        <button onClick={openNew} disabled={!selectedDesignerId} style={{ background: selectedDesignerId ? "#534AB7" : "#5F5E5A", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: selectedDesignerId ? "pointer" : "default" }}>＋ 新增</button>
      </div>

      <div style={{ padding: "12px 16px 0" }}>
        <div style={{ background: "#fff", border: "0.5px solid #D3D1C7", borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#888780", marginBottom: 6 }}>選擇設計師</div>
          <select value={selectedDesignerId || ""} onChange={(e) => setSelectedDesignerId(Number(e.target.value))} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, background: "#fff", color: "#2C2C2A" }}>
            {designers.map((designer) => (
              <option key={designer.id} value={designer.id}>
                {designer.display_name || designer.name}{designer.nickname ? `（${designer.nickname}）` : ""}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button onClick={copyBasePrices} disabled={!selectedDesignerId || saving} style={{ background: "#EEEDFE", color: "#534AB7", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12, cursor: selectedDesignerId && !saving ? "pointer" : "default" }}>複製店公版</button>
            <button onClick={() => router.push("/admin/prices")} style={{ background: "#F8F7F3", color: "#5F5E5A", border: "1px solid #D3D1C7", borderRadius: 8, padding: "7px 12px", fontSize: 12, cursor: "pointer" }}>編輯店公版</button>
          </div>
        </div>

        <div style={{ background: "#fff", border: "0.5px solid #D3D1C7", borderRadius: 14, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#2C2C2A" }}>髮長說明圖</div>
              <div style={{ fontSize: 11, color: "#888780", marginTop: 3 }}>此圖片會同步顯示於顧客預約端的服務選擇頁。</div>
            </div>
            <label style={{ padding: "6px 12px", background: "#F8F7F3", color: "#5F5E5A", border: "1px solid #D3D1C7", borderRadius: 8, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
              選擇圖片
              <input type="file" accept="image/*" onChange={(event) => handleHairLengthFile(event.target.files?.[0])} style={{ display: "none" }} />
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "180px 1fr auto" : "1fr", gap: 10, alignItems: "center" }}>
            <img src={hairLengthDraft || "/hair-length.png"} alt="髮長說明圖預覽" style={{ width: "100%", borderRadius: 10, border: "1px solid #E8E5D8", background: "#F8F7F3" }} />
            <textarea
              value={hairLengthDraft}
              onChange={(event) => setHairLengthDraft(event.target.value)}
              rows={isDesktop ? 3 : 2}
              placeholder="可貼圖片網址，或直接選擇圖片"
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box" }}
            />
            <button onClick={saveHairLengthImage} disabled={savingHairLength} style={{ padding: "9px 16px", background: savingHairLength ? "#D3D1C7" : "#534AB7", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: savingHairLength ? "default" : "pointer", whiteSpace: "nowrap" }}>
              {savingHairLength ? "儲存中..." : "儲存圖片"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
          <button onClick={() => setFilterCategory("all")} style={{ padding: "5px 12px", borderRadius: 20, border: "none", background: filterCategory === "all" ? "#534AB7" : "#fff", color: filterCategory === "all" ? "#fff" : "#5F5E5A", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>全部</button>
          {visibleCategories.map((cat) => (
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

        {items.length === 0 ? (
          <div style={{ background: "#fff", border: "0.5px solid #D3D1C7", borderRadius: 12, padding: "28px 16px", textAlign: "center", color: "#888780", fontSize: 13 }}>
            尚未建立專屬價目表，可先複製店公版後再調整。
          </div>
        ) : isDesktop ? (
          <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #D3D1C7", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F1EFE8" }}>
                  {["狀態", "分類", "項目名稱", "價格", "操作"].map((h) => (
                    <th key={h} style={{ padding: "10px 12px", fontSize: 12, color: "#888780", fontWeight: 600, textAlign: "left", borderBottom: "0.5px solid #D3D1C7" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} onDragOver={(event) => event.preventDefault()} onDrop={() => reorderPriceItem(item)} style={{ borderBottom: "0.5px solid #F1EFE8", opacity: item.is_active ? 1 : 0.55, background: draggingPriceId === item.id ? "#F8F7F3" : "#fff" }}>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: item.is_active ? "#085041" : "#A32D2D" }}>{item.is_active ? "顯示" : "隱藏"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "#888780" }}>{item.category}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#2C2C2A" }}>{item.name}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#534AB7", fontWeight: 500 }}>{item.price_range}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <button onClick={() => openEdit(item)} style={{ padding: "3px 8px", background: "#EEEDFE", color: "#534AB7", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>編輯</button>
                        <button onClick={() => toggleActive(item)} style={{ padding: "3px 8px", background: "#FAEEDA", color: "#BA7517", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>{item.is_active ? "隱藏" : "顯示"}</button>
                        <button onClick={() => handleDelete(item)} style={{ padding: "3px 8px", background: "#FCEBEB", color: "#A32D2D", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>刪除</button>
                        <button
                          draggable
                          onDragStart={() => setDraggingPriceId(item.id)}
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
          filtered.map((item) => (
            <div key={item.id} onDragOver={(event) => event.preventDefault()} onDrop={() => reorderPriceItem(item)} style={{ background: draggingPriceId === item.id ? "#F8F7F3" : "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 6, border: "0.5px solid #D3D1C7", opacity: item.is_active ? 1 : 0.55 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "#888780", marginBottom: 2 }}>{item.category} · {item.is_active ? "顯示" : "隱藏"}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#2C2C2A" }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: "#534AB7", marginTop: 2 }}>{item.price_range}</div>
                </div>
                <div style={{ display: "flex", gap: 4, alignItems: "flex-start", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button onClick={() => openEdit(item)} style={{ padding: "3px 8px", background: "#EEEDFE", color: "#534AB7", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>編輯</button>
                  <button onClick={() => toggleActive(item)} style={{ padding: "3px 8px", background: "#FAEEDA", color: "#BA7517", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>{item.is_active ? "隱藏" : "顯示"}</button>
                  <button draggable onDragStart={() => setDraggingPriceId(item.id)} onDragEnd={() => setDraggingPriceId(null)} title="拖曳調整排序" style={{ width: 28, height: 24, background: "#F8F7F3", color: "#888780", border: "1px solid #D3D1C7", borderRadius: 6, fontSize: 15, lineHeight: 1, cursor: "grab" }}>☰</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px 16px 32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{editing ? "編輯專屬價格" : "新增專屬價格"}</div>
              <button onClick={() => setShowForm(false)} style={{ background: "#F1EFE8", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer" }}>x</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>分類 *</div>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="染髮 COLOR" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              {allCategories.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                  {allCategories.map((cat) => (
                    <button key={cat} onClick={() => setForm({ ...form, category: cat })} style={{ padding: "2px 8px", borderRadius: 6, border: "1px solid #D3D1C7", background: form.category === cat ? "#534AB7" : "#fff", color: form.category === cat ? "#fff" : "#5F5E5A", fontSize: 11, cursor: "pointer" }}>{cat}</button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>項目名稱 *</div>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="設計染（單色）" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>價格說明 *</div>
              <input value={form.price_range} onChange={(e) => setForm({ ...form, price_range: e.target.value })} placeholder="$2,200 / $2,500 / $3,000" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: 13, color: "#5F5E5A" }}>
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              顯示在此設計師價目表
            </label>
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
