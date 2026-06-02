"use client";
import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminBottomNav from "../components/BottomNav";

type Designer = {
  id: number;
  name: string;
  display_name: string;
  nickname: string;
  commission_rate: number;
  commission_base_deduction: number;
  product_commission_rate: number;
  discount_absorption: number;
  avatar_url: string;
  bg_color: string;
  text_color: string;
  initials: string;
};

type Transaction = {
  id: number;
  designer_id: number;
  customer_name: string;
  customer_phone: string;
  service_items: { id: number; name: string; amount: number; discount: number }[];
  product_items: { id: number; name: string; amount: number; quantity: number }[];
  total_amount: number;
  payment_method: string;
  created_at: string;
};

type ProductUsage = {
  id: number;
  designer_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_cost: number;
  used_at: string;
};

// 舊系統中文名 → 新系統設計師 id 對應（透過 display_name 比對，不寫死）
function findDesignerByDisplayName(designers: Designer[], displayName: string) {
  return designers.find(d => d.display_name === displayName);
}

export default function AdminReport() {
  const router = useRouter();
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [productUsages, setProductUsages] = useState<ProductUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [exportMode, setExportMode] = useState<"month" | "year" | "range">("month");
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [selectedDesigner, setSelectedDesigner] = useState<number | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  });
  const [expandedDesigner, setExpandedDesigner] = useState<number | null>(null);
  // 名字顯示模式：english = 英文名, chinese = 中文名, both = 英文（中文）
  const [nameMode, setNameMode] = useState<"english" | "chinese" | "both">("both");

  // 匯入歷史資料
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string>("");

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // 依設定顯示設計師名字
  function getDesignerLabel(d: Designer) {
    if (nameMode === "chinese") return d.display_name || d.name;
    if (nameMode === "english") return d.name;
    // both
    if (d.display_name) return `${d.display_name} ${d.name}`;
    return d.name;
  }

  // 導出 Excel 用名字（與舊系統格式一致 → 中文名）
  function getExportName(d: Designer) {
    return d.display_name || d.name;
  }

  function getCustomerNo(phone: string) {
    return (customers as any[])?.find((c: any) => c.phone === phone)?.customer_no || "-";
  }

  function getExportTransactions() {
    if (exportMode === "month") return monthlyTransactions;
    if (exportMode === "year") return transactions.filter((t: any) => t.created_at?.startsWith(String(selectedYear)));
    if (exportMode === "range" && exportStartDate && exportEndDate) {
      return transactions.filter((t: any) => t.created_at >= exportStartDate && t.created_at <= exportEndDate + "T23:59:59");
    }
    return monthlyTransactions;
  }

  function getExportLabel() {
    if (exportMode === "month") return selectedMonth;
    if (exportMode === "year") return String(selectedYear) + "年";
    if (exportMode === "range") return exportStartDate + "_" + exportEndDate;
    return selectedMonth;
  }

  // 導出 Excel — 格式與舊系統訂單列表對齊
  function exportExcel() {
    try {
      const exportTx = getExportTransactions();
      const wb = XLSX.utils.book_new();

      // ── Sheet 1：設計師抽成 ──
      const dr = designers.map((d: any) => {
        const r = calcDesignerReport(d);
        return {
          "設計師": getExportName(d),
          "服務業績": r.serviceRevenue,
          "底扣金額": r.baseDeduction,
          "抽成比例": Math.round((d.commission_rate||0)*100)+"%",
          "服務抽成": r.serviceCommission,
          "品牌共享費": r.brandFee,
          "應付抽成": r.totalCommission,
        };
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dr), "設計師抽成");

      // ── Sheet 2：訂單列表（對齊舊系統格式）──
      // 欄位：訂單號碼 / 訂單時間 / 分類 / 品項 / 數量 / 總價 / 折扣 / 工作人員 / 指定 / 業績 / 支付方式
      const tr: any[] = [];
      // 產生流水訂單號（模擬舊系統格式 YYMMDD + 8碼流水）
      exportTx.forEach((t: any, txIdx: number) => {
        const designer = designers.find((d: any) => d.id === t.designer_id);
        const designerLabel = designer ? getExportName(designer) : "-";
        const dateStr = t.created_at?.slice(0,10) || "";
        const timeStr = t.created_at?.slice(0,16)?.replace("T"," ") || "";
        // 訂單號：YYMMDD + 8位流水（與舊系統相容）
        const orderNo = dateStr.replace(/-/g,"").slice(2) + String(txIdx+1).padStart(8,"0");
        const payMethod = t.payment_method ? `${t.payment_method}：${t.total_amount}` : "";

        const allItems = [
          ...(t.service_items||[]).map((s: any) => ({
            category: "服務",
            name: s.name,
            qty: 1,
            price: s.amount,
            discount: s.discount || 0,
            performance: s.amount || 0,
          })),
          ...(t.product_items||[]).map((p: any) => ({
            category: "商品",
            name: p.name,
            qty: p.quantity || 1,
            price: p.amount,
            discount: 0,
            performance: 0,
          })),
        ];

        if (allItems.length === 0) {
          tr.push({
            "訂單號碼": orderNo,
            "訂單時間": timeStr,
            "分類": "-",
            "品項": "-",
            "數量": "",
            "總價": t.total_amount,
            "折扣": "",
            "工作人員": designerLabel,
            "指定": "-",
            "業績": t.total_amount,
            "支付方式": payMethod,
          });
        } else {
          allItems.forEach((item: any, idx: number) => {
            tr.push({
              "訂單號碼": idx === 0 ? orderNo : "",
              "訂單時間": idx === 0 ? timeStr : "",
              "分類": item.category,
              "品項": item.name,
              "數量": item.qty,
              "總價": item.price,
              "折扣": item.discount || "",
              "工作人員": designerLabel,
              "指定": "-",
              "業績": item.performance,
              "支付方式": idx === 0 ? payMethod : "",
            });
          });
        }
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tr), "訂單列表");

      // ── Sheet 3：年度統計 ──
      const yr = yearlyData.map(([month, amount]: any) => ({ "月份": month, "總業績": amount }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(yr), "年度統計");

      XLSX.writeFile(wb, "BC_報表_" + getExportLabel() + ".xlsx");
    } catch(e) {
      alert("Excel 導出失敗");
    }
  }

  // ── 匯入舊系統歷史資料 ──
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult("");

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

      // 跳過標題列
      const dataRows = rows.slice(1).filter((r: any) => r.some((c: any) => c !== ""));

      // 整理成以訂單號為 key 的 map
      const orderMap: Record<string, {
        orderNo: string;
        orderTime: string;
        designerName: string;
        payMethod: string;
        items: { category: string; name: string; qty: number; price: number; discount: number; performance: number; designated: string }[];
      }> = {};

      let currentOrderNo = "";
      let currentOrderTime = "";
      let currentDesigner = "";
      let currentPay = "";

      for (const row of dataRows) {
        const [orderNo, orderTime, category, itemName, qty, price, discount, worker, designated, performance, payMethod] = row;
        if (orderNo) {
          currentOrderNo = String(orderNo);
          currentOrderTime = String(orderTime || "");
          currentDesigner = String(worker || "");
          currentPay = String(payMethod || "");
          orderMap[currentOrderNo] = {
            orderNo: currentOrderNo,
            orderTime: currentOrderTime,
            designerName: currentDesigner,
            payMethod: currentPay,
            items: [],
          };
        }
        if (currentOrderNo && itemName) {
          orderMap[currentOrderNo].items.push({
            category: String(category || ""),
            name: String(itemName || ""),
            qty: Number(qty) || 1,
            price: Number(price) || 0,
            discount: Number(discount) || 0,
            performance: Number(performance) || 0,
            designated: String(designated || ""),
          });
          // 更新設計師名（多項目時後面列可能為空）
          if (worker) {
            orderMap[currentOrderNo].designerName = String(worker);
          }
        }
      }

      // 轉換成 transactions 格式並寫入
      let successCount = 0;
      let skipCount = 0;
      const errors: string[] = [];

      for (const order of Object.values(orderMap)) {
        // 找設計師
        const designer = findDesignerByDisplayName(designers, order.designerName);
        if (!designer) {
          skipCount++;
          errors.push(`找不到設計師「${order.designerName}」，跳過訂單 ${order.orderNo}`);
          continue;
        }

        // 解析時間 "2026-01-01 12:53" → ISO
        const createdAt = order.orderTime.replace(" ", "T") + ":00";

        // 商品品牌關鍵字
        const productBrands = ["Oright", "O'right", "Sumuzu", "哥德式", "善詩", "威傑式", "沂樂"];
        const isProduct = (name: string, category: string) => {
          if (category && !category.startsWith("美髮")) return true;
          return productBrands.some(b => name.includes(b));
        };
        // 所有品項合併進 service_items（一張訂單一筆）
        const serviceItems = order.items.map((i: any) => ({
          name: isProduct(i.name, i.category) ? `[商品] ${i.name}` : i.name,
          amount: i.performance > 0 ? i.performance : i.price,
          discount: i.discount || 0,
        }));

        // 總金額：從支付方式欄解析（如「現金：2700」）
        let totalAmount = 0;
        const payStr = order.payMethod.trim();
        const payMatch = payStr.match(/[：:]\s*(\d+)/);
        if (payMatch) {
          totalAmount = parseInt(payMatch[1]);
        } else {
          // 若無支付方式欄，用業績加總
          totalAmount = order.items.reduce((s: number, i: any) => s + (i.performance > 0 ? i.performance : i.price), 0);
        }

        // 支付方式文字（去掉金額部分）
        const payMethod = payStr.replace(/[：:]\s*\d+[\s\S]*/, "").trim() || "現金";

        const txData = {
          designer_id: designer.id,
          customer_name: "",
          service_items: serviceItems,
          total_amount: totalAmount,
          payment_method: payMethod,
          created_at: createdAt,
        };

        const { error } = await supabase.from("transactions").insert(txData);
        if (error) {
          errors.push(`訂單 ${order.orderNo} 寫入失敗：${error.message}`);
        } else {
          successCount++;
        }
      }

      // 重新載入資料
      const { data: tData } = await supabase.from("transactions").select("*").order("created_at", { ascending: false });
      if (tData) setTransactions(tData);

      let msg = `匯入完成：${successCount} 筆成功`;
      if (skipCount > 0) msg += `，${skipCount} 筆跳過（找不到設計師）`;
      if (errors.length > 0) msg += `\n\n錯誤：\n` + errors.slice(0,5).join("\n");
      setImportResult(msg);
    } catch (err: any) {
      setImportResult("匯入失敗：" + err.message);
    }
    setImporting(false);
    e.target.value = "";
  }

  useEffect(() => {
    const session = sessionStorage.getItem("adminSession");
    if (!session) { router.push("/admin/login"); return; }

    async function fetchData() {
      const [{ data: dData }, { data: pData }, { data: cData }] = await Promise.all([
        supabase.from("designers").select("*").order("id"),
        supabase.from("product_usage").select("*").order("used_at", { ascending: false }),
        supabase.from("customers").select("id, phone, customer_no"),
      ]);
      if (dData) setDesigners(dData);
      if (pData) setProductUsages(pData);
      if (cData) setCustomers(cData);

      // 分頁載入所有 transactions
      let allTransactions: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data: tPage } = await supabase
          .from("transactions")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);
        if (!tPage || tPage.length === 0) break;
        allTransactions = [...allTransactions, ...tPage];
        if (tPage.length < pageSize) break;
        from += pageSize;
      }
      setTransactions(allTransactions);
      setLoading(false);
    }
    fetchData();
  }, [router]);

  const availableYears = (() => {
    const years = new Set<number>();
    transactions.forEach(t => {
      const y = parseInt(t.created_at?.slice(0, 4) || "0");
      if (y > 2020) years.add(y);
    });
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  })();

  const monthlyTransactions = transactions.filter(t => {
    const m = t.created_at?.slice(0, 7);
    return m === selectedMonth;
  });
  if (typeof window !== "undefined") {
    console.log("selectedMonth:", selectedMonth, "total tx:", transactions.length, "monthly:", monthlyTransactions.length, "sample:", transactions.slice(0,2).map(t => t.created_at));
  }

  function calcDesignerReport(d: Designer) {
    const dTransactions = monthlyTransactions.filter(t => t.designer_id === d.id);
    const serviceRevenue = dTransactions.reduce((sum, t) => sum + (t.total_amount || 0), 0);
    const baseDeduction = d.commission_base_deduction || 0;
    const commissionBase = Math.max(0, serviceRevenue - baseDeduction);
    const serviceCommission = Math.round(commissionBase * (d.commission_rate || 0));
    const brandFeeRate = (d as any).brand_fee_rate || 0;
    const brandFee = Math.round(serviceRevenue * brandFeeRate);
    const totalCommission = Math.max(0, serviceCommission - brandFee);
    return {
      serviceRevenue, baseDeduction, commissionBase,
      serviceCommission, brandFee, brandFeeRate, totalCommission,
      transactionCount: dTransactions.length,
      transactions: dTransactions,
    };
  }

  const yearlyData = (() => {
    const months: Record<string, number> = {};
    for (let m = 1; m <= 12; m++) {
      const key = `${selectedYear}-${String(m).padStart(2,"0")}`;
      months[key] = 0;
    }
    transactions.forEach(t => {
      const month = t.created_at?.slice(0, 7);
      if (month && month.startsWith(String(selectedYear))) {
        months[month] = (months[month] || 0) + (t.total_amount || 0);
      }
    });
    return Object.entries(months).sort((a, b) => a[0].localeCompare(b[0]));
  })();

  const yearTotal = yearlyData.reduce((sum, [, v]) => sum + v, 0);
  const maxMonthly = Math.max(...yearlyData.map(([, v]) => v), 1);
  const monthTotalRevenue = monthlyTransactions.reduce((sum, t) => sum + (t.total_amount || 0), 0);
  const monthTotalCommission = designers.reduce((sum, d) => sum + calcDesignerReport(d).totalCommission, 0);
  const serviceColors = ["#534AB7","#7B6FD4","#1D9E75","#BA7517","#E24B4A","#0C447C","#085041","#A32D2D","#633806","#3C3489"];

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#534AB7", fontSize: 14 }}>載入中...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", paddingBottom: 70, paddingLeft: isDesktop ? 220 : 0 }}>
      <div style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>收入報表</div>
        <div style={{ fontSize: 12, color: "#888780" }}>{selectedMonth.replace("-", " 年 ")} 月</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setShowImport(!showImport)} style={{ background: "#BA7517", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>匯入歷史</button>
          <button onClick={() => setShowExportPanel(!showExportPanel)} style={{ background: "#1D9E75", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>導出 Excel ▼</button>
        </div>
      </div>

      <div style={{ padding: 16 }}>

        {/* 匯入歷史資料面板 */}
        {showImport && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, border: "0.5px solid #BA7517" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A", marginBottom: 6 }}>匯入舊系統訂單列表</div>
            <div style={{ fontSize: 11, color: "#888780", marginBottom: 10, lineHeight: 1.6 }}>
              上傳從舊系統導出的「訂單列表.xlsx」<br/>
              欄位需包含：訂單號碼、訂單時間、分類、品項、數量、總價、折扣、工作人員、指定、業績、支付方式
            </div>
            {/* 名字顯示切換也放這裡方便對照 */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "#888780", marginBottom: 6 }}>系統內設計師名字顯示方式</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[{ key: "both", label: "中英並列" }, { key: "chinese", label: "中文" }, { key: "english", label: "英文" }].map(m => (
                  <button key={m.key} onClick={() => setNameMode(m.key as any)} style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: "none", background: nameMode === m.key ? "#534AB7" : "#F1EFE8", color: nameMode === m.key ? "#fff" : "#5F5E5A", fontSize: 11, fontWeight: nameMode === m.key ? 600 : 400, cursor: "pointer" }}>{m.label}</button>
                ))}
              </div>
            </div>
            <label style={{ display: "block", width: "100%", padding: "10px 0", background: importing ? "#D3D1C7" : "#FAEEDA", color: importing ? "#888" : "#BA7517", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: importing ? "default" : "pointer", textAlign: "center" }}>
              {importing ? "匯入中..." : "選擇 .xlsx 檔案上傳"}
              <input type="file" accept=".xlsx" onChange={handleImport} style={{ display: "none" }} disabled={importing} />
            </label>
            {importResult && (
              <div style={{ marginTop: 10, padding: "10px 12px", background: importResult.includes("失敗") || importResult.includes("錯誤") ? "#FCEBEB" : "#E1F5EE", borderRadius: 8, fontSize: 12, color: importResult.includes("失敗") || importResult.includes("錯誤") ? "#A32D2D" : "#085041", whiteSpace: "pre-wrap" }}>
                {importResult}
              </div>
            )}
          </div>
        )}

        {/* 導出面板 */}
        {showExportPanel && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, border: "0.5px solid #1D9E75" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A", marginBottom: 10 }}>選擇導出範圍</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {[{ key: "month", label: "月份" }, { key: "year", label: "年度" }, { key: "range", label: "自訂區間" }].map(m => (
                <button key={m.key} onClick={() => setExportMode(m.key as any)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", background: exportMode === m.key ? "#1D9E75" : "#F1EFE8", color: exportMode === m.key ? "#fff" : "#5F5E5A", fontSize: 12, fontWeight: exportMode === m.key ? 600 : 400, cursor: "pointer" }}>{m.label}</button>
              ))}
            </div>
            {exportMode === "month" && (
              <div style={{ fontSize: 12, color: "#888780" }}>導出月份：{selectedMonth}（可在上方月份圖表點選切換）</div>
            )}
            {exportMode === "year" && (
              <div style={{ fontSize: 12, color: "#888780" }}>導出年度：{selectedYear} 年（可在上方年度按鈕切換）</div>
            )}
            {exportMode === "range" && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="date" value={exportStartDate} onChange={e => setExportStartDate(e.target.value)} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none" }} />
                <span style={{ color: "#888780" }}>至</span>
                <input type="date" value={exportEndDate} onChange={e => setExportEndDate(e.target.value)} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none" }} />
              </div>
            )}
            {/* 導出名字格式說明 */}
            <div style={{ fontSize: 11, color: "#888780", marginTop: 10, background: "#F1EFE8", borderRadius: 8, padding: "6px 10px" }}>
              導出表格工作人員欄位將使用中文名（與舊系統格式一致）
            </div>
            <button onClick={() => { exportExcel(); setShowExportPanel(false); }} style={{ width: "100%", padding: "10px 0", background: "#1D9E75", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 12 }}>
              確認導出 Excel
            </button>
          </div>
        )}

        {/* 年度選擇 */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {availableYears.map(y => (
            <button key={y} onClick={() => { setSelectedYear(y); setSelectedMonth(`${y}-${selectedMonth.slice(5)}`); }} style={{ padding: "5px 14px", borderRadius: 20, border: "none", background: selectedYear === y ? "#534AB7" : "#fff", color: selectedYear === y ? "#fff" : "#5F5E5A", fontSize: 12, fontWeight: selectedYear === y ? 600 : 400, cursor: "pointer" }}>
              {y}
            </button>
          ))}
        </div>

        {/* 年度長條圖 */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, border: "0.5px solid #D3D1C7" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A", marginBottom: 12 }}>{selectedYear} 年度總覽</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 100, marginBottom: 8 }}>
            {yearlyData.map(([month, amount]) => (
              <div key={month} onClick={() => setSelectedMonth(month)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer" }}>
                <div style={{ width: "100%", background: selectedMonth === month ? "#534AB7" : "#AFA9EC", borderRadius: "4px 4px 0 0", height: `${Math.max((amount / maxMonthly) * 85, 2)}px`, transition: "height 0.3s" }} />
                <div style={{ fontSize: 8, color: selectedMonth === month ? "#534AB7" : "#888780", fontWeight: selectedMonth === month ? 700 : 400 }}>{month.slice(5)}月</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "0.5px solid #F1EFE8" }}>
            <span style={{ fontSize: 12, color: "#888780" }}>年度總業績</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#534AB7" }}>${yearTotal.toLocaleString()}</span>
          </div>
        </div>

        {/* 月份摘要 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          <div style={{ background: "#2C2840", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11, color: "#888780" }}>本月總業績</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#C8C4F8", marginTop: 4 }}>${monthTotalRevenue.toLocaleString()}</div>
          </div>
          <div style={{ background: "#1A3328", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11, color: "#888780" }}>本月總抽成</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#6DDBB4", marginTop: 4 }}>${monthTotalCommission.toLocaleString()}</div>
          </div>
        </div>

        {/* 名字顯示切換（右上角小按鈕） */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8, gap: 4 }}>
          <span style={{ fontSize: 11, color: "#888780", alignSelf: "center" }}>顯示名字：</span>
          {[{ key: "both", label: "中英" }, { key: "chinese", label: "中" }, { key: "english", label: "英" }].map(m => (
            <button key={m.key} onClick={() => setNameMode(m.key as any)} style={{ padding: "3px 8px", borderRadius: 6, border: "none", background: nameMode === m.key ? "#534AB7" : "#fff", color: nameMode === m.key ? "#fff" : "#5F5E5A", fontSize: 11, cursor: "pointer", fontWeight: nameMode === m.key ? 600 : 400 }}>{m.label}</button>
          ))}
        </div>

        {/* 設計師業績圓餅圖 */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, border: "0.5px solid #D3D1C7" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A", marginBottom: 14 }}>
            {selectedDesigner === null
              ? `${selectedMonth.replace("-", " 年 ")} 月設計師業績`
              : `${getDesignerLabel(designers.find(d => d.id === selectedDesigner)!)} 服務項目`}
          </div>

          {selectedDesigner === null ? (
            <div>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                <svg width="400" height="400" viewBox="-70 -70 400 400">
                  {(() => {
                    let cumulative = 0;
                    const total = designers.reduce((sum, d) => sum + calcDesignerReport(d).serviceRevenue, 0);
                    if (total === 0) return null;
                    return designers.filter(d => calcDesignerReport(d).serviceRevenue > 0).map((d, i) => {
                      const amount = calcDesignerReport(d).serviceRevenue;
                      const pct = amount / total;
                      const startAngle = cumulative * 2 * Math.PI - Math.PI / 2;
                      cumulative += pct;
                      const endAngle = cumulative * 2 * Math.PI - Math.PI / 2;
                      const midAngle = (startAngle + endAngle) / 2;
                      const r = 90, cx = 130, cy = 130;
                      const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
                      const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
                      const largeArc = pct > 0.5 ? 1 : 0;
                      const path = pct >= 1
                        ? `M ${cx} ${cy} m -${r} 0 a ${r} ${r} 0 1 1 ${r*2} 0 a ${r} ${r} 0 1 1 -${r*2} 0`
                        : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                      const labelR = r + 22;
                      const lx = cx + labelR * Math.cos(midAngle), ly = cy + labelR * Math.sin(midAngle);
                      return (
                        <g key={d.id} onClick={() => setSelectedDesigner(d.id)} style={{ cursor: "pointer" }}>
                          <path d={path} fill={serviceColors[i % serviceColors.length]} stroke="#fff" strokeWidth="2" />
                          {pct >= 0.03 && (
                            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="600" fill={serviceColors[i % serviceColors.length]}>
                              <tspan x={lx} dy="-5">{getDesignerLabel(d).slice(0, 5)}</tspan>
                              <tspan x={lx} dy="12">${(amount/1000).toFixed(1)}k</tspan>
                            </text>
                          )}
                        </g>
                      );
                    });
                  })()}
                  <circle cx="130" cy="130" r="48" fill="#fff" />
                  <text x="130" y="124" textAnchor="middle" fontSize="11" fill="#888780">總業績</text>
                  <text x="130" y="142" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#534AB7">${(monthTotalRevenue/1000).toFixed(1)}k</text>
                </svg>
              </div>
              <div style={{ fontSize: 11, color: "#888780", textAlign: "center", marginBottom: 10 }}>點選設計師查看服務明細</div>
              {designers.filter(d => calcDesignerReport(d).serviceRevenue > 0).map((d, i) => (
                <div key={d.id} onClick={() => setSelectedDesigner(d.id)} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer", padding: "6px 8px", borderRadius: 8, background: "#F1EFE8" }}>
                  <div style={{ width: 14, height: 14, borderRadius: 4, background: serviceColors[i % serviceColors.length], flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 13, color: "#2C2C2A", fontWeight: 500 }}>{getDesignerLabel(d)}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: serviceColors[i % serviceColors.length] }}>${calcDesignerReport(d).serviceRevenue.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: "#888780", background: "#fff", borderRadius: 6, padding: "1px 6px" }}>
                    {Math.round((calcDesignerReport(d).serviceRevenue / monthTotalRevenue) * 100)}%
                  </div>
                  <span style={{ fontSize: 11, color: "#888780" }}>→</span>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <button onClick={() => setSelectedDesigner(null)} style={{ background: "#F1EFE8", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer", marginBottom: 12, color: "#534AB7" }}>← 返回總覽</button>
              {(() => {
                const dTx = monthlyTransactions.filter((t: any) => t.designer_id === selectedDesigner);
                const stats: Record<string, number> = {};
                function getCategory(name: string): string {
                  if (name.startsWith("[商品]")) return "商品";
                  if (/剪髮|單剪/.test(name)) return "剪髮";
                  if (/燙|髮根燙/.test(name)) return "燙髮";
                  if (/染|補染/.test(name)) return "染髮";
                  if (/護髮/.test(name)) return "護髮";
                  if (/洗髮|髮浴洗/.test(name)) return "洗髮";
                  if (/頭皮/.test(name)) return "頭皮";
                  return "商品";
                }
                dTx.forEach((t: any) => {
                  (t.service_items || []).forEach((s: any) => {
                    if (s.name) {
                      const cat = getCategory(s.name);
                      stats[cat] = (stats[cat] || 0) + (s.amount || 0);
                    }
                  });
                });
                const entries = Object.entries(stats).sort((a, b) => b[1] - a[1]);
                const total = entries.reduce((sum, [, v]) => sum + v, 0);
                if (entries.length === 0) return <div style={{ textAlign: "center", padding: 20, color: "#888780" }}>本月無服務紀錄</div>;
                let cumulative = 0;
                return (
                  <div>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                      <svg width="400" height="400" viewBox="-70 -70 400 400">
                        {(() => {
                          const r = 90, cx = 130, cy = 130;
                          let cum = 0;
                          const slices = entries.map(([name, amount], i) => {
                            const pct = amount / total;
                            const startAngle = cum * 2 * Math.PI - Math.PI / 2;
                            cum += pct;
                            const endAngle = cum * 2 * Math.PI - Math.PI / 2;
                            const midAngle = (startAngle + endAngle) / 2;
                            const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
                            const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
                            const largeArc = pct > 0.5 ? 1 : 0;
                            const dPath = pct >= 1
                              ? `M ${cx} ${cy} m -${r} 0 a ${r} ${r} 0 1 1 ${r*2} 0 a ${r} ${r} 0 1 1 -${r*2} 0`
                              : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                            const outerR = r + 16;
                            const lx1 = cx + (r + 2) * Math.cos(midAngle);
                            const ly1 = cy + (r + 2) * Math.sin(midAngle);
                            const lx2 = cx + outerR * Math.cos(midAngle);
                            const ly2 = cy + outerR * Math.sin(midAngle);
                            const isRight = Math.cos(midAngle) >= 0;
                            return { name, amount, pct, i, dPath, lx1, ly1, lx2, ly2, isRight, midAngle };
                          });
                          // 先依區塊實際位置決定左右
                          // 若某邊超過一半數量，把最小的區塊換到另一邊
                          const minGap = 24;
                          const rebalance = () => {
                            const rightCount = slices.filter(s => s.isRight).length;
                            const leftCount = slices.length - rightCount;
                            const half = Math.ceil(slices.length / 2);
                            if (rightCount > half) {
                              // 右邊太多，把右邊最小的移到左邊
                              const rightSlices = slices.filter(s => s.isRight).sort((a, b) => a.pct - b.pct);
                              for (let k = 0; k < rightCount - half; k++) rightSlices[k].isRight = false;
                            } else if (leftCount > half) {
                              // 左邊太多，把左邊最小的移到右邊
                              const leftSlices = slices.filter(s => !s.isRight).sort((a, b) => a.pct - b.pct);
                              for (let k = 0; k < leftCount - half; k++) leftSlices[k].isRight = true;
                            }
                          };
                          rebalance();
                          const spreadY = (group: typeof slices) => {
                            group.sort((a, b) => a.ly2 - b.ly2);
                            for (let pass = 0; pass < 20; pass++) {
                              for (let k = 1; k < group.length; k++) {
                                if (group[k].ly2 - group[k-1].ly2 < minGap) {
                                  const mid = (group[k-1].ly2 + group[k].ly2) / 2;
                                  group[k-1].ly2 = mid - minGap / 2;
                                  group[k].ly2 = mid + minGap / 2;
                                }
                              }
                            }
                          };
                          spreadY(slices.filter(s => s.isRight));
                          spreadY(slices.filter(s => !s.isRight));
                          const edgeX = 56; // 標籤統一對齊到左右邊緣
                          return slices.map(({ name, amount, i, dPath, lx1, ly1, lx2, ly2, isRight }) => {
                            const lx3 = isRight ? cx + r + 46 : cx - r - 46;
                            const anchor = isRight ? "start" : "end";
                            const textX = isRight ? lx3 + 3 : lx3 - 3;
                            return (
                              <g key={name}>
                                <path d={dPath} fill={serviceColors[i % serviceColors.length]} stroke="#fff" strokeWidth="2" />
                                <polyline
                                  points={`${lx1},${ly1} ${lx2},${ly2} ${lx3},${ly2}`}
                                  fill="none"
                                  stroke={serviceColors[i % serviceColors.length]}
                                  strokeWidth="1"
                                />
                                <text x={textX} y={ly2} textAnchor={anchor} dominantBaseline="middle" fontSize="9" fontWeight="600" fill={serviceColors[i % serviceColors.length]}>
                                  <tspan x={textX} dy="-5">{name}</tspan>
                                  <tspan x={textX} dy="13">${amount.toLocaleString()}</tspan>
                                </text>
                              </g>
                            );
                          });
                        })()}
                        <circle cx="130" cy="130" r="48" fill="#fff" />
                        <text x="130" y="124" textAnchor="middle" fontSize="11" fill="#888780">總計</text>
                        <text x="130" y="142" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#534AB7">${(total/1000).toFixed(1)}k</text>
                      </svg>
                    </div>
                    {entries.map(([name, amount], i) => (
                      <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: serviceColors[i % serviceColors.length], flexShrink: 0 }} />
                        <div style={{ flex: 1, fontSize: 12, color: "#2C2C2A" }}>{name}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: serviceColors[i % serviceColors.length] }}>${amount.toLocaleString()}</div>
                        <div style={{ fontSize: 11, color: "#888780", background: "#F1EFE8", borderRadius: 6, padding: "1px 6px" }}>{Math.round((amount / total) * 100)}%</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* 各設計師報表 */}
        <div style={{ fontSize: 12, fontWeight: 600, color: "#888780", marginBottom: 8 }}>各設計師明細</div>
        {designers.filter(d => d.id !== undefined).map((d) => {
          const report = calcDesignerReport(d);
          const isExpanded = expandedDesigner === d.id;
          return (
            <div key={d.id} style={{ background: "#fff", borderRadius: 14, marginBottom: 10, border: "0.5px solid #D3D1C7", overflow: "hidden" }}>
              <div onClick={() => setExpandedDesigner(isExpanded ? null : d.id)} style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: d.bg_color, color: d.text_color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0, overflow: "hidden" }}>
                  {d.avatar_url ? <img src={d.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : d.initials}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#2C2C2A" }}>{getDesignerLabel(d)}</div>
                  <div style={{ fontSize: 11, color: "#888780" }}>業績 ${report.serviceRevenue.toLocaleString()} ・ {report.transactionCount} 筆</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#534AB7" }}>${report.totalCommission.toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: "#888780" }}>應付抽成</div>
                </div>
                <div style={{ fontSize: 12, color: "#888780", marginLeft: 4 }}>{isExpanded ? "▲" : "▼"}</div>
              </div>

              {isExpanded && (
                <div style={{ borderTop: "0.5px solid #F1EFE8", padding: "12px 14px", background: "#FAFAF8" }}>
                  <div style={{ background: "#fff", borderRadius: 10, padding: 12, marginBottom: 10, border: "0.5px solid #D3D1C7" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#2C2C2A", marginBottom: 8 }}>抽成計算</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "#5F5E5A" }}>服務業績</span>
                        <span style={{ color: "#2C2C2A", fontWeight: 500 }}>${report.serviceRevenue.toLocaleString()}</span>
                      </div>
                      {report.baseDeduction > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <span style={{ color: "#5F5E5A" }}>底扣金額</span>
                          <span style={{ color: "#A32D2D" }}>-${report.baseDeduction.toLocaleString()}</span>
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "#5F5E5A" }}>計算基礎</span>
                        <span style={{ color: "#2C2C2A" }}>${report.commissionBase.toLocaleString()}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "#5F5E5A" }}>服務抽成 ({Math.round((d.commission_rate || 0) * 100)}%)</span>
                        <span style={{ color: "#534AB7", fontWeight: 500 }}>+${report.serviceCommission.toLocaleString()}</span>
                      </div>
                      {report.brandFee > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <span style={{ color: "#5F5E5A" }}>品牌共享費 ({Math.round(report.brandFeeRate * 100)}%)</span>
                          <span style={{ color: "#BA7517" }}>-${report.brandFee.toLocaleString()}</span>
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, paddingTop: 6, borderTop: "0.5px solid #F1EFE8", marginTop: 2 }}>
                        <span style={{ color: "#2C2C2A" }}>應付抽成</span>
                        <span style={{ color: "#534AB7" }}>${report.totalCommission.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {report.transactions.length > 0 && (
                    <div style={{ background: "#fff", borderRadius: 10, padding: 12, border: "0.5px solid #D3D1C7" }}>
                      {report.transactions.map((t: any) => (
                        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "0.5px solid #F1EFE8", overflowX: "auto", whiteSpace: "nowrap" }}>
                          <span style={{ fontSize: 11, color: "#888780", flexShrink: 0 }}>{t.created_at?.slice(0, 10).replace(/-/g, "/")} {t.created_at?.slice(11, 16)}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#2C2C2A", flexShrink: 0 }}>{t.customer_name || "—"}</span>
                          <span style={{ fontSize: 11, color: "#5F5E5A", flexShrink: 0 }}>{t.service_items?.map((s: any) => s.name + " $" + s.amount?.toLocaleString()).join(" ・ ")}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#534AB7", flexShrink: 0 }}>${t.total_amount?.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AdminBottomNav current="report" />
    </div>
  );
}
