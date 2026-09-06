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

export default function AdminReport() {
  const router = useRouter();
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [productUsages, setProductUsages] = useState<ProductUsage[]>([]);
  const [stockRecords, setStockRecords] = useState<StockRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [exportMode, setExportMode] = useState<"month" | "year" | "range">("month");
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  });
  const [reportMode, setReportMode] = useState<"shop" | "designer">(() => {
    if (typeof window === "undefined") return "shop";
    return new URLSearchParams(window.location.search).get("mode") === "designer" ? "designer" : "shop";
  });
  const [activeShopDetail, setActiveShopDetail] = useState<ShopDetailKey>("actualIncome");
  const [reportDesignerId, setReportDesignerId] = useState<number | null>(null);
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
  const monthlyProductUsages = productUsages.filter((usage) => usage.used_at?.slice(0, 7) === selectedMonth);
  const monthlyShopUseRecords = stockRecords.filter((record) => record.created_at?.slice(0, 7) === selectedMonth && (record.note || "").startsWith("店用領料"));
  const shopTotals = getReportTotals(monthlyTransactions, monthlyProductUsages);
  const shopUseQuantity = monthlyShopUseRecords.reduce((sum, record) => sum + Math.abs(Number(record.quantity || 0)), 0);
  const activeReportDesigner = designers.find((designer) => designer.id === (reportDesignerId || designers[0]?.id));
  const designerTotals = activeReportDesigner ? getReportTotals(monthlyTransactions, monthlyProductUsages, activeReportDesigner.id) : getReportTotals([], []);
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
    designerName: (record.note || "").replace("店用領料 - ", "") || "-",
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
  const shopDetailRowsByKey: Record<ShopDetailKey, ReportDetailRow[]> = {
    actualIncome: actualIncomeRows,
    serviceRevenue: serviceDetailRows,
    productRevenue: productSaleRows,
    selfUse: selfUseRows,
    shopUse: shopUseRows,
    discount: discountRows,
  };
  const activeShopDetailRows = shopDetailRowsByKey[activeShopDetail];
  const activeShopDetailTitle: Record<ShopDetailKey, string> = {
    actualIncome: "實際收入明細",
    serviceRevenue: "服務業績明細",
    productRevenue: "商品銷售明細",
    selfUse: "自領材料明細",
    shopUse: "店用領料明細",
    discount: "折扣金額明細",
  };

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
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>收入報表</div>
        </div>
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

        <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #D3D1C7", overflow: "hidden", marginBottom: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
            <button onClick={() => { setReportMode("shop"); router.replace("/admin/report?mode=shop"); }} style={{ border: "none", padding: "14px 0", background: reportMode === "shop" ? "#534AB7" : "#fff", color: reportMode === "shop" ? "#fff" : "#2C2C2A", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>店鋪總報表</button>
            <button onClick={() => { setReportMode("designer"); router.replace("/admin/report?mode=designer"); }} style={{ border: "none", padding: "14px 0", background: reportMode === "designer" ? "#534AB7" : "#fff", color: reportMode === "designer" ? "#fff" : "#2C2C2A", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>設計師月報表</button>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", padding: 14, borderTop: "0.5px solid #F1EFE8" }}>
            <label style={{ display: "grid", gap: 5, fontSize: 11, color: "#888780", fontWeight: 600 }}>
              選擇月份
              <input type="month" value={selectedMonth} onChange={(event) => { setSelectedMonth(event.target.value); setSelectedYear(Number(event.target.value.slice(0, 4))); }} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none" }} />
            </label>
            {reportMode === "designer" && (
              <label style={{ display: "grid", gap: 5, fontSize: 11, color: "#888780", fontWeight: 600, minWidth: 180 }}>
                選擇設計師
                <select value={String(reportDesignerId || designers[0]?.id || "")} onChange={(event) => setReportDesignerId(Number(event.target.value))} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", background: "#fff" }}>
                  {designers.map((designer) => <option key={designer.id} value={designer.id}>{getDesignerLabel(designer)}</option>)}
                </select>
              </label>
            )}
          </div>
        </div>

        {reportMode === "shop" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(6, 1fr)" : "repeat(2, 1fr)", gap: 8, marginBottom: 12 }}>
              {[
                { key: "serviceRevenue" as ShopDetailKey, label: "服務業績", value: `NT$${shopTotals.serviceRevenue.toLocaleString()}`, color: "#534AB7" },
                { key: "productRevenue" as ShopDetailKey, label: "商品銷售", value: `NT$${shopTotals.productRevenue.toLocaleString()}`, color: "#BA7517" },
                { key: "selfUse" as ShopDetailKey, label: "自領材料", value: `-NT$${shopTotals.selfUse.toLocaleString()}`, color: "#A32D2D" },
                { key: "shopUse" as ShopDetailKey, label: "店用領料", value: `${shopUseQuantity.toLocaleString()} 件`, color: "#8A5A10" },
                { key: "discount" as ShopDetailKey, label: "折扣金額", value: `-NT$${shopTotals.discount.toLocaleString()}`, color: "#E24B4A" },
                { key: "actualIncome" as ShopDetailKey, label: "實際收入", value: `NT$${shopTotals.actualIncome.toLocaleString()}`, color: "#1D9E75" },
              ].map((card) => (
                <button key={card.label} onClick={() => setActiveShopDetail(card.key)} style={{ background: activeShopDetail === card.key ? "#F7F5FF" : "#fff", borderRadius: 12, border: activeShopDetail === card.key ? "1.5px solid #534AB7" : "0.5px solid #D3D1C7", padding: 14, textAlign: "left", cursor: "pointer" }}>
                  <div style={{ fontSize: 11, color: "#888780", fontWeight: 600, marginBottom: 8 }}>{card.label}</div>
                  <div style={{ fontSize: 18, color: card.color, fontWeight: 800 }}>{card.value}</div>
                </button>
              ))}
            </div>

            <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #D3D1C7", overflow: "hidden", marginBottom: 12 }}>
              <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, color: "#2C2C2A", fontWeight: 700 }}>{activeShopDetailTitle[activeShopDetail]}</div>
                  <div style={{ fontSize: 11, color: "#888780", marginTop: 3 }}>
                    {activeShopDetail === "actualIncome" ? "服務與商品依日期整合排列" : "點上方統計框可切換不同明細"}
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
            <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(7, 1fr)" : "repeat(2, 1fr)", gap: 8, marginBottom: 12 }}>
              {[
                { label: `${getDesignerLabel(activeReportDesigner)} 本月總業績`, value: `NT$${designerTotals.totalRevenue.toLocaleString()}`, color: "#534AB7" },
                { label: "實際收入", value: `NT$${designerTotals.actualIncome.toLocaleString()}`, color: "#1D9E75" },
                { label: "總客數", value: String(designerTotals.customerCount), color: "#0B66C3" },
                { label: "商品銷售", value: `NT$${designerTotals.productRevenue.toLocaleString()}`, color: "#BA7517" },
                { label: "自領材料", value: `-NT$${designerTotals.selfUse.toLocaleString()}`, color: "#A32D2D" },
                { label: "折扣", value: `-NT$${designerTotals.discount.toLocaleString()}`, color: "#E24B4A" },
                { label: "完成預約", value: String(monthlyTransactions.filter((item) => item.designer_id === activeReportDesigner.id).length), color: "#0B66C3" },
              ].map((card) => (
                <div key={card.label} style={{ background: "#fff", borderRadius: 12, border: "0.5px solid #D3D1C7", padding: 14 }}>
                  <div style={{ fontSize: 11, color: "#888780", fontWeight: 600, marginBottom: 8 }}>{card.label}</div>
                  <div style={{ fontSize: 18, color: card.color, fontWeight: 800 }}>{card.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr", gap: 12, marginBottom: 12 }}>
              <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #D3D1C7", overflow: "hidden" }}>
                <div style={{ padding: "12px 14px", fontSize: 14, color: "#2C2C2A", fontWeight: 700 }}>{getDesignerLabel(activeReportDesigner)} 月報摘要</div>
                {[
                  ["服務業績", designerTotals.serviceRevenue, false],
                  ["商品銷售", designerTotals.productRevenue, false],
                  ["自領材料", designerTotals.selfUse, true],
                  ["折扣", designerTotals.discount, true],
                  ["實際收入", designerTotals.actualIncome, false],
                ].map(([label, value, negative]) => (
                  <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderTop: "0.5px solid #F1EFE8", fontSize: 13, color: label === "實際收入" ? "#534AB7" : "#2C2C2A", fontWeight: label === "實際收入" ? 800 : 500 }}>
                    <span>{label}</span>
                    <span>{negative ? "-" : ""}NT${Number(value).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #D3D1C7", padding: 14 }}>
                <div style={{ fontSize: 14, color: "#2C2C2A", fontWeight: 700, marginBottom: 12 }}>明細入口</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {["服務明細", "商品銷售明細", "自領商品明細", "折扣明細"].map((item) => (
                    <button key={item} style={{ border: "1px solid #D3D1C7", background: "#FAFAF8", borderRadius: 12, padding: "18px 10px", textAlign: "left", color: "#2C2C2A", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{item} ›</button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {reportMode === "shop" && (
        <>

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

        </>
        )}
      </div>

      <AdminBottomNav current="report" />
    </div>
  );
}
