"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import BottomNav from "../components/BottomNav";

type DesignerSession = { id: number; name: string; nickname: string };
type Booking = { id: number; customer_name: string; customer_phone: string; booking_date: string; booking_time: string };
type Service = { id: number; name: string; category_id: number; default_price: number };
type ServiceCategory = { id: number; label: string; color: string; text_color: string };
type SelectedService = { id: number; name: string; amount: number; original_amount: number; discount: number };
type Material = { name: string; quantity: string; unit: string; cost: string };
type Product = { id: number; name: string; unit: string; unit_price: number; category: string };
type ProductUsageItem = { product: Product; quantity: number };
type Transaction = {
  id: number;
  customer_name: string;
  service_items: SelectedService[];
  total_amount: number;
  note: string;
  created_at: string;
};

export default function DesignerTransaction() {
  const router = useRouter();
  const [designer, setDesigner] = useState<DesignerSession | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [openCategory, setOpenCategory] = useState<number | null>(null);
  const [materials, setMaterials] = useState<Material[]>([{ name: "", quantity: "", unit: "g", cost: "" }]);
  const [productUsage, setProductUsage] = useState<ProductUsageItem[]>([]);
  const [showProducts, setShowProducts] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"new" | "history" | "report">("history");
  const [showPhotoPrompt, setShowPhotoPrompt] = useState(false);
  const [completedCustomerName, setCompletedCustomerName] = useState("");
  const [completedCustomerPhone, setCompletedCustomerPhone] = useState("");
  const [completedNoteId, setCompletedNoteId] = useState<number | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoNote, setPhotoNote] = useState("");
  const [history, setHistory] = useState<Transaction[]>([]);
  const [monthTotal, setMonthTotal] = useState(0);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editServices, setEditServices] = useState<SelectedService[]>([]);
  const [editNote, setEditNote] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  });
  const [chartType, setChartType] = useState<"bar" | "pie">("bar");
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  useEffect(() => {
    const session = sessionStorage.getItem("designerSession");
    if (!session) { router.push("/designer/login"); return; }
    const d = JSON.parse(session);
    setDesigner(d);

    async function fetchData() {
      const today = new Date().toISOString().split("T")[0];
      const [{ data: bData }, { data: tData }, { data: sData }, { data: cData }, { data: pData }] = await Promise.all([
        supabase.from("bookings").select("*").eq("designer_id", d.id).eq("status", "confirmed").gte("booking_date", today).order("booking_date").order("booking_time"),
        supabase.from("transactions").select("*").eq("designer_id", d.id).order("created_at", { ascending: false }),
        supabase.from("services").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("service_categories").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("products").select("*").eq("is_active", true).order("sort_order"),
      ]);
      if (bData) setBookings(bData);
      if (tData) {
        setHistory(tData);
        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
        const monthSum = tData.filter((t: any) => t.created_at >= monthStart).reduce((sum: number, t: any) => sum + (t.total_amount || 0), 0);
        setMonthTotal(monthSum);
      }
      if (sData) setServices(sData);
      if (cData) setCategories(cData);
      if (pData) setProducts(pData);
    }
    fetchData();
  }, [router]);

  function toggleService(svc: Service & { default_price?: number }) {
    const exists = selectedServices.find(s => s.id === svc.id);
    if (exists) setSelectedServices(selectedServices.filter(s => s.id !== svc.id));
    else setSelectedServices([...selectedServices, { id: svc.id, name: svc.name, amount: svc.default_price || 0, original_amount: svc.default_price || 0, discount: 0 }]);
  }

  function updateAmount(id: number, value: string) {
    setSelectedServices(selectedServices.map(s => s.id === id ? { ...s, amount: parseInt(value) || 0 } : s));
  }

  function updateDiscount(id: number, value: string) {
    const discount = parseInt(value) || 0;
    setSelectedServices(selectedServices.map(s => s.id === id ? { ...s, discount, amount: Math.max(0, s.original_amount - discount) } : s));
  }

  function addMaterial() { setMaterials([...materials, { name: "", quantity: "", unit: "g", cost: "" }]); }
  function removeMaterial(i: number) { setMaterials(materials.filter((_, idx) => idx !== i)); }
  function updateMaterial(i: number, field: keyof Material, value: string) {
    setMaterials(materials.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
  }

  function toggleProduct(product: Product) {
    const exists = productUsage.find(p => p.product.id === product.id);
    if (exists) setProductUsage(productUsage.filter(p => p.product.id !== product.id));
    else setProductUsage([...productUsage, { product, quantity: 1 }]);
  }

  function updateProductQty(id: number, qty: number) {
    setProductUsage(productUsage.map(p => p.product.id === id ? { ...p, quantity: qty } : p));
  }

  const totalAmount = selectedServices.reduce((sum, s) => sum + (s.amount || 0), 0);
  const totalMaterialCost = materials.reduce((sum, m) => sum + (parseInt(m.cost) || 0), 0);
  const totalProductCost = productUsage.reduce((sum, p) => sum + (p.product.unit_price * p.quantity), 0);

  async function handleSubmit() {
    if (!designer || selectedServices.length === 0) { alert("請至少選擇一項服務"); return; }
    setSaving(true);
    await supabase.from("transactions").insert({
      booking_id: selectedBooking?.id || null,
      designer_id: designer.id,
      customer_name: selectedBooking?.customer_name || "現場客人",
      service_items: selectedServices,
      total_amount: totalAmount,
      note,
    });
    if (materials.some(m => m.name)) {
      await supabase.from("material_usage").insert(
        materials.filter(m => m.name).map(m => ({
          designer_id: designer.id,
          booking_id: selectedBooking?.id || null,
          material_name: m.name,
          quantity: parseFloat(m.quantity) || 0,
          unit: m.unit,
          cost: parseInt(m.cost) || 0,
          used_at: new Date().toISOString().split("T")[0],
        }))
      );
    }
    if (productUsage.length > 0) {
      await supabase.from("product_usage").insert(
        productUsage.map(pu => ({
          designer_id: designer.id,
          product_id: pu.product.id,
          product_name: pu.product.name,
          quantity: pu.quantity,
          unit_price: pu.product.unit_price,
          total_cost: pu.product.unit_price * pu.quantity,
          used_at: new Date().toISOString().split("T")[0],
        }))
      );
    }
    setSaving(false);
    setSelectedServices([]);
    setMaterials([{ name: "", quantity: "", unit: "g", cost: "" }]);
    setProductUsage([]);
    setNote("");

    // 自動建立或更新顧客備忘
    const customerName = selectedBooking?.customer_name || "現場客人";
    const customerPhone = selectedBooking?.customer_phone || "";
    let noteId: number | null = null;

    if (customerPhone) {
      const { data: existingNote } = await supabase
        .from("customer_notes")
        .select("id")
        .eq("designer_id", designer.id)
        .eq("customer_phone", customerPhone)
        .single();

      if (existingNote) {
        noteId = existingNote.id;
        await supabase.from("customer_notes").update({
          last_visit: new Date().toISOString().split("T")[0],
          updated_at: new Date().toISOString(),
        }).eq("id", existingNote.id);
      } else {
        const { data: newNote } = await supabase.from("customer_notes").insert({
          designer_id: designer.id,
          customer_name: customerName,
          customer_phone: customerPhone,
          last_visit: new Date().toISOString().split("T")[0],
        }).select().single();
        if (newNote) noteId = newNote.id;
      }
    }

    setCompletedCustomerName(customerName);
    setCompletedCustomerPhone(customerPhone);
    setCompletedNoteId(noteId);
    setShowPhotoPrompt(true);
    setSelectedBooking(null);
  }

  // 帳務報表計算
  const yearlyData = (() => {
    const months: Record<string, number> = {};
    for (let m = 1; m <= 12; m++) {
      const key = `${selectedYear}-${String(m).padStart(2,"0")}`;
      months[key] = 0;
    }
    history.forEach((t) => {
      const month = t.created_at?.slice(0, 7);
      if (month && month.startsWith(String(selectedYear))) {
        months[month] = (months[month] || 0) + (t.total_amount || 0);
      }
    });
    return Object.entries(months).sort((a, b) => a[0].localeCompare(b[0]));
  })();

  const yearTotal = yearlyData.reduce((sum, [, v]) => sum + v, 0);
  const maxMonthly = Math.max(...yearlyData.map(([, v]) => v), 1);

  const monthlyData = (() => {
    const months: Record<string, number> = {};
    history.forEach((t) => {
      const month = t.created_at?.slice(0, 7);
      if (month) months[month] = (months[month] || 0) + (t.total_amount || 0);
    });
    return Object.entries(months).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6).reverse();
  })();

  const filteredHistory = history.filter(t => t.created_at?.slice(0, 7) === selectedMonth);
  const filteredTotal = filteredHistory.reduce((sum, t) => sum + (t.total_amount || 0), 0);

  const availableYears = (() => {
    const years = new Set<number>();
    history.forEach(t => {
      const y = parseInt(t.created_at?.slice(0, 4) || "0");
      if (y > 2020) years.add(y);
    });
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  })();

  function openEditTransaction(t: Transaction) {
    setEditingTransaction(t);
    setEditServices(t.service_items || []);
    setEditNote(t.note || "");
  }

  async function handleEditSave() {
    if (!editingTransaction) return;
    setEditSaving(true);
    const newTotal = editServices.reduce((sum, s) => sum + (s.amount || 0), 0);
    await supabase.from("transactions").update({
      service_items: editServices,
      total_amount: newTotal,
      note: editNote,
    }).eq("id", editingTransaction.id);
    setHistory(history.map(t => t.id === editingTransaction.id ? { ...t, service_items: editServices, total_amount: newTotal, note: editNote } : t));
    setEditSaving(false);
    setEditingTransaction(null);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !designer) return;
    setUploadingPhoto(true);
    const canvas = document.createElement("canvas");
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      const maxSize = 1200;
      let w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else { w = Math.round(w * maxSize / h); h = maxSize; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(async (blob) => {
        if (!blob) { setUploadingPhoto(false); return; }
        const folder = completedNoteId ? `${designer.id}/${completedNoteId}` : `${designer.id}/walk-in`;
        const path = `${folder}/${Date.now()}.jpg`;
        const { error } = await supabase.storage.from("customer-photos").upload(path, blob, { contentType: "image/jpeg" });
        if (!error) {
          const { data: { publicUrl } } = supabase.storage.from("customer-photos").getPublicUrl(path);
          await supabase.from("customer_photos").insert({
            designer_id: designer.id,
            customer_note_id: completedNoteId,
            customer_name: completedCustomerName,
            customer_phone: completedCustomerPhone,
            photo_url: publicUrl,
            note: photoNote,
            taken_at: new Date().toISOString().split("T")[0],
          });
        }
        setUploadingPhoto(false);
        setShowPhotoPrompt(false);
        setPhotoNote("");
        setTab("history");
        URL.revokeObjectURL(url);
      }, "image/jpeg", 0.85);
    };
    img.src = url;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", paddingBottom: 70 }}>
      <div style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>帳務</div>
        <div style={{ marginLeft: "auto", background: "#2C2840", borderRadius: 10, padding: "4px 12px" }}>
          <div style={{ fontSize: 10, color: "#888780" }}>本月收入</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#C8C4F8" }}>${monthTotal.toLocaleString()}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, padding: "12px 16px 8px" }}>
        {[{ key: "history", label: "交易紀錄" }, { key: "report", label: "收入報表" }, { key: "new", label: "新增明細" }].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as "new" | "history" | "report")} style={{ flex: 1, padding: "6px 0", borderRadius: 20, border: "none", background: tab === t.key ? "#534AB7" : "#fff", color: tab === t.key ? "#fff" : "#5F5E5A", fontSize: 12, fontWeight: tab === t.key ? 600 : 400, cursor: "pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 16px 32px" }}>
        {tab === "report" && (
          <>
            {/* 年度選擇 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A" }}>年度：</div>
              <div style={{ display: "flex", gap: 6 }}>
                {availableYears.map(y => (
                  <button key={y} onClick={() => setSelectedYear(y)} style={{ padding: "5px 14px", borderRadius: 20, border: "none", background: selectedYear === y ? "#534AB7" : "#fff", color: selectedYear === y ? "#fff" : "#5F5E5A", fontSize: 12, fontWeight: selectedYear === y ? 600 : 400, cursor: "pointer" }}>
                    {y}
                  </button>
                ))}
              </div>
            </div>

            {/* 年度總收入 */}
            <div style={{ background: "#2C2840", borderRadius: 14, padding: "12px 16px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, color: "#888780" }}>{selectedYear} 年度總收入</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#C8C4F8" }}>${yearTotal.toLocaleString()}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "#888780" }}>月均收入</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#C8C4F8" }}>${Math.round(yearTotal / 12).toLocaleString()}</div>
              </div>
            </div>

            {/* 月收入圖表 */}
            <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, border: "0.5px solid #D3D1C7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A" }}>{selectedYear} 各月收入</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {[{ key: "bar", label: "長條" }, { key: "pie", label: "圓餅" }].map((c) => (
                    <button key={c.key} onClick={() => setChartType(c.key as "bar" | "pie")} style={{ padding: "3px 10px", borderRadius: 8, border: "none", background: chartType === c.key ? "#534AB7" : "#F1EFE8", color: chartType === c.key ? "#fff" : "#5F5E5A", fontSize: 11, cursor: "pointer" }}>{c.label}</button>
                  ))}
                </div>
              </div>
              {chartType === "bar" ? (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 120 }}>
                  {yearlyData.map(([month, amount]) => (
                    <div key={month} onClick={() => setSelectedMonth(month)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}>
                      <div style={{ fontSize: 8, color: selectedMonth === month ? "#534AB7" : "#888780", fontWeight: 600 }}>{amount > 0 ? `${(amount/1000).toFixed(0)}k` : ""}</div>
                      <div style={{ width: "100%", background: selectedMonth === month ? "#534AB7" : "#AFA9EC", borderRadius: "4px 4px 0 0", height: `${Math.max((amount / maxMonthly) * 90, 2)}px`, transition: "height 0.3s" }} />
                      <div style={{ fontSize: 8, color: selectedMonth === month ? "#534AB7" : "#888780", fontWeight: selectedMonth === month ? 600 : 400 }}>{month.slice(5)}月</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {yearlyData.filter(([, amount]) => amount > 0).map(([month, amount], i) => {
                    const colors = ["#534AB7","#7B6FD4","#1D9E75","#BA7517","#E24B4A","#0C447C","#085041","#633806"];
                    return (
                      <div key={month} onClick={() => setSelectedMonth(month)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: colors[i % colors.length], flexShrink: 0 }} />
                        <div style={{ fontSize: 11, color: selectedMonth === month ? "#534AB7" : "#5F5E5A", width: 40, fontWeight: selectedMonth === month ? 600 : 400 }}>{month.slice(5)}月</div>
                        <div style={{ flex: 1, height: 16, background: "#F1EFE8", borderRadius: 8, overflow: "hidden" }}>
                          <div style={{ height: "100%", background: colors[i % colors.length], width: `${(amount / maxMonthly) * 100}%`, borderRadius: 8 }} />
                        </div>
                        <div style={{ fontSize: 11, color: colors[i % colors.length], fontWeight: 600, width: 65, textAlign: "right" }}>${amount.toLocaleString()}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 月份選擇明細 */}
            <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, border: "0.5px solid #D3D1C7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A" }}>月份明細</div>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  style={{ padding: "4px 8px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 12, outline: "none" }}
                />
              </div>
              <div style={{ background: "#2C2840", borderRadius: 10, padding: "10px 14px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#888780" }}>{selectedMonth} 總收入</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: "#C8C4F8" }}>${filteredTotal.toLocaleString()}</span>
              </div>
              {filteredHistory.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: "#888780", fontSize: 13 }}>本月尚無交易紀錄</div>
              ) : (
                filteredHistory.map((t) => (
                  <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "0.5px solid #F1EFE8" }}>
                    <div>
                      <div style={{ fontSize: 13, color: "#2C2C2A" }}>{t.customer_name}</div>
                      <div style={{ fontSize: 11, color: "#888780" }}>{t.created_at?.slice(0, 10).replace(/-/g, "/")}</div>
                      {t.service_items && (
                        <div style={{ fontSize: 11, color: "#5F5E5A" }}>{t.service_items.map((s) => s.name).join("、")}</div>
                      )}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#534AB7" }}>${t.total_amount?.toLocaleString()}</div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {tab === "history" && (
          <>
            <div style={{ background: "#2C2840", borderRadius: 14, padding: "14px 16px", marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>本月總收入</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#C8C4F8" }}>${monthTotal.toLocaleString()}</div>
            </div>
            {history.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#888780", fontSize: 14 }}>尚無交易紀錄</div>
            ) : (
              history.map((t) => (
                <div key={t.id} style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 8, border: "0.5px solid #D3D1C7" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#2C2C2A" }}>{t.customer_name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#534AB7" }}>${t.total_amount?.toLocaleString()}</div>
                      <button onClick={() => openEditTransaction(t)} style={{ background: "#EEEDFE", color: "#534AB7", border: "none", borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}>編輯</button>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#888780" }}>{t.created_at?.slice(0, 10).replace(/-/g, "/")}</div>
                  {t.service_items && (
                    <div style={{ fontSize: 11, color: "#5F5E5A", marginTop: 4 }}>
                      {t.service_items.map((s) => `${s.name} $${s.amount}`).join("、")}
                    </div>
                  )}
                  {t.note && <div style={{ fontSize: 11, color: "#888780", marginTop: 4 }}>備註：{t.note}</div>}
                </div>
              ))
            )}
          </>
        )}

        {tab === "new" && (
          <>
            {/* 連結預約 */}
            <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, border: "0.5px solid #D3D1C7" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A", marginBottom: 10 }}>連結預約（選填）</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div onClick={() => setSelectedBooking(null)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${!selectedBooking ? "#534AB7" : "#D3D1C7"}`, background: !selectedBooking ? "#EEEDFE" : "#F1EFE8", cursor: "pointer", fontSize: 12, color: !selectedBooking ? "#534AB7" : "#5F5E5A" }}>
                  現場客人（不綁定預約）
                </div>
                {bookings.map((b) => (
                  <div key={b.id} onClick={() => setSelectedBooking(b)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${selectedBooking?.id === b.id ? "#534AB7" : "#D3D1C7"}`, background: selectedBooking?.id === b.id ? "#EEEDFE" : "#fff", cursor: "pointer" }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#2C2C2A" }}>{b.customer_name}</div>
                    <div style={{ fontSize: 11, color: "#888780" }}>{b.booking_date.replace(/-/g, "/")} {b.booking_time}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 服務項目 */}
            <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, border: "0.5px solid #D3D1C7" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A", marginBottom: 10 }}>選擇服務項目</div>
              {categories.map((cat) => {
                const catServices = services.filter(s => s.category_id === cat.id);
                const isOpen = openCategory === cat.id;
                const pickedCount = catServices.filter(s => selectedServices.find(ss => ss.id === s.id)).length;
                return (
                  <div key={cat.id} style={{ marginBottom: 6 }}>
                    <div onClick={() => setOpenCategory(isOpen ? null : cat.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: pickedCount > 0 ? cat.color : "#F1EFE8", borderRadius: isOpen ? "8px 8px 0 0" : 8, cursor: "pointer", border: `0.5px solid ${pickedCount > 0 ? cat.text_color + "40" : "#D3D1C7"}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: "#2C2C2A" }}>{cat.label}</span>
                        {pickedCount > 0 && <span style={{ fontSize: 10, background: cat.text_color, color: "#fff", borderRadius: 10, padding: "1px 7px" }}>{pickedCount}</span>}
                      </div>
                      <span style={{ fontSize: 11, color: "#888780" }}>{isOpen ? "▲" : "▼"}</span>
                    </div>
                    {isOpen && (
                      <div style={{ border: "0.5px solid #D3D1C7", borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
                        {catServices.map(svc => {
                          const picked = selectedServices.find(s => s.id === svc.id);
                          return (
                            <div key={svc.id}>
                              <div onClick={() => toggleService(svc)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: picked ? cat.color : "#fff", borderTop: "0.5px solid #F1EFE8", cursor: "pointer" }}>
                                <span style={{ fontSize: 12, color: "#2C2C2A" }}>{svc.name}</span>
                                <div style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${picked ? cat.text_color : "#D3D1C7"}`, background: picked ? cat.text_color : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  {picked && <span style={{ color: "#fff", fontSize: 12 }}>✓</span>}
                                </div>
                              </div>
                              {picked && (
                                <div style={{ padding: "6px 12px 10px", background: cat.color }}>
                                  <div style={{ display: "flex", gap: 8 }}>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: 11, color: "#888780", marginBottom: 4 }}>收費金額</div>
                                      <input value={picked.amount || ""} onChange={(e) => updateAmount(svc.id, e.target.value)} placeholder="金額" type="number" style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: 11, color: "#888780", marginBottom: 4 }}>折扣（元）</div>
                                      <input value={picked.discount || ""} onChange={(e) => updateDiscount(svc.id, e.target.value)} placeholder="0" type="number" style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #FAC775", fontSize: 13, outline: "none", boxSizing: "border-box", background: "#FAEEDA" }} />
                                    </div>
                                  </div>
                                  {picked.discount > 0 && (
                                    <div style={{ fontSize: 10, color: "#BA7517", marginTop: 4 }}>原價 ${picked.original_amount} - 折扣 ${picked.discount} = ${picked.amount}</div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {selectedServices.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, padding: "10px 0", borderTop: "0.5px solid #F1EFE8" }}>
                  <span style={{ fontSize: 13, color: "#888780" }}>服務小計</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#534AB7" }}>${totalAmount.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* 自領商品 */}
            <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, border: "0.5px solid #D3D1C7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A" }}>自領商品</div>
                <button onClick={() => setShowProducts(!showProducts)} style={{ fontSize: 11, color: "#534AB7", background: "#EEEDFE", border: "none", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>
                  {showProducts ? "收起 ▲" : "選取商品 ▼"}
                </button>
              </div>
              <div style={{ fontSize: 11, color: "#888780", marginBottom: showProducts ? 10 : 0 }}>自領商品費用將從收入扣除</div>
              {showProducts && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {products.map(p => {
                    const picked = productUsage.find(pu => pu.product.id === p.id);
                    return (
                      <div key={p.id} style={{ border: `1px solid ${picked ? "#534AB7" : "#D3D1C7"}`, borderRadius: 8, overflow: "hidden" }}>
                        <div onClick={() => toggleProduct(p)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: picked ? "#EEEDFE" : "#fff", cursor: "pointer" }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 500, color: "#2C2C2A" }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: "#888780" }}>${p.unit_price.toLocaleString()} / {p.unit}</div>
                          </div>
                          <div style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${picked ? "#534AB7" : "#D3D1C7"}`, background: picked ? "#534AB7" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {picked && <span style={{ color: "#fff", fontSize: 12 }}>✓</span>}
                          </div>
                        </div>
                        {picked && (
                          <div style={{ padding: "6px 12px 10px", background: "#EEEDFE", display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 11, color: "#888780" }}>數量：</span>
                            <button onClick={() => updateProductQty(p.id, Math.max(1, picked.quantity - 1))} style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid #D3D1C7", background: "#fff", cursor: "pointer", fontSize: 14 }}>-</button>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A", minWidth: 20, textAlign: "center" }}>{picked.quantity}</span>
                            <button onClick={() => updateProductQty(p.id, picked.quantity + 1)} style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid #D3D1C7", background: "#fff", cursor: "pointer", fontSize: 14 }}>+</button>
                            <span style={{ fontSize: 12, color: "#534AB7", marginLeft: "auto" }}>小計 ${(p.unit_price * picked.quantity).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {productUsage.length > 0 && (
                <div style={{ marginTop: 10, padding: "8px 0", borderTop: "0.5px solid #F1EFE8" }}>
                  {productUsage.map(pu => (
                    <div key={pu.product.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#5F5E5A", marginBottom: 3 }}>
                      <span>{pu.product.name} x{pu.quantity}</span>
                      <span style={{ color: "#A32D2D" }}>-${(pu.product.unit_price * pu.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: "#A32D2D", marginTop: 6, paddingTop: 6, borderTop: "0.5px solid #F1EFE8" }}>
                    <span>商品扣款</span>
                    <span>-${totalProductCost.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            {/* 自領耗材 */}
            <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, border: "0.5px solid #D3D1C7" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A", marginBottom: 4 }}>自領耗材（選填）</div>
              <div style={{ fontSize: 11, color: "#888780", marginBottom: 10 }}>染膏、雙氧水等耗材</div>
              {materials.map((m, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 4, alignItems: "center" }}>
                    <input value={m.name} onChange={(e) => updateMaterial(i, "name", e.target.value)} placeholder="材料名稱" style={{ flex: 2, padding: "8px 10px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none" }} />
                    <input value={m.quantity} onChange={(e) => updateMaterial(i, "quantity", e.target.value)} placeholder="用量" style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none" }} />
                    <select value={m.unit} onChange={(e) => updateMaterial(i, "unit", e.target.value)} style={{ padding: "8px 6px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 12, outline: "none" }}>
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                      <option value="支">支</option>
                      <option value="個">個</option>
                    </select>
                    {materials.length > 1 && <button onClick={() => removeMaterial(i)} style={{ background: "#FCEBEB", border: "none", borderRadius: 6, width: 28, height: 28, cursor: "pointer", color: "#A32D2D", fontSize: 14 }}>✕</button>}
                  </div>
                  <input value={m.cost} onChange={(e) => updateMaterial(i, "cost", e.target.value)} placeholder="材料成本（元）" type="number" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
              ))}
              <button onClick={addMaterial} style={{ width: "100%", padding: "8px 0", background: "#F1EFE8", border: "0.5px dashed #D3D1C7", borderRadius: 8, fontSize: 12, color: "#5F5E5A", cursor: "pointer" }}>＋ 新增耗材</button>
            </div>

            {/* 備註 */}
            <div style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 14, border: "0.5px solid #D3D1C7" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A", marginBottom: 8 }}>備註（選填）</div>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="特殊記錄..." style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", height: 70, resize: "none", boxSizing: "border-box" }} />
            </div>

            {/* 合計 */}
            <div style={{ background: "#2C2840", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "#888780" }}>服務收入</span>
                <span style={{ fontSize: 13, color: "#C8C4F8" }}>${totalAmount.toLocaleString()}</span>
              </div>
              {totalProductCost > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "#888780" }}>自領商品</span>
                  <span style={{ fontSize: 13, color: "#F09595" }}>-${totalProductCost.toLocaleString()}</span>
                </div>
              )}
              {totalMaterialCost > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "#888780" }}>耗材成本</span>
                  <span style={{ fontSize: 13, color: "#F09595" }}>-${totalMaterialCost.toLocaleString()}</span>
                </div>
              )}
              <div style={{ borderTop: "0.5px solid #4A4580", marginTop: 6, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>淨收入</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: "#C8C4F8" }}>${(totalAmount - totalProductCost - totalMaterialCost).toLocaleString()}</span>
              </div>
            </div>

            <button onClick={handleSubmit} disabled={saving} style={{ width: "100%", padding: "14px 0", background: saving ? "#D3D1C7" : "#534AB7", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: saving ? "default" : "pointer" }}>
              {saving ? "建立中..." : "確認建立交易明細"}
            </button>
          </>
        )}
      </div>

      {/* 編輯交易 Modal */}
      {editingTransaction && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: "20px 20px 0 0", maxHeight: "90vh", overflowY: "auto" }}>

            {/* 頂部 */}
            <div style={{ padding: "16px 16px 0", position: "sticky", top: 0, background: "#fff", zIndex: 10, borderBottom: "0.5px solid #F1EFE8", paddingBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#2C2C2A" }}>{editingTransaction.customer_name}</div>
                  <div style={{ fontSize: 11, color: "#888780" }}>{editingTransaction.created_at?.slice(0, 10).replace(/-/g, "/")}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#534AB7" }}>${editServices.reduce((sum, s) => sum + (s.amount || 0), 0).toLocaleString()}</div>
                    <div style={{ fontSize: 10, color: "#888780" }}>合計</div>
                  </div>
                  <button onClick={() => setEditingTransaction(null)} style={{ background: "#F1EFE8", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer" }}>x</button>
                </div>
              </div>
            </div>

            <div style={{ padding: "14px 16px 32px" }}>
              {/* 已選服務 */}
              {editServices.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  {editServices.map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#EEEDFE", borderRadius: 10, marginBottom: 6 }}>
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#2C2C2A" }}>{s.name}</div>
                      <input
                        value={s.amount || ""}
                        onChange={(e) => setEditServices(editServices.map((sv, idx) => idx === i ? { ...sv, amount: parseInt(e.target.value) || 0 } : sv))}
                        type="number"
                        placeholder="金額"
                        style={{ width: 72, padding: "6px 8px", borderRadius: 8, border: "1px solid #AFA9EC", fontSize: 13, outline: "none", textAlign: "center" }}
                      />
                      <input
                        value={s.discount || ""}
                        onChange={(e) => {
                          const discount = parseInt(e.target.value) || 0;
                          setEditServices(editServices.map((sv, idx) => idx === i ? { ...sv, discount, amount: Math.max(0, (sv.original_amount || sv.amount) - discount) } : sv));
                        }}
                        type="number"
                        placeholder="折扣"
                        style={{ width: 60, padding: "6px 8px", borderRadius: 8, border: "1px solid #FAC775", fontSize: 13, outline: "none", textAlign: "center", background: "#FAEEDA" }}
                      />
                      <button onClick={() => setEditServices(editServices.filter((_, idx) => idx !== i))} style={{ background: "#FCEBEB", border: "none", borderRadius: 6, width: 28, height: 28, color: "#A32D2D", fontSize: 14, cursor: "pointer", flexShrink: 0 }}>x</button>
                    </div>
                  ))}
                  <div style={{ fontSize: 10, color: "#888780", textAlign: "right", marginTop: 2 }}>左：金額 ｜ 中：折扣</div>
                </div>
              )}

              {/* 服務選擇 */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#888780", marginBottom: 8 }}>新增 / 移除服務</div>
                {categories.map((cat) => {
                  const catServices = services.filter(s => s.category_id === cat.id);
                  return (
                    <div key={cat.id} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: cat.text_color, background: cat.color, borderRadius: 6, padding: "3px 10px", display: "inline-block", marginBottom: 6, fontWeight: 600 }}>{cat.label}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {catServices.map(svc => {
                          const picked = editServices.find(s => s.id === svc.id);
                          return (
                            <button
                              key={svc.id}
                              onClick={() => {
                                if (picked) {
                                  setEditServices(editServices.filter(s => s.id !== svc.id));
                                } else {
                                  setEditServices([...editServices, { id: svc.id, name: svc.name, amount: svc.default_price || 0, original_amount: svc.default_price || 0, discount: 0 }]);
                                }
                              }}
                              style={{ padding: "7px 12px", borderRadius: 20, border: "none", background: picked ? cat.text_color : "#F1EFE8", color: picked ? "#fff" : "#5F5E5A", fontSize: 12, cursor: "pointer", fontWeight: picked ? 600 : 400 }}
                            >
                              {picked ? "✓ " : ""}{svc.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 備註 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#888780", marginBottom: 6 }}>備註</div>
                <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="備註..." style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", height: 60, resize: "none", boxSizing: "border-box" }} />
              </div>

              <button onClick={handleEditSave} disabled={editSaving} style={{ width: "100%", padding: "14px 0", background: editSaving ? "#D3D1C7" : "#534AB7", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: editSaving ? "default" : "pointer" }}>
                {editSaving ? "儲存中..." : "儲存修改"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 結帳後上傳髮型照提示 */}
      {showPhotoPrompt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 360, background: "#fff", borderRadius: 20, padding: "24px 20px" }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#2C2C2A" }}>交易已建立！</div>
              <div style={{ fontSize: 13, color: "#888780", marginTop: 4 }}>
                {completedCustomerName} 的服務完成
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 6 }}>備註（選填）</div>
              <input
                value={photoNote}
                onChange={(e) => setPhotoNote(e.target.value)}
                placeholder="染色配方、燙髮時間..."
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <label style={{ display: "block", width: "100%", padding: "13px 0", background: uploadingPhoto ? "#D3D1C7" : "#534AB7", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: uploadingPhoto ? "default" : "pointer", textAlign: "center", marginBottom: 10 }}>
              {uploadingPhoto ? "上傳中..." : "📷 上傳今日髮型照"}
              <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} style={{ display: "none" }} disabled={uploadingPhoto} />
            </label>

            <button
              onClick={() => { setShowPhotoPrompt(false); setTab("history"); }}
              style={{ width: "100%", padding: "12px 0", background: "#F1EFE8", color: "#5F5E5A", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: "pointer" }}
            >
              跳過，不上傳
            </button>
          </div>
        </div>
      )}

      <BottomNav current="transaction" />
    </div>
  );
}
