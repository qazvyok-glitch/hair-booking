"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminBottomNav from "../components/BottomNav";

type Product = { id: number; name: string; unit: string; unit_price: number; category: string; is_active: boolean; stock_quantity: number; barcode: string };
type StockRecord = { id: number; product_id: number; product_name: string; quantity: number; type: string; note: string; created_at: string };

export default function AdminInventory() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [records, setRecords] = useState<StockRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [tab, setTab] = useState<"stock" | "records" | "scan">("stock");
  const [showForm, setShowForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustType, setAdjustType] = useState<"in" | "adjust">("in");
  const [adjustNote, setAdjustNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState("");
  const [showBarcodeEdit, setShowBarcodeEdit] = useState<number | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const scannerRef = useRef<any>(null);
  const scanDivRef = useRef<HTMLDivElement>(null);

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
    const [{ data: pData }, { data: rData }] = await Promise.all([
      supabase.from("products").select("*").order("category").order("sort_order"),
      supabase.from("stock_records").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    if (pData) setProducts(pData);
    if (rData) setRecords(rData);
    setLoading(false);
  }

  const categories = [...new Set(products.map(p => p.category))].filter(Boolean);
  const filtered = products.filter(p => {
    if (filterCategory !== "all" && p.category !== filterCategory) return false;
    if (search && !p.name.includes(search) && !(p.barcode||"").includes(search)) return false;
    return true;
  });

  function openAdjust(p: Product, type: "in" | "adjust") {
    setSelectedProduct(p);
    setAdjustType(type);
    setAdjustQty("");
    setAdjustNote("");
    setShowForm(true);
  }

  async function handleAdjust() {
    if (!selectedProduct || !adjustQty) { alert("請填寫數量"); return; }
    setSaving(true);
    const qty = parseInt(adjustQty);
    const newStock = adjustType === "in"
      ? (selectedProduct.stock_quantity || 0) + qty
      : qty;

    await supabase.from("products").update({ stock_quantity: newStock }).eq("id", selectedProduct.id);
    await supabase.from("stock_records").insert({
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      quantity: adjustType === "in" ? qty : newStock - (selectedProduct.stock_quantity || 0),
      type: adjustType,
      note: adjustNote,
    });

    setProducts(products.map(p => p.id === selectedProduct.id ? { ...p, stock_quantity: newStock } : p));
    setSaving(false);
    setShowForm(false);
  }

  async function saveBarcode(productId: number) {
    await supabase.from("products").update({ barcode: barcodeInput }).eq("id", productId);
    setProducts(products.map(p => p.id === productId ? { ...p, barcode: barcodeInput } : p));
    setShowBarcodeEdit(null);
    setBarcodeInput("");
  }

  async function startScanner() {
    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("scanner-div");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText: string) => {
          setScanResult(decodedText);
          scanner.stop();
          setScanning(false);
          // 找到對應商品
          const found = products.find(p => p.barcode === decodedText);
          if (found) {
            setSelectedProduct(found);
            setAdjustType("in");
            setAdjustQty("");
            setShowForm(true);
          } else {
            alert("找不到條碼對應的商品：" + decodedText);
          }
        },
        () => {}
      );
    } catch(e) {
      alert("無法啟動相機，請確認已授權相機權限");
      setScanning(false);
    }
  }

  async function stopScanner() {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch(e) {}
    }
    setScanning(false);
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#534AB7", fontSize: 14 }}>載入中...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", paddingBottom: 70, paddingLeft: isDesktop ? 220 : 0 }}>
      <div style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>庫存管理</div>
        <button onClick={startScanner} style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>📷 掃條碼</button>
      </div>

      {/* 掃碼器 */}
      {scanning && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div id="scanner-div" style={{ width: 300, height: 300 }} ref={scanDivRef} />
          <button onClick={stopScanner} style={{ marginTop: 20, background: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontSize: 14, cursor: "pointer" }}>取消掃描</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, padding: "12px 16px 8px" }}>
        {[{ key: "stock", label: "庫存清單" }, { key: "records", label: "進出記錄" }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} style={{ flex: 1, padding: "6px 0", borderRadius: 20, border: "none", background: tab === t.key ? "#534AB7" : "#fff", color: tab === t.key ? "#fff" : "#5F5E5A", fontSize: 12, fontWeight: tab === t.key ? 600 : 400, cursor: "pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 16px 16px" }}>
        {tab === "stock" && (
          <>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋商品名稱或條碼..." style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 10 }} />
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
                      {["商品名稱", "分類", "條碼", "庫存", "單位", "售價", "操作"].map(h => (
                        <th key={h} style={{ padding: "10px 12px", fontSize: 12, color: "#888780", fontWeight: 600, textAlign: "left", borderBottom: "0.5px solid #D3D1C7" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(p => (
                      <tr key={p.id} style={{ borderBottom: "0.5px solid #F1EFE8" }}>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "#2C2C2A" }}>{p.name}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12, color: "#888780" }}>{p.category}</td>
                        <td style={{ padding: "10px 12px" }}>
                          {showBarcodeEdit === p.id ? (
                            <div style={{ display: "flex", gap: 4 }}>
                              <input value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)} placeholder="輸入條碼" style={{ width: 120, padding: "4px 8px", borderRadius: 6, border: "1px solid #D3D1C7", fontSize: 12, outline: "none" }} />
                              <button onClick={() => saveBarcode(p.id)} style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>存</button>
                              <button onClick={() => setShowBarcodeEdit(null)} style={{ background: "#F1EFE8", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>✕</button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ fontSize: 11, color: p.barcode ? "#2C2C2A" : "#D3D1C7" }}>{p.barcode || "未設定"}</span>
                              <button onClick={() => { setShowBarcodeEdit(p.id); setBarcodeInput(p.barcode||""); }} style={{ background: "#EEEDFE", color: "#534AB7", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 10, cursor: "pointer" }}>編輯</button>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: (p.stock_quantity||0) <= 2 ? "#A32D2D" : "#2C2C2A" }}>{p.stock_quantity || 0}</span>
                          {(p.stock_quantity||0) <= 2 && <span style={{ fontSize: 10, color: "#A32D2D", marginLeft: 4 }}>⚠ 低庫存</span>}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 12, color: "#888780" }}>{p.unit}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "#534AB7" }}>${p.unit_price.toLocaleString()}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={() => openAdjust(p, "in")} style={{ padding: "4px 8px", background: "#E1F5EE", color: "#085041", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>＋ 進貨</button>
                            <button onClick={() => openAdjust(p, "adjust")} style={{ padding: "4px 8px", background: "#FAEEDA", color: "#BA7517", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>盤點</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              filtered.map(p => (
                <div key={p.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, border: "0.5px solid #D3D1C7" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#2C2C2A" }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>{p.category} ・ ${p.unit_price.toLocaleString()}</div>
                      {showBarcodeEdit === p.id ? (
                        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                          <input value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)} placeholder="輸入條碼" style={{ flex: 1, padding: "4px 8px", borderRadius: 6, border: "1px solid #D3D1C7", fontSize: 12, outline: "none" }} />
                          <button onClick={() => saveBarcode(p.id)} style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>存</button>
                          <button onClick={() => setShowBarcodeEdit(null)} style={{ background: "#F1EFE8", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>✕</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                          <span style={{ fontSize: 10, color: p.barcode ? "#888780" : "#D3D1C7" }}>條碼：{p.barcode || "未設定"}</span>
                          <button onClick={() => { setShowBarcodeEdit(p.id); setBarcodeInput(p.barcode||""); }} style={{ background: "#EEEDFE", color: "#534AB7", border: "none", borderRadius: 4, padding: "1px 5px", fontSize: 9, cursor: "pointer" }}>設定</button>
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: (p.stock_quantity||0) <= 2 ? "#A32D2D" : "#534AB7" }}>{p.stock_quantity || 0}</div>
                      <div style={{ fontSize: 10, color: "#888780" }}>{p.unit}</div>
                      {(p.stock_quantity||0) <= 2 && <div style={{ fontSize: 9, color: "#A32D2D" }}>⚠ 低庫存</div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <button onClick={() => openAdjust(p, "in")} style={{ flex: 1, padding: "7px 0", background: "#E1F5EE", color: "#085041", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>＋ 進貨</button>
                    <button onClick={() => openAdjust(p, "adjust")} style={{ flex: 1, padding: "7px 0", background: "#FAEEDA", color: "#BA7517", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>盤點調整</button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {tab === "records" && (
          <>
            <div style={{ fontSize: 12, color: "#888780", marginBottom: 8 }}>最近 100 筆進出記錄</div>
            {records.map(r => (
              <div key={r.id} style={{ background: "#fff", borderRadius: 10, padding: "10px 12px", marginBottom: 6, border: "0.5px solid #D3D1C7", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: r.type === "in" ? "#E1F5EE" : r.type === "out" ? "#FCEBEB" : "#FAEEDA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 14 }}>{r.type === "in" ? "↑" : r.type === "out" ? "↓" : "⟳"}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#2C2C2A" }}>{r.product_name}</div>
                  <div style={{ fontSize: 11, color: "#888780" }}>{r.created_at?.slice(0,10).replace(/-/g,"/")} ・ {r.type === "in" ? "進貨" : r.type === "out" ? "自領" : "盤點"}</div>
                  {r.note && <div style={{ fontSize: 11, color: "#888780" }}>{r.note}</div>}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: r.type === "in" ? "#085041" : r.type === "out" ? "#A32D2D" : "#BA7517" }}>
                  {r.type === "in" ? "+" : ""}{r.quantity}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* 進貨/盤點表單 */}
      {showForm && selectedProduct && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px 16px 32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{adjustType === "in" ? "進貨" : "盤點調整"}</div>
                <div style={{ fontSize: 12, color: "#888780" }}>{selectedProduct.name}</div>
              </div>
              <button onClick={() => setShowForm(false)} style={{ background: "#F1EFE8", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer" }}>x</button>
            </div>

            <div style={{ background: "#F1EFE8", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "#888780" }}>目前庫存</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#534AB7" }}>{selectedProduct.stock_quantity || 0} {selectedProduct.unit}</span>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>
                {adjustType === "in" ? "進貨數量" : "調整後庫存數量"}
              </div>
              <input
                value={adjustQty}
                onChange={e => setAdjustQty(e.target.value)}
                type="number"
                placeholder={adjustType === "in" ? "輸入進貨數量" : "輸入實際庫存數量"}
                style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #D3D1C7", fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
              {adjustType === "in" && adjustQty && (
                <div style={{ fontSize: 11, color: "#1D9E75", marginTop: 4 }}>
                  進貨後庫存：{(selectedProduct.stock_quantity||0) + parseInt(adjustQty||"0")} {selectedProduct.unit}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>備註</div>
              <input value={adjustNote} onChange={e => setAdjustNote(e.target.value)} placeholder="供應商、批次..." style={{ width: "100%", padding: "9px 14px", borderRadius: 10, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>

            <button onClick={handleAdjust} disabled={saving} style={{ width: "100%", padding: "13px 0", background: saving ? "#D3D1C7" : adjustType === "in" ? "#1D9E75" : "#BA7517", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: saving ? "default" : "pointer" }}>
              {saving ? "儲存中..." : adjustType === "in" ? "確認進貨" : "確認盤點"}
            </button>
          </div>
        </div>
      )}

      <AdminBottomNav current="inventory" />
    </div>
  );
}
