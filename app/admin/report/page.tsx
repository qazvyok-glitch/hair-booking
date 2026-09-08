"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
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
  note?: string;
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

type StockRecord = {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  type: string;
  note: string;
  created_at: string;
};

type ShopDetailKey = "actualIncome" | "serviceRevenue" | "productRevenue" | "selfUse" | "shopUse" | "discount";
type DesignerDetailKey = Exclude<ShopDetailKey, "shopUse">;

type ReportDetailRow = {
  id: string;
  date: string;
  designerName: string;
  kind: string;
  itemName: string;
  quantity: string;
  amount: string;
  isNegative?: boolean;
};

// 舊系統中文名 → 新系統設計師 id 對應（透過 display_name 比對，不寫死）
function findDesignerByDisplayName(designers: Designer[], displayName: string) {
  return designers.find(d => d.display_name === displayName);
}

function getProductSaleTotal(transaction: Transaction) {
  const productItemsTotal = (transaction.product_items || []).reduce((sum, item: any) => sum + Number(item.amount || 0) * Number(item.quantity || 1), 0);
  const importedProductTotal = (transaction.service_items || []).reduce((sum, item: any) => item.name?.startsWith("[商品]") ? sum + Number(item.amount || 0) : sum, 0);
  const productSection = (transaction.note || "").split("客人購買商品：")[1];
  const noteTotal = productSection
    ? productSection.split("、").reduce((sum, item) => {
      const amountMatch = item.match(/小計NT\$?([\d,]+)/);
      return sum + (amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : 0);
    }, 0)
    : 0;
  return productItemsTotal + importedProductTotal + noteTotal;
}

function getTransactionDiscount(transaction: Transaction) {
  const serviceDiscount = (transaction.service_items || []).reduce((sum, item: any) => sum + Number(item.discount || 0), 0);
  const productSection = (transaction.note || "").split("客人購買商品：")[1] || "";
  const productDiscount = [...productSection.matchAll(/折扣NT\$?([\d,]+)/g)].reduce((sum, match) => sum + Number(match[1].replace(/,/g, "")), 0);
  return serviceDiscount + productDiscount;
}

function getServiceRevenue(transaction: Transaction) {
  const explicitService = (transaction.service_items || []).reduce((sum, item: any) => item.name?.startsWith("[商品]") ? sum : sum + Number(item.amount || 0), 0);
  if (explicitService > 0) return explicitService;
  return Math.max(0, Number(transaction.total_amount || 0) - getProductSaleTotal(transaction));
}

function formatReportDate(dateString?: string) {
  if (!dateString) return "-";
  return dateString.slice(0, 10).replace(/-/g, "/");
}

function formatMoney(amount: number, negative = false) {
  const prefix = negative ? "-NT$" : "NT$";
  return `${prefix}${Math.abs(amount).toLocaleString()}`;
}

function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getProductSaleRowsFromTransaction(transaction: Transaction): ReportDetailRow[] {
  const date = formatReportDate(transaction.created_at);
  const rows: ReportDetailRow[] = [];
  (transaction.service_items || []).forEach((item: any, index) => {
    if (!item.name?.startsWith("[商品]")) return;
    rows.push({
      id: `tx-${transaction.id}-import-product-${index}`,
      date,
      designerName: "",
      kind: "商品明細",
      itemName: item.name.replace("[商品] ", ""),
      quantity: "1",
      amount: formatMoney(Number(item.amount || 0)),
    });
  });
  (transaction.product_items || []).forEach((item: any, index) => {
    const quantity = Number(item.quantity || 1);
    const amount = Number(item.amount || 0) * quantity;
    rows.push({
      id: `tx-${transaction.id}-product-${index}`,
      date,
      designerName: "",
      kind: "商品明細",
      itemName: item.name || "商品銷售",
      quantity: String(quantity),
      amount: formatMoney(amount),
    });
  });
  const productLine = (transaction.note || "").split("客人購買商品：")[1]?.split("\n")[0] || "";
  if (productLine) {
    productLine.split("、").forEach((item, index) => {
      const match = item.match(/(.+?) x(\d+).*?小計NT\$?([\d,]+)/);
      if (!match) return;
      rows.push({
        id: `tx-${transaction.id}-note-product-${index}`,
        date,
        designerName: "",
        kind: "商品明細",
        itemName: match[1].trim(),
        quantity: match[2],
        amount: formatMoney(Number(match[3].replace(/,/g, ""))),
      });
    });
  }
  return rows;
}

function getReportTotals(transactions: Transaction[], productUsages: ProductUsage[], designerId?: number) {
  const scopedTransactions = designerId ? transactions.filter((item) => item.designer_id === designerId) : transactions;
  const scopedProductUsages = designerId ? productUsages.filter((item) => item.designer_id === designerId) : productUsages;
  const serviceRevenue = scopedTransactions.reduce((sum, item) => sum + getServiceRevenue(item), 0);
  const productRevenue = scopedTransactions.reduce((sum, item) => sum + getProductSaleTotal(item), 0);
  const selfUse = scopedProductUsages.reduce((sum, item) => sum + Number(item.total_cost || 0), 0);
  const discount = scopedTransactions.reduce((sum, item) => sum + getTransactionDiscount(item), 0);
  return {
    serviceRevenue,
    productRevenue,
    selfUse,
    discount,
    totalRevenue: serviceRevenue + productRevenue,
    actualIncome: Math.max(0, serviceRevenue + productRevenue - selfUse - discount),
    customerCount: scopedTransactions.length,
  };
}

