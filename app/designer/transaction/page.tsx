"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import BottomNav from "../components/BottomNav";

type DesignerSession = { id: number; name: string; nickname: string };
type Booking = { id: number; customer_name: string; customer_phone: string; booking_date: string; booking_time: string; service_ids?: number[] };
type Service = { id: number; name: string; category_id: number; default_price: number };
type ServiceCategory = { id: number; label: string; color: string; text_color: string };
type DesignerPriceItem = { id: number; designer_id: number; name: string; price_range: string; is_active: boolean };
type SelectedService = { id: number; name: string; amount: number; original_amount: number; discount: number };
type Material = { name: string; quantity: string; unit: string; cost: string };
type Product = { id: number; name: string; unit: string; unit_price: number; category: string };
type ProductUsageItem = { product: Product; quantity: number; discount?: number };
type Transaction = {
  id: number;
  customer_name: string;
  service_items: SelectedService[];
  total_amount: number;
  note: string;
  created_at: string;
  payment_method: string;
  designer_id: number;
};

export default function DesignerTransaction() {
  const router = useRouter();
  const [designer, setDesigner] = useState<DesignerSession | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [designerPrices, setDesignerPrices] = useState<DesignerPriceItem[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [openCategory, setOpenCategory] = useState<number | null>(null);
  const [materials, setMaterials] = useState<Material[]>([{ name: "", quantity: "", unit: "g", cost: "" }]);
  const [productUsage, setProductUsage] = useState<ProductUsageItem[]>([]);
  const [showProducts, setShowProducts] = useState(false);
  const [showClientProducts, setShowClientProducts] = useState(false);
  const [clientProductUsage, setClientProductUsage] = useState<ProductUsageItem[]>([]);
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("現金");
  const [customPayment, setCustomPayment] = useState("");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"new" | "history" | "report" | "self">("history");
  const [showPhotoPrompt, setShowPhotoPrompt] = useState(false);
  const [completedCustomerName, setCompletedCustomerName] = useState("");
  const [completedCustomerPhone, setCompletedCustomerPhone] = useState("");
  const [completedNoteId, setCompletedNoteId] = useState<number | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoNote, setPhotoNote] = useState("");
  const [history, setHistory] = useState<Transaction[]>([]);
  const [monthTotal, setMonthTotal] = useState(0);
  const [historyMode, setHistoryMode] = useState<"today" | "date" | "all">("today");
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editServices, setEditServices] = useState<SelectedService[]>([]);
  const [editNote, setEditNote] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  });
  const [chartType, setChartType] = useState<"bar" | "pie">("bar");
  const [reportMode, setReportMode] = useState<"month" | "year">("month");
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  useEffect(() => {
    const session = sessionStorage.getItem("designerSession");
    if (!session) { router.push("/designer/login"); return; }
    const d = JSON.parse(session);
    setDesigner(d);

    async function fetchData() {
      const today = new Date().toISOString().split("T")[0];
      const [{ data: bData }, { data: tData }, { data: sData }, { data: cData }, { data: pData }, { data: dpData }] = await Promise.all([
        supabase.from("bookings").select("*").eq("designer_id", d.id).eq("status", "confirmed").gte("booking_date", today).order("booking_date").order("booking_time"),
        supabase.from("transactions").select("*").eq("designer_id", d.id).order("created_at", { ascending: false }),
        supabase.from("services").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("service_categories").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("products").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("designer_price_items").select("*").eq("designer_id", d.id).eq("is_active", true).order("sort_order"),
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
      if (dpData) setDesignerPrices(dpData);
      const checkoutBookingId = Number(new URLSearchParams(window.location.search).get("checkout") || 0);
      if (checkoutBookingId && bData && sData) {
        const targetBooking = bData.find((b: Booking) => b.id === checkoutBookingId);
        if (targetBooking) {
          setTab("new");
          setSelectedBooking(targetBooking);
          const bookingServices = (targetBooking.service_ids || [])
            .map((id: number) => sData.find((svc: Service) => svc.id === id))
            .filter(Boolean) as Service[];
          setSelectedServices(bookingServices.map((svc) => {
            const suggestedPrice = getSuggestedServicePriceFromList(svc, dpData || []);
            return { id: svc.id, name: svc.name, amount: suggestedPrice, original_amount: suggestedPrice, discount: 0 };
          }));
        }
      }
    }
    fetchData();
  }, [router]);

  function normalizeServiceName(name: string) {
    return name.replace(/\s*\([SMLX]+\)$/, "").replace(/\s+/g, "").trim().toLowerCase();
  }

  function parsePriceRange(priceRange: string) {
    const match = priceRange.match(/\d[\d,]*/);
    return match ? parseInt(match[0].replace(/,/g, "")) || 0 : 0;
  }

  function getSuggestedServicePrice(service: Service) {
    const serviceName = normalizeServiceName(service.name);
    const matchedPrice = designerPrices.find((item) => {
      const priceName = normalizeServiceName(item.name);
      return priceName === serviceName || priceName.includes(serviceName) || serviceName.includes(priceName);
    });
    return matchedPrice ? parsePriceRange(matchedPrice.price_range) : (service.default_price || 0);
  }

  function getSuggestedServicePriceFromList(service: Service, priceItems: DesignerPriceItem[]) {
    const serviceName = normalizeServiceName(service.name);
    const matchedPrice = priceItems.find((item) => {
      const priceName = normalizeServiceName(item.name);
      return priceName === serviceName || priceName.includes(serviceName) || serviceName.includes(priceName);
    });
    return matchedPrice ? parsePriceRange(matchedPrice.price_range) : (service.default_price || 0);
  }

  function toggleService(svc: Service & { default_price?: number }) {
    const exists = selectedServices.find(s => s.id === svc.id);
    if (exists) setSelectedServices(selectedServices.filter(s => s.id !== svc.id));
    else {
      const suggestedPrice = getSuggestedServicePrice(svc);
      setSelectedServices([...selectedServices, { id: svc.id, name: svc.name, amount: suggestedPrice, original_amount: suggestedPrice, discount: 0 }]);
    }
  }

  function selectBookingForCheckout(booking: Booking | null) {
    setSelectedBooking(booking);
    if (!booking?.service_ids?.length) return;
    const bookingServices = booking.service_ids
      .map((id) => services.find((svc) => svc.id === id))
      .filter(Boolean) as Service[];
    if (bookingServices.length === 0) return;
    setSelectedServices(bookingServices.map((svc) => {
      const suggestedPrice = getSuggestedServicePrice(svc);
      return { id: svc.id, name: svc.name, amount: suggestedPrice, original_amount: suggestedPrice, discount: 0 };
    }));
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

  function toggleClientProduct(product: Product) {
    const exists = clientProductUsage.find(p => p.product.id === product.id);
    if (exists) setClientProductUsage(clientProductUsage.filter(p => p.product.id !== product.id));
    else setClientProductUsage([...clientProductUsage, { product, quantity: 1, discount: 0 }]);
  }

  function updateClientProductQty(id: number, qty: number) {
    setClientProductUsage(clientProductUsage.map(p => p.product.id === id ? { ...p, quantity: qty } : p));
  }

  function updateClientProductDiscount(id: number, value: string) {
    const discount = Math.max(0, parseInt(value) || 0);
    setClientProductUsage(clientProductUsage.map(p => {
      if (p.product.id !== id) return p;
      const originalTotal = p.product.unit_price * p.quantity;
      return { ...p, discount: Math.min(discount, originalTotal) };
    }));
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
  const totalDiscount = selectedServices.reduce((sum, s) => sum + (s.discount || 0), 0);
  const clientProductDiscountTotal = clientProductUsage.reduce((sum, p) => sum + (p.discount || 0), 0);
  const clientProductTotal = clientProductUsage.reduce((sum, p) => sum + Math.max(0, (p.product.unit_price * p.quantity) - (p.discount || 0)), 0);
  const checkoutTotal = totalAmount + clientProductTotal;
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
      total_amount: checkoutTotal,
      note: [
        note,
        clientProductUsage.length > 0 ? `客人購買商品：${clientProductUsage.map(p => {
          const originalTotal = p.product.unit_price * p.quantity;
          const finalTotal = Math.max(0, originalTotal - (p.discount || 0));
          return `${p.product.name} x${p.quantity}${p.discount ? ` 折扣NT$${p.discount.toLocaleString()}` : ""} 小計NT$${finalTotal.toLocaleString()}`;
        }).join("、")}` : "",
      ].filter(Boolean).join("\n"),
      payment_method: paymentMethod === "其他" ? (customPayment || "其他") : paymentMethod,
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
      // 自領商品自動扣庫存
      for (const pu of productUsage) {
        const { data: p } = await supabase.from("products").select("stock_quantity").eq("id", pu.product.id).single();
        if (p) {
          const newStock = Math.max(0, (p.stock_quantity || 0) - pu.quantity);
          await supabase.from("products").update({ stock_quantity: newStock }).eq("id", pu.product.id);
          await supabase.from("stock_records").insert({
            product_id: pu.product.id,
            product_name: pu.product.name,
            quantity: -pu.quantity,
            type: "out",
            note: "設計師自領 - " + designer.name,
          });
        }
      }
    }
    // 客人購買商品自動扣庫存
    if (clientProductUsage.length > 0) {
      for (const pu of clientProductUsage) {
        const { data: p } = await supabase.from("products").select("stock_quantity").eq("id", pu.product.id).single();
        if (p) {
          const newStock = Math.max(0, (p.stock_quantity || 0) - pu.quantity);
          await supabase.from("products").update({ stock_quantity: newStock }).eq("id", pu.product.id);
          await supabase.from("stock_records").insert({
            product_id: pu.product.id,
            product_name: pu.product.name,
            quantity: -pu.quantity,
            type: "out",
            note: "客人購買",
          });
        }
      }
    }
    setSaving(false);
    setSelectedServices([]);
    setMaterials([{ name: "", quantity: "", unit: "g", cost: "" }]);
    setProductUsage([]);
    setClientProductUsage([]);
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
  const today = new Date().toLocaleDateString("en-CA");
  const visibleHistory = historyMode === "today"
    ? history.filter(t => t.created_at?.slice(0, 10) === today)
    : historyMode === "date"
      ? history.filter(t => t.created_at?.slice(0, 10) === selectedHistoryDate)
      : history;
  const visibleHistoryTotal = visibleHistory.reduce((sum, t) => sum + (t.total_amount || 0), 0);
  const historyTitle = historyMode === "today" ? "今日交易紀錄" : historyMode === "date" ? `${selectedHistoryDate.replace(/-/g, "/")} 交易紀錄` : "全部交易紀錄";

  // 當月各服務分類統計
  const serviceStats = (() => {
    const stats: Record<string, number> = {};
    filteredHistory.forEach(t => {
      (t.service_items || []).forEach((s: SelectedService) => {
        if (!s.name) return;
        // 根據服務名稱找對應分類
        const svc = services.find(sv => sv.id === s.id);
        const cat = svc ? categories.find(c => c.id === svc.category_id) : null;
        const key = cat ? cat.label : s.name;
        stats[key] = (stats[key] || 0) + (s.amount || 0);
      });
    });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  })();
  const maxServiceAmount = Math.max(...serviceStats.map(([, v]) => v), 1);
  const serviceColors = ["#534AB7","#7B6FD4","#1D9E75","#BA7517","#E24B4A","#0C447C","#085041","#A32D2D","#633806","#3C3489"];

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
    // 已完成結帳的交易保留原始帳務紀錄，不再開放設計師端修改。
    alert("此筆交易已完成結帳，無法再進入編輯。");
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
    <div style={{ minHeight: "100vh", background: "#F1EFE8", paddingBottom: 76 }}>
      <div style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>帳務</div>
        <div style={{ marginLeft: "auto", background: "#2C2840", borderRadius: 10, padding: "4px 12px" }}>
          <div style={{ fontSize: 10, color: "#888780" }}>本月收入</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#C8C4F8" }}>${monthTotal.toLocaleString()}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, padding: "12px 16px 8px" }}>
        {[{ key: "history", label: "交易紀錄" }, { key: "report", label: "收入報表" }, { key: "new", label: "新增明細" }, { key: "self", label: "自領記錄" }].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as "new" | "history" | "report")} style={{ flex: 1, padding: "6px 0", borderRadius: 20, border: "none", background: tab === t.key ? "#534AB7" : "#fff", color: tab === t.key ? "#fff" : "#5F5E5A", fontSize: 12, fontWeight: tab === t.key ? 600 : 400, cursor: "pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 16px 32px" }}>
        {tab === "report" && (
          <>
            <div style={{ background: "#fff", borderRadius: 999, padding: 4, marginBottom: 12, border: "0.5px solid #D3D1C7", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              {[
                { key: "month", label: "當月收入" },
                { key: "year", label: "年度分析" },
              ].map((mode) => (
                <button key={mode.key} onClick={() => setReportMode(mode.key as "month" | "year")} style={{ padding: "9px 0", borderRadius: 999, border: "none", background: reportMode === mode.key ? "#534AB7" : "transparent", color: reportMode === mode.key ? "#fff" : "#5F5E5A", fontSize: 13, fontWeight: reportMode === mode.key ? 800 : 600, cursor: "pointer" }}>
                  {mode.label}
                </button>
              ))}
            </div>

            {reportMode === "month" && (
              <>
                <div style={{ background: "linear-gradient(135deg, #1A1A1A 0%, #3A2424 100%)", borderRadius: 18, padding: "16px", marginBottom: 12, color: "#fff", boxShadow: "0 8px 22px rgba(26,26,26,0.14)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.62)", marginBottom: 6 }}>{selectedMonth} 當月收入</div>
                      <div style={{ fontSize: 30, fontWeight: 850, letterSpacing: "-0.03em" }}>NT$ {filteredTotal.toLocaleString()}</div>
                    </div>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      style={{ maxWidth: 122, padding: "7px 8px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.16)", fontSize: 12, outline: "none", background: "rgba(255,255,255,0.1)", color: "#fff" }}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
                    <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px 12px" }}>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.58)", marginBottom: 5 }}>交易筆數</div>
                      <div style={{ fontSize: 18, fontWeight: 850 }}>{filteredHistory.length} 筆</div>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px 12px" }}>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.58)", marginBottom: 5 }}>平均客單</div>
                      <div style={{ fontSize: 18, fontWeight: 850 }}>NT$ {filteredHistory.length ? Math.round(filteredTotal / filteredHistory.length).toLocaleString() : 0}</div>
                    </div>
                  </div>
                </div>

                <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, border: "0.5px solid #D3D1C7" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#2C2C2A", marginBottom: 12 }}>當月服務收入分類</div>
                  {serviceStats.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "20px 0", color: "#888780", fontSize: 13 }}>本月尚無服務收入</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {serviceStats.map(([label, amount], i) => (
                        <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: "50%", background: serviceColors[i % serviceColors.length], flexShrink: 0 }} />
                          <div style={{ fontSize: 12, color: "#5F5E5A", width: 56, flexShrink: 0 }}>{label}</div>
                          <div style={{ flex: 1, height: 16, background: "#F1EFE8", borderRadius: 999, overflow: "hidden" }}>
                            <div style={{ height: "100%", background: serviceColors[i % serviceColors.length], width: `${Math.max((amount / maxServiceAmount) * 100, 4)}%`, borderRadius: 999 }} />
                          </div>
                          <div style={{ fontSize: 12, color: serviceColors[i % serviceColors.length], fontWeight: 800, width: 76, textAlign: "right" }}>NT$ {amount.toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, border: "0.5px solid #D3D1C7" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#2C2C2A", marginBottom: 12 }}>當月交易明細</div>
                  {filteredHistory.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "20px 0", color: "#888780", fontSize: 13 }}>本月尚無交易紀錄</div>
                  ) : (
                    filteredHistory.map((t) => (
                      <div key={t.id} style={{ background: "#F1EFE8", borderRadius: 8, padding: "8px 10px", marginBottom: 5, display: "flex", alignItems: "center", gap: 8, overflowX: "auto", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 11, color: "#888780", flexShrink: 0 }}>{t.created_at?.slice(0, 10).replace(/-/g, "/")} {t.created_at?.slice(11, 16)}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#2C2C2A", flexShrink: 0 }}>{t.customer_name}</span>
                        <span style={{ fontSize: 11, color: "#5F5E5A", flexShrink: 0 }}>{t.service_items?.map((s: any) => `${s.name} $${s.amount?.toLocaleString()}`).join(" ・ ")}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "#534AB7", flexShrink: 0 }}>NT$ {t.total_amount?.toLocaleString()}</span>
                        {t.payment_method && <span style={{ fontSize: 10, background: "#fff", color: "#5F5E5A", borderRadius: 6, padding: "1px 6px", flexShrink: 0 }}>{t.payment_method}</span>}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {reportMode === "year" && (
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
                      <div key={t.id} style={{ background: "#F1EFE8", borderRadius: 8, padding: "7px 10px", marginBottom: 4, display: "flex", alignItems: "center", gap: 8, overflowX: "auto", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 11, color: "#888780", flexShrink: 0 }}>{t.created_at?.slice(0, 10).replace(/-/g, "/")} {t.created_at?.slice(11, 16)}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#2C2C2A", flexShrink: 0 }}>{t.customer_name}</span>
                        <span style={{ fontSize: 11, color: "#5F5E5A", flexShrink: 0 }}>{t.service_items?.map((s: any) => `${s.name} $${s.amount?.toLocaleString()}`).join(" ・ ")}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#534AB7", flexShrink: 0 }}>${t.total_amount?.toLocaleString()}</span>
                        {t.payment_method && <span style={{ fontSize: 10, background: "#fff", color: "#5F5E5A", borderRadius: 6, padding: "1px 6px", flexShrink: 0 }}>{t.payment_method}</span>}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </>
        )}

        {tab === "history" && (
          <>
            <div style={{ background: "#2C2840", borderRadius: 14, padding: "14px 16px", marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>{historyTitle}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#C8C4F8" }}>${visibleHistoryTotal.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: "#888780", marginTop: 4 }}>{visibleHistory.length} 筆交易</div>
            </div>

            <div style={{ background: "#fff", borderRadius: 14, padding: 10, marginBottom: 10, border: "0.5px solid #D3D1C7" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: historyMode === "date" ? 10 : 0 }}>
                {[
                  { key: "today", label: "今日" },
                  { key: "date", label: "選日期" },
                  { key: "all", label: "全部" },
                ].map((mode) => (
                  <button key={mode.key} onClick={() => setHistoryMode(mode.key as "today" | "date" | "all")} style={{ padding: "8px 0", borderRadius: 999, border: "none", background: historyMode === mode.key ? "#534AB7" : "#F1EFE8", color: historyMode === mode.key ? "#fff" : "#5F5E5A", fontSize: 12, fontWeight: historyMode === mode.key ? 800 : 600, cursor: "pointer" }}>
                    {mode.label}
                  </button>
                ))}
              </div>
              {historyMode === "date" && (
                <input
                  type="date"
                  value={selectedHistoryDate}
                  onChange={(e) => setSelectedHistoryDate(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
              )}
            </div>

            {visibleHistory.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#888780", fontSize: 14 }}>{historyMode === "today" ? "今日尚無交易紀錄" : "此範圍尚無交易紀錄"}</div>
            ) : (
              visibleHistory.map((t) => (
                <div key={t.id} style={{ background: "#fff", borderRadius: 10, padding: "8px 12px", marginBottom: 4, border: "0.5px solid #D3D1C7", display: "flex", alignItems: "center", gap: 8, overflowX: "auto", whiteSpace: "nowrap" }}>
                  <span style={{ fontSize: 11, color: "#888780", flexShrink: 0 }}>{t.created_at?.slice(0, 10).replace(/-/g, "/")} {t.created_at?.slice(11, 16)}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#2C2C2A", flexShrink: 0 }}>{t.customer_name}</span>
                  <span style={{ fontSize: 11, color: "#5F5E5A", flexShrink: 0 }}>
                    {t.service_items?.map((s: SelectedService) => `${s.name} $${s.amount?.toLocaleString()}`).join(" ・ ")}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#534AB7", flexShrink: 0 }}>${t.total_amount?.toLocaleString()}</span>
                  {t.payment_method && <span style={{ fontSize: 10, background: "#F1EFE8", color: "#5F5E5A", borderRadius: 6, padding: "1px 6px", flexShrink: 0 }}>{t.payment_method}</span>}
                  <span style={{ background: "#F1EFE8", color: "#888780", borderRadius: 6, padding: "3px 8px", fontSize: 11, flexShrink: 0, marginLeft: "auto" }}>已結帳鎖定</span>
                </div>
              ))
            )}
          </>
        )}

        {tab === "new" && (
          <>
            <div style={{ position: "sticky", top: 0, zIndex: 20, background: "#F1EFE8", padding: "0 0 10px" }}>
              <div style={{ background: "linear-gradient(135deg, #1A1A1A 0%, #3A2424 100%)", borderRadius: 16, padding: "14px 16px", color: "#fff", boxShadow: "0 8px 22px rgba(26,26,26,0.14)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.62)", marginBottom: 5 }}>本次結帳總額</div>
                    <div style={{ fontSize: 28, fontWeight: 850, letterSpacing: "-0.03em" }}>NT$ {checkoutTotal.toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign: "right", fontSize: 11, lineHeight: 1.7, color: "rgba(255,255,255,0.7)" }}>
                    <div>服務 {selectedServices.length} 項</div>
                    <div>折扣 NT$ {totalDiscount.toLocaleString()}</div>
                    <div>商品 NT$ {clientProductTotal.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 連結預約 */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 14, marginBottom: 10, border: "0.5px solid #D3D1C7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#2C2C2A" }}>連結預約</div>
                  <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>選擇預約後會帶入客人與服務項目</div>
                </div>
                {selectedBooking && <button onClick={() => selectBookingForCheckout(null)} style={{ border: "none", background: "#F1EFE8", color: "#5F5E5A", borderRadius: 999, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>清除</button>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div onClick={() => selectBookingForCheckout(null)} style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${!selectedBooking ? "#7A1F1F" : "#D3D1C7"}`, background: !selectedBooking ? "#F6EAEA" : "#F1EFE8", cursor: "pointer", fontSize: 13, color: !selectedBooking ? "#7A1F1F" : "#5F5E5A", fontWeight: !selectedBooking ? 800 : 500 }}>
                  現場客人（不綁定預約）
                </div>
                {bookings.map((b) => (
                  <div key={b.id} onClick={() => selectBookingForCheckout(b)} style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${selectedBooking?.id === b.id ? "#7A1F1F" : "#D3D1C7"}`, background: selectedBooking?.id === b.id ? "#F6EAEA" : "#fff", cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#2C2C2A" }}>{b.customer_name}</div>
                      <div style={{ fontSize: 12, color: "#7A1F1F", fontWeight: 800 }}>{b.booking_time}</div>
                    </div>
                    <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>{b.booking_date.replace(/-/g, "/")} {b.customer_phone || ""}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 服務項目 */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 14, marginBottom: 10, border: "0.5px solid #D3D1C7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#2C2C2A" }}>服務與金額</div>
                  <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>建議價格可修改，請以現場結帳為準</div>
                </div>
                <div style={{ fontSize: 11, color: "#888780" }}>已選 {selectedServices.length} 項</div>
              </div>
              {categories.map((cat) => {
                const catServices = services.filter(s => s.category_id === cat.id);
                const isOpen = openCategory === cat.id;
                const pickedCount = catServices.filter(s => selectedServices.find(ss => ss.id === s.id)).length;
                return (
                  <div key={cat.id} style={{ marginBottom: 6 }}>
                    <div onClick={() => setOpenCategory(isOpen ? null : cat.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 12px", background: pickedCount > 0 ? cat.color : "#F1EFE8", borderRadius: isOpen ? "10px 10px 0 0" : 10, cursor: "pointer", border: `0.5px solid ${pickedCount > 0 ? cat.text_color + "40" : "#D3D1C7"}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "#2C2C2A" }}>{cat.label}</span>
                        {pickedCount > 0 && <span style={{ fontSize: 10, background: cat.text_color, color: "#fff", borderRadius: 10, padding: "2px 8px", fontWeight: 700 }}>{pickedCount} 項</span>}
                      </div>
                      <span style={{ fontSize: 11, color: "#888780" }}>{isOpen ? "▲" : "▼"}</span>
                    </div>
                    {isOpen && (
                      <div style={{ border: "0.5px solid #D3D1C7", borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
                        {catServices.map(svc => {
                          const picked = selectedServices.find(s => s.id === svc.id);
                          return (
                            <div key={svc.id}>
                              <div onClick={() => toggleService(svc)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "12px", background: picked ? cat.color : "#fff", borderTop: "0.5px solid #F1EFE8", cursor: "pointer" }}>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: "#2C2C2A", lineHeight: 1.4 }}>{svc.name}</div>
                                  {getSuggestedServicePrice(svc) > 0 && (
                                    <div style={{ fontSize: 11, color: "#888780", marginTop: 3 }}>建議 NT$ {getSuggestedServicePrice(svc).toLocaleString()}</div>
                                  )}
                                </div>
                                <div style={{ width: 24, height: 24, flex: "0 0 24px", borderRadius: 8, border: `1.5px solid ${picked ? cat.text_color : "#D3D1C7"}`, background: picked ? cat.text_color : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  {picked && <span style={{ color: "#fff", fontSize: 13, fontWeight: 800 }}>✓</span>}
                                </div>
                              </div>
                              {picked && (
                                <div style={{ padding: "10px 12px 12px", background: cat.color }}>
                                  <div style={{ display: "flex", gap: 8 }}>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: 11, color: "#888780", marginBottom: 5 }}>實收金額</div>
                                      <input value={picked.amount || ""} onChange={(e) => updateAmount(svc.id, e.target.value)} placeholder="金額" type="number" style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid #D3D1C7", fontSize: 14, outline: "none", boxSizing: "border-box", fontWeight: 700 }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: 11, color: "#888780", marginBottom: 5 }}>折扣金額</div>
                                      <input value={picked.discount || ""} onChange={(e) => updateDiscount(svc.id, e.target.value)} placeholder="0" type="number" style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid #FAC775", fontSize: 14, outline: "none", boxSizing: "border-box", background: "#FAEEDA", fontWeight: 700 }} />
                                    </div>
                                  </div>
                                  {picked.discount > 0 && (
                                    <div style={{ fontSize: 11, color: "#BA7517", marginTop: 6, fontWeight: 700 }}>原價 NT$ {picked.original_amount.toLocaleString()} - 折扣 NT$ {picked.discount.toLocaleString()} = NT$ {picked.amount.toLocaleString()}</div>
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

            {/* 客人購買商品 */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 14, marginBottom: 10, border: "0.5px solid #D3D1C7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#2C2C2A" }}>客人購買商品</div>
                <button onClick={() => setShowClientProducts(!showClientProducts)} style={{ fontSize: 11, color: "#1D9E75", background: "#E1F5EE", border: "none", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>
                  {showClientProducts ? "收起" : "選取商品"}
                </button>
              </div>
              <div style={{ fontSize: 11, color: "#888780", marginBottom: showClientProducts ? 10 : 0 }}>客人購買金額加入消費總額</div>
              {showClientProducts && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {products.map(p => {
                    const picked = clientProductUsage.find(pu => pu.product.id === p.id);
                    return (
                      <div key={p.id} style={{ border: "1px solid " + (picked ? "#1D9E75" : "#D3D1C7"), borderRadius: 8, overflow: "hidden" }}>
                        <div onClick={() => toggleClientProduct(p)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: picked ? "#E1F5EE" : "#fff", cursor: "pointer" }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 500, color: "#2C2C2A" }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: "#888780" }}>${p.unit_price.toLocaleString()} / {p.unit}</div>
                          </div>
                          <div style={{ width: 20, height: 20, borderRadius: 6, border: "1.5px solid " + (picked ? "#1D9E75" : "#D3D1C7"), background: picked ? "#1D9E75" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {picked && <span style={{ color: "#fff", fontSize: 12 }}>✓</span>}
                          </div>
                        </div>
                        {picked && (
                          <div style={{ padding: "8px 12px 11px", background: "#E1F5EE" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                              <span style={{ fontSize: 11, color: "#888780" }}>數量：</span>
                              <button onClick={() => updateClientProductQty(p.id, Math.max(1, picked.quantity - 1))} style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid #D3D1C7", background: "#fff", cursor: "pointer", fontSize: 14 }}>-</button>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A", minWidth: 20, textAlign: "center" }}>{picked.quantity}</span>
                              <button onClick={() => updateClientProductQty(p.id, picked.quantity + 1)} style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid #D3D1C7", background: "#fff", cursor: "pointer", fontSize: 14 }}>+</button>
                              <span style={{ fontSize: 12, color: "#888780", marginLeft: "auto" }}>原價 ${(p.unit_price * picked.quantity).toLocaleString()}</span>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "end" }}>
                              <div>
                                <div style={{ fontSize: 11, color: "#888780", marginBottom: 5 }}>折扣金額</div>
                                <input value={picked.discount || ""} onChange={(e) => updateClientProductDiscount(p.id, e.target.value)} placeholder="0" type="number" style={{ width: "100%", padding: "9px 10px", borderRadius: 10, border: "1px solid #FAC775", fontSize: 13, outline: "none", boxSizing: "border-box", background: "#FAEEDA", fontWeight: 700 }} />
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 11, color: "#888780", marginBottom: 5 }}>商品小計</div>
                                <div style={{ fontSize: 14, color: "#1D9E75", fontWeight: 850 }}>NT$ {Math.max(0, (p.unit_price * picked.quantity) - (picked.discount || 0)).toLocaleString()}</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {clientProductUsage.length > 0 && (
                <div style={{ marginTop: 10, padding: "8px 0", borderTop: "0.5px solid #F1EFE8" }}>
                  {clientProductUsage.map(pu => (
                    <div key={pu.product.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#5F5E5A", marginBottom: 3 }}>
                      <span>{pu.product.name} x{pu.quantity}</span>
                      <span style={{ color: "#1D9E75" }}>+NT$ {Math.max(0, (pu.product.unit_price * pu.quantity) - (pu.discount || 0)).toLocaleString()}</span>
                    </div>
                  ))}
                  {clientProductDiscountTotal > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#BA7517", marginBottom: 3 }}>
                      <span>商品折扣</span>
                      <span>-NT$ {clientProductDiscountTotal.toLocaleString()}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: "#1D9E75", marginTop: 6, paddingTop: 6, borderTop: "0.5px solid #F1EFE8" }}>
                    <span>商品實收小計</span>
                    <span>+NT$ {clientProductTotal.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            {/* 帳單確認 */}
            <div style={{ background: "#1A1A1A", borderRadius: 16, padding: "15px 16px", marginBottom: 10, color: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 850, color: "#fff" }}>帳單確認</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.52)", marginTop: 3 }}>請先確認服務與商品明細，再選付款方式</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.52)", marginBottom: 3 }}>應收總額</div>
                  <div style={{ fontSize: 24, fontWeight: 850, letterSpacing: "-0.03em" }}>NT$ {checkoutTotal.toLocaleString()}</div>
                </div>
              </div>

              <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.12)", paddingTop: 10, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.62)", fontWeight: 800 }}>服務項目</span>
                  <span style={{ fontSize: 12, color: "#fff", fontWeight: 800 }}>NT$ {totalAmount.toLocaleString()}</span>
                </div>
                {selectedServices.length === 0 ? (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>尚未選擇服務</div>
                ) : (
                  selectedServices.map((s) => (
                    <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6, fontSize: 12, lineHeight: 1.5 }}>
                      <div style={{ color: "rgba(255,255,255,0.78)" }}>
                        {s.name}
                        {s.discount > 0 && <span style={{ color: "#FAC775" }}> ｜折扣 NT$ {s.discount.toLocaleString()}</span>}
                      </div>
                      <div style={{ color: "#fff", fontWeight: 750, flexShrink: 0 }}>NT$ {s.amount.toLocaleString()}</div>
                    </div>
                  ))
                )}
              </div>

              {clientProductUsage.length > 0 && (
                <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.12)", paddingTop: 10, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.62)", fontWeight: 800 }}>購買商品</span>
                    <span style={{ fontSize: 12, color: "#B8F0D9", fontWeight: 800 }}>+NT$ {clientProductTotal.toLocaleString()}</span>
                  </div>
                  {clientProductUsage.map((p) => {
                    const originalTotal = p.product.unit_price * p.quantity;
                    const finalTotal = Math.max(0, originalTotal - (p.discount || 0));
                    return (
                      <div key={p.product.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6, fontSize: 12, lineHeight: 1.5 }}>
                        <div style={{ color: "rgba(255,255,255,0.78)" }}>
                          {p.product.name} x{p.quantity}
                          {p.discount ? <span style={{ color: "#FAC775" }}> ｜商品折扣 NT$ {p.discount.toLocaleString()}</span> : null}
                        </div>
                        <div style={{ color: "#B8F0D9", fontWeight: 750, flexShrink: 0 }}>NT$ {finalTotal.toLocaleString()}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.16)", paddingTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.62)" }}>服務小計</span>
                  <span style={{ fontSize: 13, color: "#fff", fontWeight: 700 }}>NT$ {totalAmount.toLocaleString()}</span>
                </div>
                {totalDiscount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.62)" }}>服務折扣</span>
                    <span style={{ fontSize: 13, color: "#FAC775", fontWeight: 700 }}>已折 NT$ {totalDiscount.toLocaleString()}</span>
                  </div>
                )}
                {clientProductTotal > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.62)" }}>商品實收小計</span>
                    <span style={{ fontSize: 13, color: "#B8F0D9", fontWeight: 700 }}>+NT$ {clientProductTotal.toLocaleString()}</span>
                  </div>
                )}
                {clientProductDiscountTotal > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.62)" }}>商品折扣</span>
                    <span style={{ fontSize: 13, color: "#FAC775", fontWeight: 700 }}>已折 NT$ {clientProductDiscountTotal.toLocaleString()}</span>
                  </div>
                )}
                <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.16)", marginTop: 8, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>客人應收總額</span>
                  <span style={{ fontSize: 26, fontWeight: 850, color: "#fff", letterSpacing: "-0.03em" }}>NT$ {checkoutTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>


            {/* 支付方式 */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 14, marginBottom: 10, border: "0.5px solid #D3D1C7" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#2C2C2A", marginBottom: 10 }}>付款方式</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["現金", "轉帳", "LINE Pay", "刷卡", "其他"].map(m => (
                  <button key={m} onClick={() => setPaymentMethod(m)} style={{ padding: "9px 15px", borderRadius: 999, border: "none", background: paymentMethod === m ? "#1A1A1A" : "#F1EFE8", color: paymentMethod === m ? "#fff" : "#5F5E5A", fontSize: 13, fontWeight: paymentMethod === m ? 800 : 500, cursor: "pointer" }}>{m}</button>
                ))}
              </div>
              {paymentMethod === "其他" && (
                <input value={customPayment} onChange={(e) => setCustomPayment(e.target.value)} placeholder="請輸入付款方式..." style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #D3D1C7", fontSize: 14, outline: "none", boxSizing: "border-box", marginTop: 10 }} />
              )}
            </div>

            {/* 備註 */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 14, marginBottom: 14, border: "0.5px solid #D3D1C7" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#2C2C2A", marginBottom: 8 }}>備註（選填）</div>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="折扣原因、顧客狀況、服務紀錄..." style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #D3D1C7", fontSize: 14, outline: "none", height: 82, resize: "none", boxSizing: "border-box", lineHeight: 1.5 }} />
            </div>

            <button onClick={handleSubmit} disabled={saving} style={{ width: "100%", padding: "15px 0", background: saving ? "#D3D1C7" : "#7A1F1F", color: "#fff", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 850, cursor: saving ? "default" : "pointer", boxShadow: saving ? "none" : "0 8px 18px rgba(122,31,31,0.22)" }}>
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

              {/* 服務選擇 - 折疊式 */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#888780", marginBottom: 8 }}>新增 / 移除服務</div>
                {categories.map((cat) => {
                  const catServices = services.filter(s => s.category_id === cat.id);
                  const pickedCount = catServices.filter(s => editServices.find(es => es.id === s.id)).length;
                  const isOpen = openCategory === cat.id;
                  return (
                    <div key={cat.id} style={{ marginBottom: 6 }}>
                      <button
                        onClick={() => setOpenCategory(isOpen ? null : cat.id)}
                        style={{ width: "100%", padding: "12px 14px", background: pickedCount > 0 ? cat.color : "#F1EFE8", border: `1px solid ${pickedCount > 0 ? cat.text_color + "40" : "#D3D1C7"}`, borderRadius: isOpen ? "10px 10px 0 0" : 10, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#2C2C2A" }}>{cat.label}</span>
                          {pickedCount > 0 && (
                            <span style={{ fontSize: 11, background: cat.text_color, color: "#fff", borderRadius: 10, padding: "1px 8px", fontWeight: 600 }}>{pickedCount}</span>
                          )}
                        </div>
                        <span style={{ fontSize: 13, color: "#888780" }}>{isOpen ? "▲" : "▼"}</span>
                      </button>
                      {isOpen && (
                        <div style={{ border: `1px solid ${pickedCount > 0 ? cat.text_color + "40" : "#D3D1C7"}`, borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
                          {catServices.map(svc => {
                            const picked = editServices.find(s => s.id === svc.id);
                            return (
                              <div
                                key={svc.id}
                                onClick={() => {
                                  if (picked) {
                                    setEditServices(editServices.filter(s => s.id !== svc.id));
                                  } else {
                                    const suggestedPrice = getSuggestedServicePrice(svc);
                                    setEditServices([...editServices, { id: svc.id, name: svc.name, amount: suggestedPrice, original_amount: suggestedPrice, discount: 0 }]);
                                  }
                                }}
                                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: picked ? cat.color : "#fff", borderTop: "0.5px solid #F1EFE8", cursor: "pointer" }}
                              >
                                <div>
                                  <div style={{ fontSize: 13, color: "#2C2C2A" }}>{svc.name}</div>
                                  {getSuggestedServicePrice(svc) > 0 && <div style={{ fontSize: 11, color: "#888780" }}>${getSuggestedServicePrice(svc).toLocaleString()}</div>}
                                </div>
                                <div style={{ width: 24, height: 24, borderRadius: 6, border: `1.5px solid ${picked ? cat.text_color : "#D3D1C7"}`, background: picked ? cat.text_color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  {picked && <span style={{ color: "#fff", fontSize: 13 }}>✓</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
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
              <div style={{ fontSize: 12, color: "#5F5E5A", marginTop: 8, lineHeight: 1.6 }}>
                髮型照可先跳過，之後也能到顧客備忘補上傳。
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

            {completedNoteId && (
              <button
                onClick={() => {
                  setShowPhotoPrompt(false);
                  router.push(`/designer/customers?uploadCustomer=${completedNoteId}`);
                }}
                style={{ width: "100%", padding: "12px 0", background: "#EEEDFE", color: "#534AB7", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 10 }}
              >
                稍後補上傳
              </button>
            )}

            <button
              onClick={() => { setShowPhotoPrompt(false); setTab("history"); }}
              style={{ width: "100%", padding: "12px 0", background: "#F1EFE8", color: "#5F5E5A", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: "pointer" }}
            >
              跳過，回交易紀錄
            </button>
          </div>
        </div>
      )}


        {tab === "self" && (
          <div style={{ paddingBottom: 32 }}>
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
          </div>
        )}
      <BottomNav current="transaction" />
    </div>
  );
}
