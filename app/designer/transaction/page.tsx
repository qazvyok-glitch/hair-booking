"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import BottomNav from "../components/BottomNav";

type DesignerSession = { id: number; name: string; nickname: string };
type Booking = { id: number; customer_name: string; booking_date: string; booking_time: string };
type Service = { id: number; name: string; category_id: number };
type ServiceCategory = { id: number; label: string; color: string; text_color: string };
type SelectedService = { id: number; name: string; amount: number };
type Material = { name: string; quantity: string; unit: string; cost: string };
type Product = { id: number; name: string; unit: string; unit_price: number; category: string };
type ProductUsageItem = { product: Product; quantity: number };

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
  const [tab, setTab] = useState<"new" | "history">("new");
  const [history, setHistory] = useState<any[]>([]);
  const [monthTotal, setMonthTotal] = useState(0);

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

  function toggleService(svc: Service) {
    const exists = selectedServices.find(s => s.id === svc.id);
    if (exists) {
      setSelectedServices(selectedServices.filter(s => s.id !== svc.id));
    } else {
      setSelectedServices([...selectedServices, { id: svc.id, name: svc.name, amount: 0 }]);
    }
  }

  function updateAmount(id: number, value: string) {
    setSelectedServices(selectedServices.map(s => s.id === id ? { ...s, amount: parseInt(value) || 0 } : s));
  }

  function addMaterial() { setMaterials([...materials, { name: "", quantity: "", unit: "g", cost: "" }]); }
  function removeMaterial(i: number) { setMaterials(materials.filter((_, idx) => idx !== i)); }
  function updateMaterial(i: number, field: keyof Material, value: string) {
    setMaterials(materials.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
  }

  function toggleProduct(product: Product) {
    const exists = productUsage.find(p => p.product.id === product.id);
    if (exists) {
      setProductUsage(productUsage.filter(p => p.product.id !== product.id));
    } else {
      setProductUsage([...productUsage, { product, quantity: 1 }]);
    }
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
    alert("交易明細已建立！");
    setSelectedServices([]);
    setMaterials([{ name: "", quantity: "", unit: "g", cost: "" }]);
    setProductUsage([]);
    setSelectedBooking(null);
    setNote("");
    setTab("history");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", paddingBottom: 70 }}>
      <div style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.push("/designer/dashboard")} style={{ background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>‹</button>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>交易明細</div>
        <div style={{ marginLeft: "auto", background: "#2C2840", borderRadius: 10, padding: "4px 12px" }}>
          <div style={{ fontSize: 10, color: "#888780" }}>本月收入</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#C8C4F8" }}>${monthTotal.toLocaleString()}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, padding: "14px 16px 8px" }}>
        {[{ key: "new", label: "新增明細" }, { key: "history", label: "交易紀錄" }].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as "new" | "history")} style={{ padding: "6px 16px", borderRadius: 20, border: "none", background: tab === t.key ? "#534AB7" : "#fff", color: tab === t.key ? "#fff" : "#5F5E5A", fontSize: 12, fontWeight: tab === t.key ? 600 : 400, cursor: "pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 16px 32px" }}>
        {tab === "new" ? (
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
                                <div style={{ padding: "6px 12px 10px", background: cat.color, borderTop: `0.5px solid ${cat.text_color}20` }}>
                                  <div style={{ fontSize: 11, color: "#888780", marginBottom: 4 }}>實際收費金額</div>
                                  <input value={picked.amount || ""} onChange={(e) => updateAmount(svc.id, e.target.value)} placeholder="輸入金額" type="number" style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
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

            {/* 自領材料 */}
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
        ) : (
          <>
            <div style={{ background: "#2C2840", borderRadius: 14, padding: "14px 16px", marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>本月總收入</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#C8C4F8" }}>${monthTotal.toLocaleString()}</div>
            </div>
            {history.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#888780", fontSize: 14 }}>尚無交易紀錄</div>
            ) : (
              history.map((t: any) => (
                <div key={t.id} style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 8, border: "0.5px solid #D3D1C7" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#2C2C2A" }}>{t.customer_name}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#534AB7" }}>${t.total_amount?.toLocaleString()}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#888780" }}>{t.created_at?.slice(0, 10).replace(/-/g, "/")}</div>
                  {t.service_items && (
                    <div style={{ fontSize: 11, color: "#5F5E5A", marginTop: 4 }}>
                      {t.service_items.map((s: any) => `${s.name} $${s.amount}`).join("、")}
                    </div>
                  )}
                  {t.note && <div style={{ fontSize: 11, color: "#888780", marginTop: 4 }}>備註：{t.note}</div>}
                </div>
              ))
            )}
          </>
        )}
      </div>
      <BottomNav current="transaction" />
    </div>
  );
}