function getDesignerSettlement(designer: Designer, transactions: Transaction[], productUsages: ProductUsage[]) {
  const totals = getReportTotals(transactions, productUsages, designer.id);
  const serviceBase = Math.max(0, totals.serviceRevenue - Number((designer as any).commission_base_deduction || 0));
  const serviceCommission = Math.round(serviceBase * Number(designer.commission_rate || 0));
  const brandFee = Math.round(totals.serviceRevenue * Number((designer as any).brand_fee_rate || 0));
  const productCommission = Math.round(totals.productRevenue * Number((designer as any).product_commission_rate || 0));
  const designerIncome = Math.max(0, serviceCommission + productCommission - brandFee - totals.selfUse - totals.discount);
  const bcReceivable = Math.max(0, totals.totalRevenue - designerIncome);
  return {
    totals,
    serviceCommission,
    brandFee,
    productCommission,
    designerIncome,
    bcReceivable,
  };
}

type AdminReportProps = {
  initialMode?: "shop" | "designer";
};

export default function AdminReport({ initialMode = "shop" }: AdminReportProps = {}) {
  const router = useRouter();
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [productUsages, setProductUsages] = useState<ProductUsage[]>([]);
  const [stockRecords, setStockRecords] = useState<StockRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [isDesktop, setIsDesktop] = useState(false);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  });
  const [reportStartDate, setReportStartDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
  });
  const [reportEndDate, setReportEndDate] = useState(() => {
    const now = new Date();
    return formatDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  });
  const [settlementDate, setSettlementDate] = useState(() => {
    const now = new Date();
    return formatDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 5));
  });
  const [reportMode, setReportMode] = useState<"shop" | "designer">(initialMode);
  const [activeShopDetail, setActiveShopDetail] = useState<ShopDetailKey>("actualIncome");
  const [activeDesignerDetail, setActiveDesignerDetail] = useState<DesignerDetailKey>("actualIncome");
  const [reportDesignerId, setReportDesignerId] = useState<number | null>(null);
  const [selectedShopDesignerId, setSelectedShopDesignerId] = useState<number | null>(null);
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

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mode") === "designer") {
      setReportMode("designer");
    }
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

  function setReportPeriodByMonth(year: number, monthIndex: number) {
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0);
    const pay = new Date(year, monthIndex + 1, 5);
    const monthKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    setSelectedYear(start.getFullYear());
    setSelectedMonth(monthKey);
    setReportStartDate(`${monthKey}-01`);
    setReportEndDate(formatDateInput(end));
    setSettlementDate(formatDateInput(pay));
  }

  function setCurrentReportPeriod() {
    const now = new Date();
    setReportPeriodByMonth(now.getFullYear(), now.getMonth());
  }

  function shiftReportPeriod(monthOffset: number) {
    const current = new Date(`${reportStartDate || selectedMonth + "-01"}T00:00:00`);
    setReportPeriodByMonth(current.getFullYear(), current.getMonth() + monthOffset);
  }

  function getExportTransactions() {
    const selectedDesignerId = reportMode === "designer"
      ? (reportDesignerId || designers[0]?.id || null)
      : selectedShopDesignerId;
    if (!selectedDesignerId) return monthlyTransactions;
    return monthlyTransactions.filter((t: any) => t.designer_id === selectedDesignerId);
  }

  function getExportLabel() {
    const selectedDesignerId = reportMode === "designer"
      ? (reportDesignerId || designers[0]?.id || null)
      : selectedShopDesignerId;
    const selectedDesigner = selectedDesignerId ? designers.find((d) => d.id === selectedDesignerId) : null;
    const dateLabel = reportStartDate === reportEndDate ? reportStartDate : `${reportStartDate}_${reportEndDate}`;
    return selectedDesigner ? `${dateLabel}_${getExportName(selectedDesigner)}` : dateLabel;
  }

  function getExportDesigners() {
    const selectedDesignerId = reportMode === "designer"
      ? (reportDesignerId || designers[0]?.id || null)
      : selectedShopDesignerId;
    if (!selectedDesignerId) return designers;
    return designers.filter((designer) => designer.id === selectedDesignerId);
  }

  function buildExportOrderRows(exportTx: Transaction[]) {
    const productBrandsExport = ["Oright", "O'right", "Sumuzu", "哥德式", "善詩", "威傑式", "沂樂"];
    const getItemCategory = (name: string) => {
      if (name.startsWith("[商品]")) return "商品";
      if (productBrandsExport.some(b => name.includes(b))) return "商品";
      if (/剪髮|單剪/.test(name)) return "美髮-剪髮";
      if (/燙|髮根燙/.test(name)) return "美髮-燙髮";
      if (/染|補染/.test(name)) return "美髮-染髮";
      if (/護髮/.test(name)) return "美髮-護髮";
      if (/洗髮|髮浴洗/.test(name)) return "美髮-洗髮";
      if (/頭皮/.test(name)) return "美髮-頭皮";
      return "美髮-服務";
    };

    const rows: any[] = [];
    exportTx.forEach((t: any, txIdx: number) => {
      const designer = designers.find((d: any) => d.id === t.designer_id);
      const designerLabel = designer ? getExportName(designer) : "-";
      const dateStr = t.created_at?.slice(0,10) || "";
      const timeStr = t.created_at?.slice(0,16)?.replace("T"," ") || "";
      const orderNo = dateStr.replace(/-/g,"").slice(2) + String(txIdx+1).padStart(8,"0");
      const payMethod = t.payment_method ? `${t.payment_method}：${t.total_amount}` : "";
      const allItems = [
        ...(t.service_items||[]).map((s: any) => ({
          category: getItemCategory(s.name),
          name: s.name.startsWith("[商品]") ? s.name.replace("[商品] ", "") : s.name,
          qty: 1,
          price: s.amount,
          discount: s.discount || 0,
          performance: s.name.startsWith("[商品]") ? 0 : (s.amount || 0),
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
        rows.push({
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
        return;
      }

      allItems.forEach((item: any, idx: number) => {
        rows.push({
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
    });
    return rows;
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  // 導出 Excel — 格式與舊系統訂單列表對齊
  function exportExcel() {
    try {
      const exportTx = getExportTransactions();
      const wb = XLSX.utils.book_new();

      // ── Sheet 1：設計師抽成 ──
      const dr = getExportDesigners().map((d: any) => {
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
      const tr = buildExportOrderRows(exportTx);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tr), "訂單列表");

      // ── Sheet 3：年度統計 ──
      const yr = yearlyData.map(([month, amount]: any) => ({ "月份": month, "總業績": amount }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(yr), "年度統計");

      XLSX.writeFile(wb, "BC_報表_" + getExportLabel() + ".xlsx");
    } catch(e) {
      alert("Excel 導出失敗");
    }
  }

  function exportCsv() {
    try {
      const rows = buildExportOrderRows(getExportTransactions());
      const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows));
      downloadBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }), "BC_報表_" + getExportLabel() + ".csv");
    } catch(e) {
      alert("CSV 導出失敗");
    }
  }

  function exportPdf() {
    try {
      const exportTx = getExportTransactions();
      const orderRows = buildExportOrderRows(exportTx);
      const exportDesigners = getExportDesigners();
      const escapeHtml = (value: any) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char] || char));
      const formatPdfMoney = (amount: number) => `NT$${Number(amount || 0).toLocaleString()}`;
      const summaryRows = exportDesigners.map((designer) => {
        const report = calcDesignerReport(designer);
        return `
          <tr>
            <td>${escapeHtml(getExportName(designer))}</td>
            <td>${report.transactionCount}</td>
            <td>${formatPdfMoney(report.serviceRevenue)}</td>
            <td>${formatPdfMoney(report.serviceCommission)}</td>
            <td>${formatPdfMoney(report.brandFee)}</td>
            <td>${formatPdfMoney(report.totalCommission)}</td>
          </tr>
        `;
      }).join("");
      const detailRows = orderRows.map((row) => `
        <tr>
          <td>${escapeHtml(row["訂單時間"])}</td>
          <td>${escapeHtml(row["工作人員"])}</td>
          <td>${escapeHtml(row["分類"])}</td>
          <td>${escapeHtml(row["品項"])}</td>
          <td>${escapeHtml(row["數量"])}</td>
          <td>${escapeHtml(row["總價"])}</td>
          <td>${escapeHtml(row["支付方式"])}</td>
        </tr>
      `).join("");
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        alert("瀏覽器阻擋了 PDF 視窗，請允許彈出視窗後再試一次");
        return;
      }
      printWindow.document.write(`
        <!doctype html>
        <html>
          <head>
            <title>BC_報表_${escapeHtml(getExportLabel())}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Noto Sans TC", sans-serif; color: #202124; padding: 28px; }
              h1 { font-size: 24px; margin: 0 0 8px; }
              .meta { color: #6b7280; margin-bottom: 22px; line-height: 1.7; }
              h2 { font-size: 18px; margin: 24px 0 10px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
              th, td { border: 1px solid #d8d5ca; padding: 9px 10px; text-align: left; font-size: 12px; vertical-align: top; }
              th { background: #f3f0e8; color: #4b5563; }
              tr:nth-child(even) td { background: #fbfaf7; }
              @media print { body { padding: 12px; } button { display: none; } }
            </style>
          </head>
          <body>
            <h1>${reportMode === "shop" ? "店舖報表" : "設計師報表"}</h1>
            <div class="meta">
              結算區間：${escapeHtml(reportStartDate)} 至 ${escapeHtml(reportEndDate)}<br>
              結算日：${escapeHtml(settlementDate)}<br>
              導出對象：${escapeHtml(exportDesigners.length === designers.length ? "全員" : exportDesigners.map(getExportName).join("、"))}
            </div>
            <h2>設計師結算概覽</h2>
            <table>
              <thead><tr><th>設計師</th><th>筆數</th><th>服務業績</th><th>服務抽成</th><th>品牌共享費</th><th>應付抽成</th></tr></thead>
              <tbody>${summaryRows || `<tr><td colspan="6">無資料</td></tr>`}</tbody>
            </table>
            <h2>明細</h2>
            <table>
              <thead><tr><th>訂單時間</th><th>設計師</th><th>分類</th><th>品項</th><th>數量</th><th>總價</th><th>支付方式</th></tr></thead>
              <tbody>${detailRows || `<tr><td colspan="7">此區間尚無明細</td></tr>`}</tbody>
            </table>
            <script>
              window.onload = function() {
                window.print();
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch(e) {
      alert("PDF 導出失敗");
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
      const [{ data: dData }, { data: pData }, { data: cData }, { data: stockData }] = await Promise.all([
        supabase.from("designers").select("*").order("id"),
        supabase.from("product_usage").select("*").order("used_at", { ascending: false }),
        supabase.from("customers").select("id, phone, customer_no"),
        supabase.from("stock_records").select("*").order("created_at", { ascending: false }),
      ]);
      if (dData) setDesigners(dData);
      if (pData) setProductUsages(pData);
      if (cData) setCustomers(cData);
      if (stockData) setStockRecords(stockData);

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

  const monthlyTransactions = transactions.filter(t => {
    const date = t.created_at?.slice(0, 10);
    if (!date) return false;
    return date >= reportStartDate && date <= reportEndDate;
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

  const monthlyProductUsages = productUsages.filter((usage) => {
    const date = usage.used_at?.slice(0, 10);
    if (!date) return false;
    return date >= reportStartDate && date <= reportEndDate;
  });
  const monthlyShopUseRecords = stockRecords.filter((record) => {
    const date = record.created_at?.slice(0, 10);
    if (!date) return false;
    return date >= reportStartDate && date <= reportEndDate && (record.note || "").startsWith("店用領料");
  });
  const shopTotals = getReportTotals(monthlyTransactions, monthlyProductUsages);
  const shopUseQuantity = monthlyShopUseRecords.reduce((sum, record) => sum + Math.abs(Number(record.quantity || 0)), 0);
  const activeReportDesigner = designers.find((designer) => designer.id === (reportDesignerId || designers[0]?.id));
  const designerTotals = activeReportDesigner ? getReportTotals(monthlyTransactions, monthlyProductUsages, activeReportDesigner.id) : getReportTotals([], []);
  const activeDesignerSettlement = activeReportDesigner ? getDesignerSettlement(activeReportDesigner, monthlyTransactions, monthlyProductUsages) : null;
  const getDesignerNameById = (designerId: number) => {
    const designer = designers.find((item) => item.id === designerId);
    return designer ? getDesignerLabel(designer) : "-";
  };
  const serviceDetailRows: ReportDetailRow[] = monthlyTransactions.flatMap((transaction) => {
    const serviceItems = (transaction.service_items || []).filter((item: any) => !item.name?.startsWith("[商品]"));
    if (serviceItems.length === 0 && getServiceRevenue(transaction) > 0) {
      return [{
        id: `tx-${transaction.id}-service-total`,
        date: formatReportDate(transaction.created_at),
        designerName: getDesignerNameById(transaction.designer_id),
        kind: "服務明細",
        itemName: transaction.customer_name ? `${transaction.customer_name}｜服務收入` : "服務收入",
        quantity: "1",
        amount: formatMoney(getServiceRevenue(transaction)),
      }];
    }
    return serviceItems.map((item: any, index) => ({
      id: `tx-${transaction.id}-service-${index}`,
      date: formatReportDate(transaction.created_at),
      designerName: getDesignerNameById(transaction.designer_id),
      kind: "服務明細",
      itemName: transaction.customer_name ? `${transaction.customer_name}｜${item.name}` : item.name,
      quantity: "1",
      amount: formatMoney(Number(item.amount || 0)),
    }));
  });
  const productSaleRows: ReportDetailRow[] = monthlyTransactions.flatMap((transaction) =>
    getProductSaleRowsFromTransaction(transaction).map((row) => ({
      ...row,
      designerName: getDesignerNameById(transaction.designer_id),
      itemName: transaction.customer_name ? `${transaction.customer_name}｜${row.itemName}` : row.itemName,
    }))
  );
  const selfUseRows: ReportDetailRow[] = monthlyProductUsages.map((usage) => ({
    id: `self-use-${usage.id}`,
    date: formatReportDate(usage.used_at),
    designerName: getDesignerNameById(usage.designer_id),
    kind: "自領材料",
    itemName: usage.product_name,
    quantity: String(usage.quantity || 0),
    amount: formatMoney(Number(usage.total_cost || 0), true),
    isNegative: true,
  }));
  const shopUseRows: ReportDetailRow[] = monthlyShopUseRecords.map((record) => ({
    id: `shop-use-${record.id}`,
    date: formatReportDate(record.created_at),
    designerName: ((record.note || "").replace("店用領料 - ", "").split("｜")[0] || "-").trim(),
    kind: "店用領料",
    itemName: record.product_name,
    quantity: String(Math.abs(Number(record.quantity || 0))),
    amount: "只扣庫存",
  }));
  const discountRows: ReportDetailRow[] = monthlyTransactions.flatMap((transaction) => {
    const serviceDiscountRows = (transaction.service_items || [])
      .filter((item: any) => Number(item.discount || 0) > 0)
      .map((item: any, index) => ({
        id: `tx-${transaction.id}-service-discount-${index}`,
        date: formatReportDate(transaction.created_at),
        designerName: getDesignerNameById(transaction.designer_id),
        kind: "服務折扣",
        itemName: transaction.customer_name ? `${transaction.customer_name}｜${item.name}` : item.name,
        quantity: "1",
        amount: formatMoney(Number(item.discount || 0), true),
        isNegative: true,
      }));
    const productDiscount = [...((transaction.note || "").matchAll(/商品折扣NT\$?([\d,]+)/g))]
      .reduce((sum, match) => sum + Number(match[1].replace(/,/g, "")), 0);
    if (productDiscount <= 0) return serviceDiscountRows;
    return [
      ...serviceDiscountRows,
      {
        id: `tx-${transaction.id}-product-discount`,
        date: formatReportDate(transaction.created_at),
        designerName: getDesignerNameById(transaction.designer_id),
        kind: "商品折扣",
        itemName: transaction.customer_name ? `${transaction.customer_name}｜商品折扣` : "商品折扣",
        quantity: "1",
        amount: formatMoney(productDiscount, true),
        isNegative: true,
      },
    ];
  });
  const actualIncomeRows = [...serviceDetailRows, ...productSaleRows].sort((a, b) => a.date.localeCompare(b.date));
  const allShopDetailRows = [...serviceDetailRows, ...productSaleRows, ...selfUseRows, ...shopUseRows, ...discountRows].sort((a, b) => a.date.localeCompare(b.date));
  const shopDetailRowsByKey: Record<ShopDetailKey, ReportDetailRow[]> = {
    actualIncome: allShopDetailRows,
    serviceRevenue: serviceDetailRows,
    productRevenue: productSaleRows,
    selfUse: selfUseRows,
    shopUse: shopUseRows,
    discount: discountRows,
  };
  const selectedShopDesigner = designers.find((designer) => designer.id === selectedShopDesignerId) || null;
  const selectedShopDesignerLabels = selectedShopDesigner
    ? [getDesignerLabel(selectedShopDesigner), selectedShopDesigner.name, selectedShopDesigner.display_name].filter(Boolean)
    : [];
  const activeShopDetailRows = selectedShopDesigner
    ? shopDetailRowsByKey[activeShopDetail].filter((row) => selectedShopDesignerLabels.includes(row.designerName))
    : shopDetailRowsByKey[activeShopDetail];
  const activeShopDetailTitle: Record<ShopDetailKey, string> = {
    actualIncome: "全部明細",
    serviceRevenue: "服務業績明細",
    productRevenue: "商品銷售明細",
    selfUse: "自領材料明細",
    shopUse: "店用領料明細",
    discount: "折扣金額明細",
  };
  const filterRowsByActiveDesigner = (rows: ReportDetailRow[]) => activeReportDesigner
    ? rows.filter((row) => row.designerName === getDesignerLabel(activeReportDesigner))
    : [];
  const designerDetailRowsByKey: Record<DesignerDetailKey, ReportDetailRow[]> = {
    actualIncome: filterRowsByActiveDesigner(actualIncomeRows),
    serviceRevenue: filterRowsByActiveDesigner(serviceDetailRows),
    productRevenue: filterRowsByActiveDesigner(productSaleRows),
    selfUse: filterRowsByActiveDesigner(selfUseRows),
    discount: filterRowsByActiveDesigner(discountRows),
  };
  const activeDesignerDetailRows = designerDetailRowsByKey[activeDesignerDetail];
  const activeDesignerDetailTitle: Record<DesignerDetailKey, string> = {
    actualIncome: "設計師實際收入明細",
    serviceRevenue: "設計師服務明細",
    productRevenue: "設計師商品銷售明細",
    selfUse: "設計師自領材料明細",
    discount: "設計師折扣明細",
  };
  const designerSettlementRows = designers.map((designer) => ({
    designer,
    settlement: getDesignerSettlement(designer, monthlyTransactions, monthlyProductUsages),
  }));
  const totalBcReceivable = designerSettlementRows.reduce((sum, row) => sum + row.settlement.bcReceivable, 0);
  const shopUseDisplayAmount = monthlyShopUseRecords.reduce((sum, record) => sum + Math.abs(Number(record.quantity || 0)), 0);
  const shopMetricCards = [
    { label: "店舖總營業額", value: `NT$${shopTotals.totalRevenue.toLocaleString()}`, note: "本期全員完成交易", background: "#EEF8FF", border: "#D6EFFF", color: "#0877B5" },
    { label: "BC 應收總額", value: `NT$${totalBcReceivable.toLocaleString()}`, note: "依每位設計師結算規則", background: "#EDFFF6", border: "#C9F7DF", color: "#087F5B" },
    { label: "完成交易數", value: shopTotals.customerCount.toLocaleString(), note: "本期完成結帳", background: "#F4F0FF", border: "#E7DEFE", color: "#6D28D9" },
  ];
  const revenueCards = [
    { key: "actualIncome" as ShopDetailKey, label: "全部", value: `NT$${shopTotals.totalRevenue.toLocaleString()}`, note: `${allShopDetailRows.length} 筆明細`, background: "#F7F5FF", border: "#DCD5FA", color: "#534AB7" },
    { key: "serviceRevenue" as ShopDetailKey, label: "服務", value: `NT$${shopTotals.serviceRevenue.toLocaleString()}`, note: `${serviceDetailRows.length} 筆`, background: "#EEF8FF", border: "#D6EFFF", color: "#0877B5" },
    { key: "productRevenue" as ShopDetailKey, label: "商品", value: `NT$${shopTotals.productRevenue.toLocaleString()}`, note: `${productSaleRows.length} 筆`, background: "#F4F0FF", border: "#E7DEFE", color: "#6D28D9" },
    { key: "selfUse" as ShopDetailKey, label: "自領", value: `-NT$${shopTotals.selfUse.toLocaleString()}`, note: `${selfUseRows.length} 筆`, background: "#FFF1F2", border: "#FECDD3", color: "#BE123C" },
    { key: "shopUse" as ShopDetailKey, label: "店用", value: `${shopUseDisplayAmount.toLocaleString()} 件`, note: `${shopUseRows.length} 筆`, background: "#EDFFF6", border: "#C9F7DF", color: "#087F5B" },
    { key: "discount" as ShopDetailKey, label: "折扣", value: `-NT$${shopTotals.discount.toLocaleString()}`, note: `${discountRows.length} 筆`, background: "#FFF7ED", border: "#FED7AA", color: "#BA7517" },
  ];

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#534AB7", fontSize: 14 }}>載入中...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", paddingBottom: 70, paddingLeft: isDesktop ? 220 : 0 }}>
      <div style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => router.push("/admin/dashboard")} style={{ background: "#2C2C2A", color: "#fff", border: "1px solid #5F5E5A", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>← 返回</button>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{reportMode === "shop" ? "店舖報表" : "設計師報表"}</div>
        </div>
        <div style={{ fontSize: 12, color: "#888780" }}>{selectedMonth.replace("-", " 年 ")} 月</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setShowImport(!showImport)} style={{ background: "#BA7517", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>匯入歷史</button>
          <button onClick={exportExcel} style={{ background: "#1D9E75", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>導出 Excel</button>
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

        <div style={{ background: "#fff", borderRadius: 18, border: "0.5px solid #D3D1C7", padding: 16, marginBottom: 12, boxShadow: "0 10px 26px rgba(44,44,42,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#2C2C2A" }}>📅 結算區間</div>
              <div style={{ padding: "8px 13px", borderRadius: 12, background: reportMode === "shop" ? "#F7F5FF" : "#F1EFE8", color: reportMode === "shop" ? "#534AB7" : "#5F5E5A", fontSize: 13, fontWeight: 800 }}>{reportMode === "shop" ? "店舖報表" : "設計師報表"}</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => shiftReportPeriod(1)} style={{ border: "none", padding: "9px 14px", borderRadius: 12, background: "#D7F8E6", color: "#047857", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>下一期</button>
              <button onClick={setCurrentReportPeriod} style={{ border: "none", padding: "9px 14px", borderRadius: 12, background: "#E2F2FF", color: "#0877B5", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>本期</button>
              <button onClick={() => shiftReportPeriod(-1)} style={{ border: "none", padding: "9px 14px", borderRadius: 12, background: "#F1EFE8", color: "#5F5E5A", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>上一期</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(4, minmax(150px, 1fr))" : "1fr", gap: 10, alignItems: "end" }}>
            <label style={{ display: "grid", gap: 5, fontSize: 11, color: "#5F5E5A", fontWeight: 700 }}>
              開始日期
              <input type="date" value={reportStartDate} onChange={(event) => { setReportStartDate(event.target.value); setSelectedMonth(event.target.value.slice(0, 7)); setSelectedYear(Number(event.target.value.slice(0, 4))); }} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #D3D1C7", fontSize: 14, outline: "none" }} />
            </label>
            <label style={{ display: "grid", gap: 5, fontSize: 11, color: "#5F5E5A", fontWeight: 700 }}>
              結束日期
              <input type="date" value={reportEndDate} onChange={(event) => setReportEndDate(event.target.value)} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #D3D1C7", fontSize: 14, outline: "none" }} />
            </label>
            <label style={{ display: "grid", gap: 5, fontSize: 11, color: "#5F5E5A", fontWeight: 700 }}>
              結算日
              <input type="date" value={settlementDate} onChange={(event) => setSettlementDate(event.target.value)} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #D3D1C7", fontSize: 14, outline: "none" }} />
            </label>
            <label style={{ display: "grid", gap: 5, fontSize: 11, color: "#5F5E5A", fontWeight: 700 }}>
              設計師
              <select value={reportMode === "designer" ? String(reportDesignerId || designers[0]?.id || "") : String(selectedShopDesignerId || "all")} onChange={(event) => {
                if (reportMode === "designer") setReportDesignerId(Number(event.target.value));
                else setSelectedShopDesignerId(event.target.value === "all" ? null : Number(event.target.value));
              }} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #D3D1C7", fontSize: 14, outline: "none", background: "#fff" }}>
                {reportMode === "shop" && <option value="all">全員</option>}
                {designers.map((designer) => <option key={designer.id} value={designer.id}>{getDesignerLabel(designer)}</option>)}
              </select>
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <button onClick={() => window.location.reload()} style={{ background: "#D7F8E6", color: "#047857", border: "none", borderRadius: 12, padding: "9px 14px", fontSize: 13, cursor: "pointer", fontWeight: 800 }}>重新整理</button>
            <button onClick={exportCsv} style={{ background: "#E2F2FF", color: "#0877B5", border: "none", borderRadius: 12, padding: "9px 14px", fontSize: 13, cursor: "pointer", fontWeight: 800 }}>CSV</button>
            <button onClick={exportExcel} style={{ background: "#1D9E75", color: "#fff", border: "none", borderRadius: 12, padding: "9px 14px", fontSize: 13, cursor: "pointer", fontWeight: 800 }}>Excel</button>
            <button onClick={exportPdf} style={{ background: "#0877B5", color: "#fff", border: "none", borderRadius: 12, padding: "9px 14px", fontSize: 13, cursor: "pointer", fontWeight: 800 }}>PDF（每位設計師）</button>
          </div>
        </div>

        {reportMode === "shop" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1.08fr" : "1fr", gap: 12, marginBottom: 12 }}>
              <div style={{ background: "#fff", borderRadius: 18, border: "0.5px solid #D3D1C7", padding: 14, overflow: "hidden" }}>
                <div style={{ fontSize: 16, color: "#2C2C2A", fontWeight: 800, marginBottom: 4 }}>店舖報表總覽</div>
                <div style={{ fontSize: 11, color: "#888780", fontWeight: 600, marginBottom: 12 }}>本期最重要的三個總數</div>
                <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "1fr", gap: 10 }}>
                  {shopMetricCards.map((card) => (
                    <div key={card.label} style={{ minHeight: 118, background: card.background, border: `1px solid ${card.border}`, borderRadius: 18, padding: 16 }}>
                      <div style={{ fontSize: 28, color: card.color, fontWeight: 900, lineHeight: 1, marginBottom: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.value}</div>
                      <div style={{ fontSize: 15, color: card.color, fontWeight: 800, lineHeight: 1.5 }}>{card.label}</div>
                      <div style={{ fontSize: 12, color: card.color, fontWeight: 700, lineHeight: 1.5, opacity: 0.75 }}>{card.note}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: "#fff", borderRadius: 18, border: "0.5px solid #D3D1C7", padding: 14, overflow: "hidden" }}>
                <div style={{ fontSize: 16, color: "#2C2C2A", fontWeight: 800, marginBottom: 4 }}>營收總覽</div>
                <div style={{ fontSize: 11, color: "#888780", fontWeight: 600, marginBottom: 12 }}>點選卡片，下方明細同步切換</div>
                <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "repeat(2, 1fr)", gap: 8 }}>
                  {revenueCards.map((card) => (
                    <button key={card.label} onClick={() => setActiveShopDetail(card.key)} style={{ minHeight: 78, background: activeShopDetail === card.key ? card.background : "#fff", border: activeShopDetail === card.key ? `1.5px solid ${card.color}` : `1px solid ${card.border}`, borderRadius: 16, padding: 12, textAlign: "left", cursor: "pointer" }}>
                      <div style={{ fontSize: 17, color: card.color, fontWeight: 900, marginBottom: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.value}</div>
                      <div style={{ fontSize: 13, color: card.color, fontWeight: 800 }}>{card.label}</div>
                      <div style={{ fontSize: 11, color: card.color, fontWeight: 700, opacity: 0.7 }}>{card.note}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 18, border: "0.5px solid #D3D1C7", overflow: "hidden", marginBottom: 12 }}>
              <div style={{ padding: "14px 16px", borderBottom: "0.5px solid #F1EFE8", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 18, color: "#2C2C2A", fontWeight: 800 }}>💰 設計師結算概覽</div>
                  <div style={{ fontSize: 12, color: "#888780", marginTop: 4 }}>點選設計師後，下方只顯示該設計師明細；再點一次回到全員</div>
                </div>
                {selectedShopDesigner && (
                  <button onClick={() => setSelectedShopDesignerId(null)} style={{ border: "none", borderRadius: 12, background: "#F1EFE8", color: "#5F5E5A", padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>清除設計師篩選</button>
                )}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#F8F7F3" }}>
                      {["設計師", "筆數", "總營業額", "服務抽成", "商品抽成", "應付 BC", "設計師實收"].map((head, index) => (
                        <th key={head} style={{ padding: "11px 14px", fontSize: 12, color: "#888780", fontWeight: 800, textAlign: index < 2 ? "left" : "right" }}>{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {designerSettlementRows.map(({ designer, settlement }) => {
                      const selected = selectedShopDesignerId === designer.id;
                      return (
                        <tr key={designer.id} onClick={() => setSelectedShopDesignerId(selected ? null : designer.id)} style={{ borderTop: "0.5px solid #F1EFE8", background: selected ? "#F7F5FF" : "#fff", cursor: "pointer" }}>
                          <td style={{ padding: "12px 14px", fontSize: 15, color: "#2C2C2A", fontWeight: 800 }}>{getDesignerLabel(designer)}</td>
                          <td style={{ padding: "12px 14px", fontSize: 13, color: "#5F5E5A", fontWeight: 700 }}>{settlement.totals.customerCount}</td>
                          <td style={{ padding: "12px 14px", fontSize: 15, color: "#0877B5", fontWeight: 900, textAlign: "right" }}>NT${settlement.totals.totalRevenue.toLocaleString()}</td>
                          <td style={{ padding: "12px 14px", fontSize: 15, color: "#087F5B", fontWeight: 900, textAlign: "right" }}>NT${settlement.serviceCommission.toLocaleString()}</td>
                          <td style={{ padding: "12px 14px", fontSize: 15, color: "#6D28D9", fontWeight: 900, textAlign: "right" }}>NT${settlement.productCommission.toLocaleString()}</td>
                          <td style={{ padding: "12px 14px", fontSize: 15, color: "#BA7517", fontWeight: 900, textAlign: "right" }}>NT${settlement.bcReceivable.toLocaleString()}</td>
                          <td style={{ padding: "12px 14px", fontSize: 15, color: "#534AB7", fontWeight: 900, textAlign: "right" }}>NT${settlement.designerIncome.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 18, border: "0.5px solid #D3D1C7", overflow: "hidden", marginBottom: 12 }}>
              <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 16, color: "#2C2C2A", fontWeight: 800 }}>{selectedShopDesigner ? `${getDesignerLabel(selectedShopDesigner)} ${activeShopDetailTitle[activeShopDetail]}` : `全員 ${activeShopDetailTitle[activeShopDetail]}`}</div>
                  <div style={{ fontSize: 11, color: "#888780", marginTop: 3 }}>
                    {selectedShopDesigner ? "目前只顯示選取設計師資料" : "未點選設計師時，依日期顯示全部所有明細"}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#888780", fontWeight: 600 }}>共 {activeShopDetailRows.length} 筆</div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#F1EFE8" }}>
                      {["日期", "設計師", "明細", "數量", "金額"].map((head) => (
                        <th key={head} style={{ padding: "10px 14px", fontSize: 12, color: "#888780", fontWeight: 700, textAlign: "left" }}>{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeShopDetailRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: "18px 14px", color: "#888780", fontSize: 13, textAlign: "center" }}>目前沒有明細</td>
                      </tr>
                    ) : activeShopDetailRows.map((row, index) => {
                      const showDate = index === 0 || activeShopDetailRows[index - 1].date !== row.date;
                      return (
                        <tr key={row.id} style={{ borderTop: "0.5px solid #F1EFE8" }}>
                          <td style={{ padding: "11px 14px", fontSize: 13, color: showDate ? "#2C2C2A" : "#B4AEA4", fontWeight: showDate ? 700 : 500 }}>{showDate ? row.date : ""}</td>
                          <td style={{ padding: "11px 14px", fontSize: 13, color: "#5F5E5A", fontWeight: 600 }}>{row.designerName}</td>
                          <td style={{ padding: "11px 14px", fontSize: 13, color: "#2C2C2A", fontWeight: 600 }}>
                            <span style={{ color: "#888780", marginRight: 8 }}>{row.kind}</span>
                            {row.itemName}
                          </td>
                          <td style={{ padding: "11px 14px", fontSize: 13, color: "#2C2C2A" }}>{row.quantity}</td>
                          <td style={{ padding: "11px 14px", fontSize: 13, color: row.isNegative ? "#A32D2D" : activeShopDetail === "shopUse" ? "#8A5A10" : "#1976C9", fontWeight: 800 }}>{row.amount}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {reportMode === "designer" && activeReportDesigner && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(6, 1fr)" : "repeat(2, 1fr)", gap: 8, marginBottom: 12 }}>
              {[
                { key: "actualIncome" as DesignerDetailKey, label: "設計師實收", value: `NT$${(activeDesignerSettlement?.designerIncome || 0).toLocaleString()}`, color: "#1D9E75" },
                { key: "serviceRevenue" as DesignerDetailKey, label: "服務業績", value: `NT$${designerTotals.serviceRevenue.toLocaleString()}`, color: "#534AB7" },
                { key: "productRevenue" as DesignerDetailKey, label: "商品銷售", value: `NT$${designerTotals.productRevenue.toLocaleString()}`, color: "#BA7517" },
                { key: "selfUse" as DesignerDetailKey, label: "自領材料", value: `-NT$${designerTotals.selfUse.toLocaleString()}`, color: "#A32D2D" },
                { key: "discount" as DesignerDetailKey, label: "折扣", value: `-NT$${designerTotals.discount.toLocaleString()}`, color: "#E24B4A" },
                { key: "actualIncome" as DesignerDetailKey, label: "總客數", value: String(designerTotals.customerCount), color: "#0B66C3" },
              ].map((card) => (
                <button key={card.label} onClick={() => setActiveDesignerDetail(card.key)} style={{ background: activeDesignerDetail === card.key ? "#F7F5FF" : "#fff", borderRadius: 12, border: activeDesignerDetail === card.key ? "1.5px solid #534AB7" : "0.5px solid #D3D1C7", padding: 14, textAlign: "left", cursor: "pointer" }}>
                  <div style={{ fontSize: 11, color: "#888780", fontWeight: 600, marginBottom: 8 }}>{card.label}</div>
                  <div style={{ fontSize: 18, color: card.color, fontWeight: 800 }}>{card.value}</div>
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "420px 1fr" : "1fr", gap: 12, marginBottom: 12 }}>
              <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #D3D1C7", overflow: "hidden" }}>
                <div style={{ padding: "12px 14px", fontSize: 14, color: "#2C2C2A", fontWeight: 700 }}>{getDesignerLabel(activeReportDesigner)} 月報摘要</div>
                {[
                  ["服務業績", designerTotals.serviceRevenue, false],
                  ["服務抽成", activeDesignerSettlement?.serviceCommission || 0, false],
                  ["商品銷售", designerTotals.productRevenue, false],
                  ["商品抽成", activeDesignerSettlement?.productCommission || 0, false],
                  ["品牌共享費", activeDesignerSettlement?.brandFee || 0, true],
                  ["自領材料", designerTotals.selfUse, true],
                  ["折扣", designerTotals.discount, true],
                  ["設計師實收", activeDesignerSettlement?.designerIncome || 0, false],
                  ["應付 BC", activeDesignerSettlement?.bcReceivable || 0, false],
                ].map(([label, value, negative]) => (
                  <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderTop: "0.5px solid #F1EFE8", fontSize: 13, color: label === "實際收入" ? "#534AB7" : "#2C2C2A", fontWeight: label === "實際收入" ? 800 : 500 }}>
                    <span>{label}</span>
                    <span>{negative ? "-" : ""}NT${Number(value).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #D3D1C7", overflow: "hidden" }}>
                <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, color: "#2C2C2A", fontWeight: 700 }}>{activeDesignerDetailTitle[activeDesignerDetail]}</div>
                    <div style={{ fontSize: 11, color: "#888780", marginTop: 3 }}>只顯示目前選擇設計師的資料</div>
                  </div>
                  <div style={{ fontSize: 12, color: "#888780", fontWeight: 600 }}>共 {activeDesignerDetailRows.length} 筆</div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#F1EFE8" }}>
                        {["日期", "明細", "數量", "金額"].map((head) => (
                          <th key={head} style={{ padding: "10px 14px", fontSize: 12, color: "#888780", fontWeight: 700, textAlign: "left" }}>{head}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeDesignerDetailRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ padding: "18px 14px", color: "#888780", fontSize: 13, textAlign: "center" }}>目前沒有明細</td>
                        </tr>
                      ) : activeDesignerDetailRows.map((row, index) => {
                        const showDate = index === 0 || activeDesignerDetailRows[index - 1].date !== row.date;
                        return (
                          <tr key={row.id} style={{ borderTop: "0.5px solid #F1EFE8" }}>
                            <td style={{ padding: "11px 14px", fontSize: 13, color: showDate ? "#2C2C2A" : "#B4AEA4", fontWeight: showDate ? 700 : 500 }}>{showDate ? row.date : ""}</td>
                            <td style={{ padding: "11px 14px", fontSize: 13, color: "#2C2C2A", fontWeight: 600 }}>
                              <span style={{ color: "#888780", marginRight: 8 }}>{row.kind}</span>
                              {row.itemName}
                            </td>
                            <td style={{ padding: "11px 14px", fontSize: 13, color: "#2C2C2A" }}>{row.quantity}</td>
                            <td style={{ padding: "11px 14px", fontSize: 13, color: row.isNegative ? "#A32D2D" : "#1976C9", fontWeight: 800 }}>{row.amount}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

      </div>

      <AdminBottomNav current={reportMode === "designer" ? "report-designer" : "report-shop"} />
    </div>
  );
}
