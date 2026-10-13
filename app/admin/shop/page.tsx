"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminBottomNav from "../components/BottomNav";

type ShopInfo = { id: number; key: string; label: string; value: string; sort_order: number; is_active: boolean };

function isInternalSetting(key: string) {
  return key === "price_category_order"
    || key.startsWith("designer_price_category_order_")
    || key.startsWith("designer_contract_")
    || key.startsWith("admin_role_")
    || key.startsWith("admin_permissions_")
    || key.startsWith("monthly_settlement_");
}

export default function AdminShop() {
  const router = useRouter();
  const [items, setItems] = useState<ShopInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [edited, setEdited] = useState<Record<number, string>>({});
  const [hairLengthPending, setHairLengthPending] = useState<{ item: ShopInfo; image: string } | null>(null);
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

  async function handleSaveAll() {
    const changes = Object.entries(edited);
    if (changes.length === 0 || savingAll) return;
    setSavingAll(true);
    const results = await Promise.all(changes.map(([id, value]) => supabase.from("shop_info").update({ value }).eq("id", Number(id))));
    const failed = results.find((result) => result.error)?.error;
    if (failed) {
      alert(`儲存失敗：${failed.message}`);
    } else {
      setItems((current) => current.map((item) => edited[item.id] !== undefined ? { ...item, value: edited[item.id] } : item));
      setEdited({});
    }
    setSavingAll(false);
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

  function handleImageFile(item: ShopInfo, file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setHairLengthPending({ item, image: reader.result });
      }
    };
    reader.readAsDataURL(file);
  }

  async function saveHairLengthImage() {
    if (!hairLengthPending) return;
    setSaving(hairLengthPending.item.id);
    const { item, image } = hairLengthPending;
    await supabase.from("shop_info").update({ value: image, is_active: true }).eq("id", item.id);
    setItems(items.map(i => i.id === item.id ? { ...i, value: image, is_active: true } : i));
    setEdited((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
    setHairLengthPending(null);
    setSaving(null);
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#534AB7", fontSize: 14 }}>載入中...</div>
    </div>
  );

  const visibleItems = items.filter((item) => !isInternalSetting(item.key));
  const sectionDefinitions = [
    { title: "基本與聯絡資訊", description: "顧客可見的店名、地址與聯絡方式", keys: ["name", "address", "phone", "maps_url", "website"] },
    { title: "社群與外部連結", description: "官方社群、LINE 與其他對外連結", keys: ["line", "line_url", "facebook", "ig", "instagram", "threads", "youtube"] },
    { title: "營業時間與預約須知", description: "顧客端顯示的營業時間、提醒文字與說明圖片", keys: ["hours_weekday", "hours_closed", "business_hours", "notice_1", "notice_2", "notice_3", "notice_4", "booking_notice", "hair_length_image_url"] },
  ];
  const assignedKeys = new Set(sectionDefinitions.flatMap((section) => section.keys));
  const sections = [
    ...sectionDefinitions.map((section) => ({ ...section, items: visibleItems.filter((item) => section.keys.includes(item.key)) })),
    { title: "其他店家資訊", description: "自行新增並供顧客端使用的欄位", keys: [], items: visibleItems.filter((item) => !assignedKeys.has(item.key)) },
  ].filter((section) => section.items.length > 0);
  const dirtyCount = Object.keys(edited).length;

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", paddingBottom: 70, paddingLeft: isDesktop ? 220 : 0 }}>
      <div className="admin-topbar" style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => router.push("/admin/dashboard")} style={{ background: "#2C2C2A", color: "#fff", border: "1px solid #5F5E5A", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>← 返回</button>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>店資訊設定</div>
        </div>
      </div>

      <div style={{ padding: isDesktop ? 22 : 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#2C2C2A" }}>店家資訊</div>
            <div style={{ marginTop: 4, fontSize: 12, color: "#888780" }}>集中管理顧客端顯示的店家資料與連結</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowForm(true)} style={{ background: "#fff", color: "#534AB7", border: "1px solid #CFC8F5", borderRadius: 10, padding: "9px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>＋ 新增欄位</button>
            <button onClick={handleSaveAll} disabled={dirtyCount === 0 || savingAll} style={{ background: dirtyCount === 0 ? "#D8D5CD" : "#534AB7", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 12, fontWeight: 800, cursor: dirtyCount === 0 ? "default" : "pointer" }}>{savingAll ? "儲存中..." : dirtyCount > 0 ? `儲存變更（${dirtyCount}）` : "已全部儲存"}</button>
          </div>
        </div>

        <div style={{ background: "#EAF7F2", border: "1px solid #BDE7D7", borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#17634A" }}>
          儲存後會同步更新顧客端；「已隱藏」欄位不會對外顯示。
        </div>

        <div style={{ background: "#F7F5EE", border: "1px solid #DDD9D0", borderRadius: 12, padding: "10px 14px", marginBottom: 18, fontSize: 11, color: "#77736A" }}>
          設計師合約與月結請至「人員管理」維護；價目排序與後台權限也由各自的管理頁設定。
        </div>

        {sections.map((section) => <section key={section.title} style={{ marginBottom: 18 }}>
          <div style={{ marginBottom: 9 }}><div style={{ fontSize: 15, fontWeight: 900, color: "#2C2C2A" }}>{section.title}</div><div style={{ marginTop: 2, fontSize: 11, color: "#888780" }}>{section.description}</div></div>
          <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(2, minmax(0, 1fr))" : "1fr", gap: 10 }}>
          {section.items.map((item) => (
          <div key={item.id} style={{ background: item.is_active ? "#fff" : "#F7F6F2", borderRadius: 14, padding: "14px", border: `1px solid ${edited[item.id] !== undefined ? "#AFA7F2" : "#DDD9D0"}`, opacity: item.is_active ? 1 : 0.72, boxShadow: edited[item.id] !== undefined ? "0 0 0 2px rgba(83,74,183,.08)" : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#2C2C2A" }}>{item.label}</span>
                <span style={{ display: "block", marginTop: 2, fontSize: 9, color: "#AAA49B" }}>{item.key}</span>
              </div>
              <button onClick={() => toggleActive(item)} style={{ padding: "5px 9px", background: item.is_active ? "#E1F5EE" : "#EEECE6", color: item.is_active ? "#085041" : "#77736A", border: "none", borderRadius: 999, fontSize: 10, fontWeight: 800, cursor: "pointer" }}>
                {item.is_active ? "顯示中" : "已隱藏"}
              </button>
            </div>
            {item.key === "hair_length_image_url" && (
              <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "180px 1fr" : "1fr", gap: 12, marginBottom: 10 }}>
                <img
                  src={item.value || "/hair-length.png"}
                  alt="髮長說明圖預覽"
                  style={{ width: "100%", borderRadius: 10, border: "1px solid #E8E5D8", background: "#F8F6EF" }}
                />
                <label style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "fit-content", height: "fit-content", padding: "8px 14px", background: "#F1EFE8", color: "#2C2C2A", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {item.value ? "變更圖片" : "選擇圖片"}
                  <input type="file" accept="image/*" onChange={(e) => { handleImageFile(item, e.target.files?.[0]); e.currentTarget.value = ""; }} style={{ display: "none" }} />
                </label>
              </div>
            )}
            {item.key !== "hair_length_image_url" && (
              <div>
                <input
                  value={edited[item.id] ?? item.value}
                  onChange={(e) => setEdited({ ...edited, [item.id]: e.target.value })}
                  style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 9, border: `1px solid ${edited[item.id] !== undefined ? "#8D85DD" : "#D3D1C7"}`, fontSize: 13, outline: "none", background: item.is_active ? "#fff" : "#F1EFE8" }}
                />
              </div>
            )}
          </div>
          ))}
          </div>
        </section>)}
      </div>

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px 16px 32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>新增資訊項目</div>
              <button onClick={() => setShowForm(false)} style={{ background: "#F1EFE8", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer" }}>✕</button>
            </div>
            {([
              { key: "key", label: "識別碼（英文）", placeholder: "facebook" },
              { key: "label", label: "顯示標籤", placeholder: "Facebook" },
              { key: "value", label: "內容值", placeholder: "https://..." },
            ] as { key: keyof typeof form; label: string; placeholder: string }[]).map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>{f.label}</div>
                <input value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
            <button onClick={handleAdd} disabled={formSaving} style={{ width: "100%", padding: "12px 0", background: formSaving ? "#D3D1C7" : "#534AB7", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: formSaving ? "default" : "pointer" }}>
              {formSaving ? "新增中..." : "新增"}
            </button>
          </div>
        </div>
      )}

      {hairLengthPending && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 16, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#2C2C2A" }}>確認髮長說明圖</div>
              <button onClick={() => setHairLengthPending(null)} style={{ background: "#F1EFE8", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer" }}>✕</button>
            </div>
            <img src={hairLengthPending.image} alt="新髮長說明圖預覽" style={{ width: "100%", borderRadius: 12, border: "1px solid #E8E5D8", background: "#F8F7F3", marginBottom: 14 }} />
            <button onClick={saveHairLengthImage} disabled={saving === hairLengthPending.item.id} style={{ width: "100%", padding: "12px 0", background: saving === hairLengthPending.item.id ? "#D3D1C7" : "#534AB7", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: saving === hairLengthPending.item.id ? "default" : "pointer" }}>
              {saving === hairLengthPending.item.id ? "儲存中..." : "儲存圖片"}
            </button>
          </div>
        </div>
      )}

      <AdminBottomNav current="shop" />
    </div>
  );
}
