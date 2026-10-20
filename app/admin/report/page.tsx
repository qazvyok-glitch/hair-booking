"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminBottomNav from "../components/BottomNav";
import SettlementPreviewPage from "./settlement/page";
import { downloadExcelWorkbook, readExcelRows } from "../../../lib/excel";

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
  sourceType?: "service" | "product" | "selfUse" | "discount" | "legacy";
  sourceId?: number;
  sourceIndex?: number;
};

type AdjustmentAuditLog = {
  id: string;
  changedAt: string;
  username: string;
  roleName: string;
  designerName: string;
  itemName: string;
  category: string;
  beforeName?: string;
  afterName?: string;
  beforeAmount: number;
  afterAmount: number;
  reason: string;
  eventType?: string;
};

type ImportPreviewOrder = {
  orderNo: string;
  orderTime: string;
  designerName: string;
  month: string;
  itemCount: number;
  totalAmount: number;
  error: string;
  txData: Record<string, any> | null;
};

type ImportPreview = {
  fileName: string;
  orders: ImportPreviewOrder[];
};

type ImportBatch = {
  id: string;
  file_name: string;
  admin_username: string;
  status: "completed" | "partial" | "reverted";
  total_count: number;
  success_count: number;
  skipped_count: number;
  error_count: number;
  months: string[];
  transaction_ids: number[];
  error_messages: string[];
  created_at: string;
  reverted_at?: string | null;
  reverted_by?: string | null;
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
      sourceType: "service",
      sourceId: transaction.id,
      sourceIndex: index,
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
      sourceType: "product",
      sourceId: transaction.id,
      sourceIndex: index,
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
        sourceType: "legacy",
        sourceId: transaction.id,
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
  const designerIncome = Math.max(0, totals.serviceRevenue - serviceCommission - brandFee - totals.selfUse - totals.discount);
  const bcReceivable = Math.max(0, serviceCommission + brandFee + totals.selfUse);
  return {
    totals,
    serviceCommission,
    brandFee,
    designerIncome,
    bcReceivable,
  };
}

type AdminReportProps = {
  initialMode?: "shop" | "designer";
  importOnly?: boolean;
};

export default function AdminReport({ initialMode = "shop", importOnly = false }: AdminReportProps = {}) {
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
  const [activeDesignerDetail, setActiveDesignerDetail] = useState<DesignerDetailKey>("serviceRevenue");
  const [reportDesignerId, setReportDesignerId] = useState<number | null>(null);
  const [selectedShopDesignerId, setSelectedShopDesignerId] = useState<number | null>(null);
  // 名字顯示模式：english = 英文名, chinese = 中文名, both = 英文（中文）
  const [nameMode, setNameMode] = useState<"english" | "chinese" | "both">("both");
  const [editingDetail, setEditingDetail] = useState<ReportDetailRow | null>(null);
  const [editAmount, setEditAmount] = useState(0);
  const [editItemName, setEditItemName] = useState("");
  const [editReason, setEditReason] = useState("");
  const [savingDetail, setSavingDetail] = useState(false);
  const [isHistoricalCorrection, setIsHistoricalCorrection] = useState(false);
  const [settlementLocked, setSettlementLocked] = useState(false);
  const [adjustmentAuditLogs, setAdjustmentAuditLogs] = useState<AdjustmentAuditLog[]>([]);
  const [auditRefresh, setAuditRefresh] = useState(0);

  // 匯入歷史資料
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string>("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
  const [revertingBatchId, setRevertingBatchId] = useState<string | null>(null);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mode") === "designer") {
      queueMicrotask(() => setReportMode("designer"));
    }
  }, []);

  useEffect(() => {
    const month = reportStartDate.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    async function loadSettlementControl() {
      const [{ data: snapshotData }, { data: auditData }] = await Promise.all([
        supabase.from("shop_info").select("value").eq("key", `monthly_settlement_${month}`).maybeSingle(),
        supabase.from("settlement_audit_logs").select("*").eq("settlement_month", month).order("created_at", { ascending: false }),
      ]);
      setSettlementLocked(Boolean(snapshotData?.value));
      setAdjustmentAuditLogs((auditData || []).map((log: any) => ({
        id: String(log.id),
        changedAt: log.created_at,
        username: log.admin_username,
        roleName: log.admin_role_name,
        designerName: log.designer_name,
        itemName: log.item_name,
        category: log.category,
        beforeName: log.before_name,
        afterName: log.after_name,
        beforeAmount: Number(log.before_amount || 0),
        afterAmount: Number(log.after_amount || 0),
        reason: log.reason,
        eventType: log.event_type,
      })));
    }
    void loadSettlementControl();
  }, [reportStartDate, auditRefresh]);

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

  function openDetailEditor(row: ReportDetailRow, historicalCorrection = false) {
    setEditingDetail(row);
    setEditAmount(Number(row.amount.replace(/[^0-9.-]/g, "")) || 0);
    setEditItemName(row.itemName.split("｜").pop() || row.itemName);
    setEditReason("");
    setIsHistoricalCorrection(historicalCorrection);
  }

  function isDetailEditable(row: ReportDetailRow) {
    if (!row.sourceType || row.sourceType === "legacy" || settlementLocked) return false;
    const recordMonth = row.date.slice(0, 7).replace("/", "-");
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}`;
    if (recordMonth >= currentMonth) return true;
    return recordMonth === previousMonth && now.getDate() <= 10;
  }

  function detailLockLabel(row: ReportDetailRow) {
    if (row.sourceType === "legacy") return "歷史匯入・已鎖定";
    if (settlementLocked) return "帳單已確認・已鎖定";
    return "已逾修改期限";
  }

  async function appendAdjustmentAudit(log: AdjustmentAuditLog, month: string) {
    const { data, error } = await supabase.from("settlement_audit_logs").insert({
      settlement_month: month,
      designer_id: activeReportDesigner?.id || null,
      designer_name: log.designerName,
      event_type: log.eventType || (isHistoricalCorrection ? "historical_correction" : "detail_update"),
      category: log.category,
      item_name: log.itemName,
      before_name: log.beforeName || null,
      after_name: log.afterName || null,
      before_amount: log.beforeAmount,
      after_amount: log.afterAmount,
      reason: log.reason,
      admin_username: log.username,
      admin_role_name: log.roleName,
      created_at: log.changedAt,
    }).select("id").single();
    if (error) throw error;
    if (month === reportStartDate.slice(0, 7)) setAdjustmentAuditLogs((logs) => [{ ...log, id: String(data.id) }, ...logs]);
  }

  async function saveDetailCorrection() {
    if (!editingDetail?.sourceType || !editingDetail.sourceId || editingDetail.sourceType === "legacy") return;
    if (!isHistoricalCorrection && !isDetailEditable(editingDetail)) {
      alert("這筆資料已鎖定，不能修改");
      setEditingDetail(null);
      return;
    }
    if (!editReason.trim()) {
      alert("請填寫修改原因");
      return;
    }
    setSavingDetail(true);
    try {
      const recordMonth = editingDetail.date.slice(0, 7).replace("/", "-");
      if (!isHistoricalCorrection) {
        const { data: latestSnapshot, error: lockCheckError } = await supabase.from("shop_info").select("id").eq("key", `monthly_settlement_${recordMonth}`).maybeSingle();
        if (lockCheckError) throw lockCheckError;
        if (latestSnapshot) {
          setSettlementLocked(true);
          throw new Error("本月帳單已由其他管理員確認，資料已鎖定");
        }
      }
      const beforeAmount = Number(editingDetail.amount.replace(/[^0-9.-]/g, "")) || 0;
      if (editingDetail.sourceType === "selfUse") {
        const usage = productUsages.find((item) => item.id === editingDetail.sourceId);
        if (!usage) throw new Error("找不到自領資料");
        const quantity = Number(usage.quantity || 1);
        const nextUsage = { ...usage, product_name: editItemName.trim() || usage.product_name, total_cost: editAmount, unit_price: quantity > 0 ? Math.round(editAmount / quantity) : editAmount };
        const { error } = await supabase.from("product_usage").update({ product_name: nextUsage.product_name, total_cost: nextUsage.total_cost, unit_price: nextUsage.unit_price }).eq("id", usage.id);
        if (error) throw error;
        setProductUsages((items) => items.map((item) => item.id === usage.id ? nextUsage : item));
      } else {
        const transaction = transactions.find((item) => item.id === editingDetail.sourceId);
        if (!transaction) throw new Error("找不到交易資料");
        const serviceItems = [...(transaction.service_items || [])];
        const productItems = [...(transaction.product_items || [])];
        const index = editingDetail.sourceIndex ?? -1;
        let totalAmount = Number(transaction.total_amount || 0);
        if (editingDetail.sourceType === "service") {
          const oldAmount = Number(serviceItems[index]?.amount || 0);
          serviceItems[index] = { ...serviceItems[index], name: editItemName.trim() || serviceItems[index]?.name, amount: editAmount };
          totalAmount += editAmount - oldAmount;
        } else if (editingDetail.sourceType === "product") {
          const quantity = Number(productItems[index]?.quantity || 1);
          const oldAmount = Number(productItems[index]?.amount || 0);
          productItems[index] = { ...productItems[index], name: editItemName.trim() || productItems[index]?.name, amount: editAmount / quantity };
          totalAmount += editAmount - oldAmount * quantity;
        } else if (editingDetail.sourceType === "discount") {
          serviceItems[index] = { ...serviceItems[index], name: editItemName.trim() || serviceItems[index]?.name, discount: editAmount };
        }
        const correctionNote = `[${isHistoricalCorrection ? "歷史更正" : "後台更正"} ${new Date().toLocaleString("zh-TW")}] ${editingDetail.itemName} → ${editItemName.trim() || editingDetail.itemName}；${editReason.trim()}`;
        const note = [transaction.note, correctionNote].filter(Boolean).join("\n");
        const { error } = await supabase.from("transactions").update({ service_items: serviceItems, product_items: productItems, total_amount: totalAmount, note }).eq("id", transaction.id);
        if (error) throw error;
        setTransactions((items) => items.map((item) => item.id === transaction.id ? { ...item, service_items: serviceItems, product_items: productItems, total_amount: totalAmount, note } : item));
      }
      const session = JSON.parse(sessionStorage.getItem("adminSession") || "{}");
      const changedAt = new Date().toISOString();
      await appendAdjustmentAudit({
        id: `${changedAt}-${editingDetail.sourceType}-${editingDetail.sourceId}`,
        changedAt,
        username: session.username || "admin",
        roleName: session.role_name || (session.role === "manager" ? "店長管理員" : "最高管理員"),
        designerName: editingDetail.designerName || (activeReportDesigner ? getDesignerLabel(activeReportDesigner) : "-"),
        itemName: editingDetail.itemName,
        category: isHistoricalCorrection ? `歷史更正・${editingDetail.kind}` : editingDetail.kind,
        beforeName: editingDetail.itemName,
        afterName: editItemName.trim() || editingDetail.itemName,
        beforeAmount,
        afterAmount: editAmount,
        reason: editReason.trim(),
      }, recordMonth);
      setEditingDetail(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "修改失敗，請再試一次");
    } finally {
      setSavingDetail(false);
    }
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

  function arrayBufferToBase64(buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  async function applyChinesePdfFont(doc: jsPDF) {
    const response = await fetch("/fonts/NotoSansTC.ttf");
    if (!response.ok) throw new Error("中文字型載入失敗");
    const fontBase64 = arrayBufferToBase64(await response.arrayBuffer());
    doc.addFileToVFS("NotoSansTC.ttf", fontBase64);
    doc.addFont("NotoSansTC.ttf", "NotoSansTC", "normal");
    doc.addFont("NotoSansTC.ttf", "NotoSansTC", "bold");
    doc.setFont("NotoSansTC", "normal");
  }

  async function loadImageAsDataUrl(path: string) {
    const response = await fetch(path);
    if (!response.ok) return "";
    const blob = await response.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(blob);
    });
  }

  async function svgToPngDataUrl(svg: string, width: number, height: number) {
    return await new Promise<string>((resolve, reject) => {
      const image = new Image();
      const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          URL.revokeObjectURL(svgUrl);
          reject(new Error("無法建立 PDF 圖片畫布"));
          return;
        }
        context.fillStyle = "#fff";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        URL.revokeObjectURL(svgUrl);
        resolve(canvas.toDataURL("image/png", 1));
      };
      image.onerror = () => {
        URL.revokeObjectURL(svgUrl);
        reject(new Error("報表圖片生成失敗"));
      };
      image.src = svgUrl;
    });
  }

  function normalizePdfText(value: any) {
    // PDF 字型不支援彩色 emoji，導出時移除 emoji 可避免出現方塊。
    return String(value ?? "").replace(/[\u{1F300}-\u{1FAFF}\u{FE0F}]/gu, "").trim();
  }

  function getPdfMonthLabel() {
    const start = new Date(`${reportStartDate}T00:00:00`);
    const end = new Date(`${reportEndDate}T00:00:00`);
    if (Number.isNaN(start.getTime())) return selectedMonth.slice(5) + "月份";
    const startLabel = `${start.getMonth() + 1}月份`;
    if (Number.isNaN(end.getTime()) || start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
      return startLabel;
    }
    return `${start.getMonth() + 1}-${end.getMonth() + 1}月份`;
  }

  function getRocMonthLabel(dateString: string) {
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateString;
    return `${date.getFullYear() - 1911} / ${String(date.getMonth() + 1).padStart(2, "0")}月`;
  }

  function getPdfDateLabel(dateString: string) {
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateString.replace(/-/g, " / ");
    return `${date.getFullYear()} / ${String(date.getMonth() + 1).padStart(2, "0")} / ${String(date.getDate()).padStart(2, "0")}`;
  }

  // 導出 Excel — 格式與舊系統訂單列表對齊
  async function exportExcel() {
    try {
      const exportTx = getExportTransactions();

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

      // ── Sheet 2：訂單列表（對齊舊系統格式）──
      // 欄位：訂單號碼 / 訂單時間 / 分類 / 品項 / 數量 / 總價 / 折扣 / 工作人員 / 指定 / 業績 / 支付方式
      const tr = buildExportOrderRows(exportTx);

      // ── Sheet 3：年度統計 ──
      const yr = yearlyData.map(([month, amount]: any) => ({ "月份": month, "總業績": amount }));
      await downloadExcelWorkbook([
        { name: "設計師抽成", rows: dr },
        { name: "訂單列表", rows: tr },
        { name: "年度統計", rows: yr },
      ], "BC_報表_" + getExportLabel() + ".xlsx");
    } catch(e) {
      alert("Excel 導出失敗");
    }
  }

  async function exportPdf() {
    try {
      const exportTx = getExportTransactions();
      const orderRows = buildExportOrderRows(exportTx);
      const exportDesigners = getExportDesigners();
      const formatPdfMoney = (amount: number) => `NT$${Number(amount || 0).toLocaleString()}`;
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      await applyChinesePdfFont(doc);
      const targetLabel = exportDesigners.length === designers.length ? "全員" : exportDesigners.map((designer) => normalizePdfText(getExportName(designer))).join("、");
      const logoDataUrl = await loadImageAsDataUrl("/logo.png");
      const wordmarkDataUrl = await loadImageAsDataUrl("/report-wordmark.png");
      const coverDataUrl = await loadImageAsDataUrl("/report-cover-template.jpg");
      const reports = exportDesigners.map((designer) => ({ designer, report: calcDesignerReport(designer) }));
      const feeRows = reports.flatMap(({ designer, report }) => [
        [
          getRocMonthLabel(reportStartDate) + " - 收益共享服務費",
          "1",
          "",
          report.serviceCommission.toLocaleString(),
          `服務業績 ${formatPdfMoney(report.serviceRevenue)}`,
        ],
        [
          getRocMonthLabel(reportStartDate) + " - 品牌社群資源共享費",
          "1",
          "",
          report.brandFee.toLocaleString(),
          `服務業績 ${formatPdfMoney(report.serviceRevenue)}`,
        ],
      ]);
      const feeTotal = reports.reduce((sum, item) => sum + item.report.serviceCommission + item.report.brandFee, 0);
      const exportDesignerIds = new Set(exportDesigners.map((designer) => designer.id));
      const productRows = monthlyProductUsages
        .filter((usage) => exportDesignerIds.has(usage.designer_id))
        .map((usage) => [
          formatReportDate(usage.used_at),
          String(Number(usage.quantity || 1)),
          normalizePdfText(usage.product_name),
          Number(usage.total_cost || 0).toLocaleString(),
        ]);
      const productTotal = productRows.reduce((sum, row) => sum + Number(String(row[3] || "0").replace(/[^\d.-]/g, "")), 0);
      const serviceTotal = reports.reduce((sum, item) => sum + item.report.serviceRevenue, 0);
      const totalDue = feeTotal + productTotal;
      const detailRows = orderRows.map((row) => [
        row["訂單號碼"],
        row["訂單時間"],
        row["分類"],
        normalizePdfText(row["品項"]),
        row["數量"],
        row["總價"],
        row["折扣"],
        normalizePdfText(row["工作人員"]),
        row["支付方式"],
      ]);
      let carriedOrderTime = "";
      const dailySalesRows = detailRows
        .map((row, index) => {
          if (row[1]) carriedOrderTime = String(row[1]);
          return { row, orderTime: carriedOrderTime, index };
        })
        .filter(({ row }) => String(row[2]).startsWith("美髮-") || String(row[2]) === "商品")
        .sort((a, b) => a.orderTime.localeCompare(b.orderTime) || a.index - b.index)
        .map(({ row }) => row);
      const dailyDetailItems = dailySalesRows.map((row) => ({
        date: String(row[1] || ""),
        category: String(row[2] || ""),
        item: String(row[3] || ""),
        amount: Number(String(row[5] || "0").replace(/[^\d.-]/g, "")),
        discount: Number(String(row[6] || "0").replace(/[^\d.-]/g, "")),
        designer: String(row[7] || ""),
        payment: String(row[8] || ""),
      }));
      const dailyServiceTotal = dailyDetailItems
        .filter((item) => item.category.startsWith("美髮-"))
        .reduce((sum, item) => sum + item.amount, 0);
      const dailyProductTotal = dailyDetailItems
        .filter((item) => item.category === "商品")
        .reduce((sum, item) => sum + item.amount, 0);
      const dailyDiscountTotal = dailyDetailItems.reduce((sum, item) => sum + item.discount, 0);
      const serviceCategoryTotals: { label: string; amount: number }[] = Array.from(orderRows.reduce<Map<string, number>>((map, row) => {
        const category = normalizePdfText(row["分類"]);
        if (!category.startsWith("美髮-")) return map;
        const amount = Number(row["業績"] || 0);
        if (amount <= 0) return map;
        const label = category.replace("美髮-", "");
        map.set(label, (map.get(label) || 0) + amount);
        return map;
      }, new Map<string, number>())).map(([label, amount]) => ({ label, amount }));

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      if (coverDataUrl) {
        doc.addImage(coverDataUrl, "JPEG", 0, 0, pageWidth, pageHeight);
        doc.setFillColor(52, 71, 61);
        doc.rect(265, 282, 265, 52, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("NotoSansTC", "bold");
        doc.setFontSize(28);
        doc.text(`${getPdfMonthLabel()} / ${targetLabel}`, 520, 318, { align: "right" });
      } else {
        doc.setFillColor(250, 250, 248);
        doc.rect(0, 0, pageWidth, pageHeight, "F");
        doc.setFillColor(52, 71, 61);
        doc.rect(72, 140, pageWidth - 144, 215, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("NotoSansTC", "normal");
        doc.setFontSize(44);
        doc.text("Monthly Report", pageWidth - 96, 216, { align: "right" });
        doc.setFontSize(34);
        doc.text("月報表", pageWidth - 96, 274, { align: "right" });
        doc.setFont("NotoSansTC", "bold");
        doc.setFontSize(30);
        doc.text(`${getPdfMonthLabel()} / ${targetLabel}`, pageWidth - 96, 326, { align: "right" });
        if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", pageWidth / 2 - 48, 418, 96, 96);
        doc.setTextColor(20, 20, 20);
        doc.setFontSize(32);
        doc.text("Bing Cherry", pageWidth / 2, 565, { align: "center" });
        doc.setFont("NotoSansTC", "normal");
        doc.setFontSize(24);
        doc.text("Hair Hub 2.0", pageWidth / 2, 602, { align: "center" });
        doc.setFontSize(20);
        doc.text("超越共享，打造屬於我們的美髮社區", pageWidth / 2, 720, { align: "center" });
      }

      doc.addPage("a4", "portrait");
      const svgWidth = 1190;
      const svgHeight = 1684;
      const escapeSvg = (value: unknown) => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      const wrapSvgText = (value: unknown, maxChars = 24) => {
        const text = escapeSvg(value);
        if (text.length <= maxChars) return [text];
        return [text.slice(0, maxChars), text.slice(maxChars, maxChars * 2)];
      };
      const renderText = (value: unknown, x: number, y: number, options: { anchor?: "start" | "middle" | "end"; size?: number; color?: string; weight?: number; maxChars?: number; lineHeight?: number } = {}) => {
        const lines = wrapSvgText(value, options.maxChars || 28);
        const lineHeight = options.lineHeight || (options.size || 20) + 6;
        const tspans = lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${line}</tspan>`).join("");
        return `<text x="${x}" y="${y}" text-anchor="${options.anchor || "start"}" font-size="${options.size || 20}" font-weight="${options.weight || 400}" fill="${options.color || "#263544"}">${tspans}</text>`;
      };
      const renderInvoiceTable = ({
        y,
        title,
        columns,
        rows,
        theme,
        rowHeight = 43,
        showHeader = true,
      }: {
        y: number;
        title: string;
        columns: { label: string; width: number; align?: "left" | "center" | "right"; maxChars?: number }[];
        rows: string[][];
        theme: { main: string; header: string; stripe: string; subtotal: string; line: string; text: string; headerText: string };
        rowHeight?: number;
        showHeader?: boolean;
      }) => {
        const x = 38;
        const width = 1114;
        const titleHeight = 58;
        const headerHeight = showHeader ? 50 : 0;
        const height = titleHeight + headerHeight + rows.length * rowHeight;
        let html = `<g>`;
        html += `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="15" fill="#fff" stroke="${theme.main}" stroke-width="3"/>`;
        html += `<path d="M ${x + 15} ${y} H ${x + width - 15} Q ${x + width} ${y} ${x + width} ${y + 15} V ${y + titleHeight} H ${x} V ${y + 15} Q ${x} ${y} ${x + 15} ${y}" fill="${theme.main}"/>`;
        html += renderText(title, x + width / 2, y + 38, { anchor: "middle", size: 30, color: "#fff", weight: 400 });
        if (showHeader) html += `<rect x="${x}" y="${y + titleHeight}" width="${width}" height="${headerHeight}" fill="${theme.header}"/>`;
        let currentX = x;
        if (showHeader) {
          columns.forEach((column) => {
            html += renderText(column.label, currentX + column.width / 2, y + titleHeight + 32, { anchor: "middle", size: 22, color: theme.headerText, weight: 700 });
            currentX += column.width;
          });
        }
        rows.forEach((row, rowIndex) => {
          const rowY = y + titleHeight + headerHeight + rowIndex * rowHeight;
          const fill = rowIndex === rows.length - 1 ? theme.subtotal : "#fff";
          html += `<rect x="${x}" y="${rowY}" width="${width}" height="${rowHeight}" fill="${fill}"/>`;
          currentX = x;
          row.forEach((cell, cellIndex) => {
            const column = columns[cellIndex];
            const anchor = column.align === "right" ? "end" : column.align === "center" ? "middle" : "start";
            const textX = column.align === "right" ? currentX + column.width - 12 : column.align === "center" ? currentX + column.width / 2 : currentX + 12;
            html += renderText(cell, textX, rowY + (rowHeight > 48 ? 25 : 28), {
              anchor,
              size: rowIndex === rows.length - 1 ? 20 : 19,
              weight: rowIndex === rows.length - 1 ? 700 : 400,
              color: theme.text,
              maxChars: column.maxChars || 26,
              lineHeight: 22,
            });
            currentX += column.width;
          });
        });
        currentX = x;
        columns.slice(0, -1).forEach((column) => {
          currentX += column.width;
          html += `<line x1="${currentX}" y1="${y + titleHeight}" x2="${currentX}" y2="${y + height}" stroke="${theme.line}" stroke-width="1.3"/>`;
        });
        for (let i = 0; i <= rows.length; i += 1) {
          const lineY = y + titleHeight + headerHeight + i * rowHeight;
          html += `<line x1="${x}" y1="${lineY}" x2="${x + width}" y2="${lineY}" stroke="${i === rows.length - 1 ? theme.main : theme.line}" stroke-width="${i === rows.length - 1 ? 2.4 : 1.3}"/>`;
        }
        html += `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="15" fill="none" stroke="${theme.main}" stroke-width="3.2"/>`;
        html += `</g>`;
        return { html, endY: y + height };
      };
      const renderPieChart = (items: { label: string; amount: number }[], cx: number, cy: number, r: number) => {
        const colors = ["#1674AE", "#D96724", "#42B34E", "#C8A46B", "#7A5BD6", "#2FB7B4"];
        const total = items.reduce((sum, item) => sum + item.amount, 0);
        if (total <= 0) {
          return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#EEF1F3"/>
            ${renderText("本月無服務", cx, cy + 6, { anchor: "middle", size: 18, color: "#7D7A73", weight: 700 })}`;
        }
        let startAngle = -Math.PI / 2;
        const slices = items.map((item, index) => {
          const angle = (item.amount / total) * Math.PI * 2;
          const endAngle = startAngle + angle;
          const largeArc = angle > Math.PI ? 1 : 0;
          const x1 = cx + Math.cos(startAngle) * r;
          const y1 = cy + Math.sin(startAngle) * r;
          const x2 = cx + Math.cos(endAngle) * r;
          const y2 = cy + Math.sin(endAngle) * r;
          startAngle = endAngle;
          return `<path d="M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${colors[index % colors.length]}"/>`;
        }).join("");
        const legend = items.slice(0, 5).map((item, index) => {
          const y = cy - 80 + index * 40;
          return `<rect x="${cx + 200}" y="${y - 17}" width="20" height="20" rx="5" fill="${colors[index % colors.length]}"/>
            ${renderText(item.label, cx + 234, y, { size: 19, color: "#263544", weight: 800, maxChars: 8 })}
            ${renderText(formatPdfMoney(item.amount), cx + 500, y, { anchor: "end", size: 19, color: "#52606D", weight: 800 })}`;
        }).join("");
        return `${slices}<circle cx="${cx}" cy="${cy}" r="${r - 30}" fill="#fff"/>
          ${renderText("服務項目", cx, cy - 5, { anchor: "middle", size: 16, color: "#7D7A73", weight: 700 })}
          ${renderText(formatPdfMoney(total), cx, cy + 25, { anchor: "middle", size: 22, color: "#263A32", weight: 900 })}
          ${legend}`;
      };
      const productUsageCount = productRows.reduce((sum, row) => sum + Number(row[1] || 0), 0);
      const serviceCommissionTotal = reports.reduce((sum, item) => sum + item.report.serviceCommission, 0);
      const brandFeeTotal = reports.reduce((sum, item) => sum + item.report.brandFee, 0);
      const serviceRateLabel = reports.length === 1 ? `${Math.round(Number(reports[0].designer.commission_rate || 0) * 100)}%` : "依個人合約";
      const brandRateLabel = reports.length === 1 ? `${Math.round(Number(reports[0].report.brandFeeRate || 0) * 100)}%` : "依個人合約";
      const visibleProductRows = productRows.slice(0, 5);
      const reportYearMonth = `${reportStartDate.slice(0, 4)}年${Number(reportStartDate.slice(5, 7))}月`;
      const invoiceSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
        <rect width="100%" height="100%" fill="#fff"/>
        ${renderText("Bing Cherry Hair Salon", 50, 78, { size: 20, color: "#617083", weight: 500 })}
        ${renderText("設計師月結帳單", 50, 142, { size: 48, color: "#132337", weight: 900 })}
        ${renderText(reportYearMonth, 490, 142, { size: 29, color: "#52606D", weight: 800 })}
        ${renderText(targetLabel, 50, 192, { size: 27, color: "#263544", weight: 600 })}
        <rect x="830" y="52" width="310" height="142" rx="18" fill="#E8F5FC"/>
        ${renderText("本月應繳總額", 985, 98, { anchor: "middle", size: 20, color: "#1674AE", weight: 800 })}
        ${renderText(formatPdfMoney(totalDue), 985, 158, { anchor: "middle", size: 43, color: "#1269A5", weight: 900 })}

        <rect x="40" y="238" width="1110" height="410" rx="16" fill="#fff" stroke="#CBD9E6" stroke-width="2"/>
        <rect x="68" y="278" width="8" height="38" rx="4" fill="#1674AE"/>
        ${renderText("服務項目分布", 90, 309, { size: 29, color: "#132337", weight: 900 })}
        ${renderPieChart(serviceCategoryTotals, 405, 475, 128)}

        <rect x="40" y="680" width="1110" height="342" rx="16" fill="#fff" stroke="#CBD9E6" stroke-width="2"/>
        <rect x="68" y="718" width="8" height="38" rx="4" fill="#1674AE"/>
        ${renderText("本月結算摘要", 90, 749, { size: 29, color: "#132337", weight: 900 })}
        ${[["服務業績", formatPdfMoney(serviceTotal), "#EEF7FF"], [`收益共享服務費（${serviceRateLabel}）`, formatPdfMoney(serviceCommissionTotal), "#EDF9F5"], [`品牌社群資源共享費（${brandRateLabel}）`, formatPdfMoney(brandFeeTotal), "#FFF8E8"], ["自領商品", formatPdfMoney(productTotal), "#FFF3EC"]].map((row, index) => {
          const y = 786 + index * 58;
          return `<rect x="68" y="${y}" width="1052" height="58" rx="8" fill="${row[2]}"/>${renderText(row[0], 88, y + 38, { size: 20, color: "#334B61", weight: 800 })}${renderText(row[1], 1100, y + 38, { anchor: "end", size: 23, color: "#132337", weight: 900 })}`;
        }).join("")}

        <rect x="40" y="1054" width="1110" height="430" rx="16" fill="#fff" stroke="#EDC79B" stroke-width="2"/>
        <rect x="40" y="1054" width="8" height="430" rx="4" fill="#D9892B"/>
        ${renderText("自領商品明細", 76, 1100, { size: 27, color: "#263544", weight: 900 })}
        ${renderText(`${formatReportDate(reportStartDate)}－${formatReportDate(reportEndDate)}`, 1110, 1100, { anchor: "end", size: 17, color: "#7D7A73", weight: 600 })}
        <rect x="52" y="1124" width="1086" height="48" fill="#FFF4E7"/>
        ${renderText("日期", 76, 1155, { size: 18, color: "#8A5A20", weight: 800 })}
        ${renderText("商品名稱", 300, 1155, { size: 18, color: "#8A5A20", weight: 800 })}
        ${renderText("數量", 880, 1155, { anchor: "middle", size: 18, color: "#8A5A20", weight: 800 })}
        ${renderText("小計", 1110, 1155, { anchor: "end", size: 18, color: "#8A5A20", weight: 800 })}
        ${visibleProductRows.length ? visibleProductRows.map((row, index) => {
          const y = 1172 + index * 48;
          return `<line x1="52" y1="${y}" x2="1138" y2="${y}" stroke="#F0DFCC"/>${renderText(row[0], 76, y + 31, { size: 16, color: "#3D4C59", weight: 600 })}${renderText(row[2], 300, y + 31, { size: 16, color: "#263544", weight: 600, maxChars: 30 })}${renderText(row[1], 880, y + 31, { anchor: "middle", size: 16, color: "#3D4C59", weight: 600 })}${renderText(formatPdfMoney(Number(String(row[3]).replace(/[^\d.-]/g, ""))), 1110, y + 31, { anchor: "end", size: 16, color: "#263544", weight: 800 })}`;
        }).join("") : renderText("本期無自領商品", 76, 1220, { size: 18, color: "#7D7A73", weight: 600 })}
        ${productRows.length > visibleProductRows.length ? renderText(`另有 ${productRows.length - visibleProductRows.length} 筆，請至系統查看完整明細`, 76, 1430, { size: 15, color: "#8A5A20", weight: 600 }) : ""}
        <rect x="52" y="1430" width="1086" height="42" fill="#FFF4E7"/>
        ${renderText(`合計 ${productUsageCount.toLocaleString()} 件`, 76, 1458, { size: 18, color: "#8A5A20", weight: 800 })}
        ${renderText(formatPdfMoney(productTotal), 1110, 1458, { anchor: "end", size: 19, color: "#8A5A20", weight: 900 })}

        <line x1="40" y1="1530" x2="1150" y2="1530" stroke="#D6E0E8" stroke-width="2"/>
        ${renderText("備註", 78, 1574, { size: 21, color: "#4E5965", weight: 800 })}
        ${renderText("本報表依系統完成交易及個人合約設定自動計算。", 78, 1608, { size: 16, color: "#75808A", weight: 500 })}
      </svg>`;
      const invoiceDataUrl = await svgToPngDataUrl(invoiceSvg, svgWidth, svgHeight);
      doc.addImage(invoiceDataUrl, "PNG", 0, 0, pageWidth, pageHeight);

      const renderDailyDetailPage = (items: typeof dailyDetailItems, pageIndex: number, pageCount: number, includeTotal: boolean) => {
        const x = 38;
        const width = 1114;
        const headerY = 120;
        const headerHeight = 48;
        const rowHeight = 43;
        const columns = [
          { label: "訂單日期", x: 0, width: 188, align: "start" as const },
          { label: "分類", x: 188, width: 126, align: "start" as const },
          { label: "品項", x: 314, width: 376, align: "start" as const },
          { label: "金額", x: 690, width: 108, align: "end" as const },
          { label: "折扣", x: 798, width: 80, align: "end" as const },
          { label: "設計師", x: 878, width: 108, align: "start" as const },
          { label: "支付方式", x: 986, width: 128, align: "start" as const },
        ];
        const rowsSvg = items.map((item, index) => {
          const rowY = headerY + headerHeight + index * rowHeight;
          const isProduct = item.category === "商品";
          const fill = index % 2 === 0 ? "#E2F0FC" : "#FFFFFF";
          const color = isProduct ? "#E02A1F" : "#20262C";
          return `<g>
            <rect x="${x}" y="${rowY}" width="${width}" height="${rowHeight}" fill="${fill}"/>
            ${renderText(item.date, x + 12, rowY + 27, { size: 15, color: isProduct ? "#D7231A" : "#164F94", weight: 700, maxChars: 18 })}
            ${renderText(item.category, x + 200, rowY + 27, { size: 15, color, weight: isProduct ? 800 : 600, maxChars: 9 })}
            ${renderText(item.item, x + 326, rowY + 27, { size: 15, color, weight: isProduct ? 800 : 500, maxChars: 24, lineHeight: 19 })}
            ${renderText(item.amount.toLocaleString(), x + 786, rowY + 27, { anchor: "end", size: 15, color, weight: 700 })}
            ${renderText(item.discount.toLocaleString(), x + 866, rowY + 27, { anchor: "end", size: 15, color, weight: 700 })}
            ${renderText(item.designer, x + 890, rowY + 27, { size: 15, color, weight: isProduct ? 800 : 500, maxChars: 8 })}
            ${renderText(item.payment, x + 998, rowY + 27, { size: 15, color, weight: isProduct ? 800 : 500, maxChars: 12 })}
          </g>`;
        }).join("");
        const totalY = headerY + headerHeight + items.length * rowHeight + 8;
        const totalSvg = includeTotal ? `<g>
          <rect x="${x}" y="${totalY}" width="${width}" height="56" fill="#D4E9FA"/>
          ${renderText("總計", x + 12, totalY + 36, { size: 22, color: "#20262C", weight: 900 })}
          ${renderText(`${dailyDetailItems.length.toLocaleString()} 筆`, x + 170, totalY + 36, { size: 20, color: "#20262C", weight: 800 })}
          ${renderText(`服務業績 ${dailyServiceTotal.toLocaleString()}`, x + 350, totalY + 36, { size: 19, color: "#164F94", weight: 900 })}
          ${renderText(`商品 ${dailyProductTotal.toLocaleString()}`, x + 690, totalY + 36, { size: 19, color: "#D96724", weight: 900 })}
          ${renderText(`折扣 ${dailyDiscountTotal.toLocaleString()}`, x + width - 16, totalY + 36, { anchor: "end", size: 19, color: "#20262C", weight: 900 })}
        </g>` : "";
        const emptySvg = !items.length ? renderText("此區間尚無每日明細", x + 12, headerY + headerHeight + 52, { size: 22, color: "#59636D", weight: 700 }) : "";
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
          <style>text{font-family:'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif;dominant-baseline:alphabetic;}</style>
          <rect width="100%" height="100%" fill="#fff"/>
          ${renderText("每日明細", 38, 76, { size: 38, color: "#20262C", weight: 900 })}
          <rect x="${x}" y="${headerY}" width="${width}" height="${headerHeight}" fill="#009799"/>
          ${columns.map((column) => renderText(column.label, x + column.x + 12, headerY + 32, { size: 19, color: "#fff", weight: 800 })).join("")}
          ${rowsSvg}
          ${emptySvg}
          ${totalSvg}
          ${renderText(`第 ${pageIndex + 1} / ${pageCount} 頁`, 1152, 1644, { anchor: "end", size: 16, color: "#7D7A73", weight: 600 })}
        </svg>`;
      };
      const rowsPerPage = 31;
      const dailyPages = dailyDetailItems.length
        ? Array.from({ length: Math.ceil(dailyDetailItems.length / rowsPerPage) }, (_, index) => dailyDetailItems.slice(index * rowsPerPage, (index + 1) * rowsPerPage))
        : [[]];
      for (let index = 0; index < dailyPages.length; index += 1) {
        doc.addPage("a4", "portrait");
        const dailySvg = renderDailyDetailPage(dailyPages[index], index, dailyPages.length, index === dailyPages.length - 1);
        const dailyDataUrl = await svgToPngDataUrl(dailySvg, svgWidth, svgHeight);
        doc.addImage(dailyDataUrl, "PNG", 0, 0, pageWidth, pageHeight);
      }

      doc.save("BC_報表_" + getExportLabel() + ".pdf");
      return;
    } catch(e) {
      console.error("PDF export failed", e);
      const message = e instanceof Error ? e.message : String(e);
      alert(`PDF 導出失敗：${message || "請稍後再試"}`);
    }
  }

  function getCurrentAdminUsername() {
    try {
      return JSON.parse(sessionStorage.getItem("adminSession") || "{}").username || "admin";
    } catch {
      return "admin";
    }
  }

  async function loadImportBatches() {
    const { data } = await supabase.from("import_batches").select("*").order("created_at", { ascending: false }).limit(50);
    if (data) setImportBatches(data as ImportBatch[]);
  }

  // ── 匯入舊系統歷史資料：先預覽，再確認寫入 ──
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult("");
    setImportPreview(null);

    try {
      const buf = await file.arrayBuffer();
      const rows: any[] = await readExcelRows(buf);

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

      const previewOrders: ImportPreviewOrder[] = [];
      for (const order of Object.values(orderMap)) {
        const designer = findDesignerByDisplayName(designers, order.designerName);
        if (!designer) {
          previewOrders.push({ orderNo: order.orderNo, orderTime: order.orderTime, designerName: order.designerName, month: order.orderTime.slice(0, 7), itemCount: order.items.length, totalAmount: 0, error: `找不到設計師「${order.designerName}」`, txData: null });
          continue;
        }

        const createdAt = order.orderTime.replace(" ", "T") + ":00";
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(createdAt)) {
          previewOrders.push({ orderNo: order.orderNo, orderTime: order.orderTime, designerName: order.designerName, month: order.orderTime.slice(0, 7), itemCount: order.items.length, totalAmount: 0, error: "日期時間格式錯誤", txData: null });
          continue;
        }

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

        const duplicate = transactions.some((transaction) =>
          transaction.designer_id === designer.id &&
          transaction.created_at?.slice(0, 16) === createdAt.slice(0, 16) &&
          Number(transaction.total_amount || 0) === totalAmount
        );
        const txData = {
          designer_id: designer.id,
          customer_name: "",
          service_items: serviceItems,
          total_amount: totalAmount,
          payment_method: payMethod,
          created_at: createdAt,
        };
        previewOrders.push({ orderNo: order.orderNo, orderTime: order.orderTime, designerName: order.designerName, month: order.orderTime.slice(0, 7), itemCount: order.items.length, totalAmount, error: duplicate ? "疑似重複交易（同設計師、時間及金額）" : "", txData: duplicate ? null : txData });
      }
      setImportPreview({ fileName: file.name, orders: previewOrders });
    } catch (err: any) {
      setImportResult("檔案解析失敗：" + err.message);
    }
    setImporting(false);
    e.target.value = "";
  }

  async function confirmImport() {
    if (!importPreview || importing) return;
    const validOrders = importPreview.orders.filter((order) => order.txData);
    const invalidOrders = importPreview.orders.filter((order) => !order.txData);
    if (validOrders.length === 0) {
      setImportResult("沒有可匯入的交易，請先修正檔案內容。");
      return;
    }
    setImporting(true);
    setImportResult("");
    const months = [...new Set(validOrders.map((order) => order.month).filter((month) => /^\d{4}-\d{2}$/.test(month)))];
    const username = getCurrentAdminUsername();
    const { data: batch, error: batchError } = await supabase.from("import_batches").insert({
      file_name: importPreview.fileName,
      admin_username: username,
      total_count: importPreview.orders.length,
      skipped_count: invalidOrders.length,
      error_count: invalidOrders.length,
      months,
      error_messages: invalidOrders.map((order) => `${order.orderNo}：${order.error}`),
    }).select("id").single();
    if (batchError || !batch) {
      setImportResult(`無法建立匯入批次：${batchError?.message || "未知錯誤"}`);
      setImporting(false);
      return;
    }

    const transactionIds: number[] = [];
    const errors: string[] = invalidOrders.map((order) => `${order.orderNo}：${order.error}`);
    for (const order of validOrders) {
      const note = `[歷史匯入] 批次:${batch.id}｜訂單:${order.orderNo}`;
      const { data, error } = await supabase.from("transactions").insert({ ...order.txData, import_batch_id: batch.id, note }).select("id").single();
      if (error || !data) errors.push(`${order.orderNo}：${error?.message || "寫入失敗"}`);
      else transactionIds.push(Number(data.id));
    }

    const status = errors.length > invalidOrders.length ? "partial" : "completed";
    await supabase.from("import_batches").update({
      status,
      success_count: transactionIds.length,
      error_count: errors.length,
      transaction_ids: transactionIds,
      error_messages: errors,
    }).eq("id", batch.id);
    setImportResult(`匯入完成：${transactionIds.length} 筆成功${errors.length ? `，${errors.length} 筆未匯入` : ""}`);
    setImportPreview(null);
    const { data: tData } = await supabase.from("transactions").select("*").order("created_at", { ascending: false });
    if (tData) setTransactions(tData);
    await loadImportBatches();
    setImporting(false);
  }

  async function revertImportBatch(batch: ImportBatch) {
    if (batch.status === "reverted" || revertingBatchId) return;
    const monthKeys = batch.months.map((month) => `monthly_settlement_${month}`);
    if (monthKeys.length) {
      const { data: lockedRows } = await supabase.from("shop_info").select("key").in("key", monthKeys);
      if ((lockedRows || []).length > 0) {
        alert("此批次包含已鎖帳月份，不能整批撤銷。請至設計師月結明細使用「新增更正」。");
        return;
      }
    }
    if (!window.confirm(`確定撤銷「${batch.file_name}」的 ${batch.success_count} 筆交易？此動作會留下批次撤銷紀錄。`)) return;
    setRevertingBatchId(batch.id);
    const { error: deleteError } = await supabase.rpc("revert_import_batch_secure", { p_batch_id: batch.id });
    if (deleteError) {
      alert(`撤銷失敗：${deleteError.message.includes("locked month") ? "此批次包含已鎖帳月份" : deleteError.message}`);
      setRevertingBatchId(null);
      return;
    }
    const { data: tData } = await supabase.from("transactions").select("*").order("created_at", { ascending: false });
    if (tData) setTransactions(tData);
    await loadImportBatches();
    setRevertingBatchId(null);
  }

  useEffect(() => {
    const session = sessionStorage.getItem("adminSession");
    if (!session) { router.push("/admin/login"); return; }

    async function fetchData() {
      const [{ data: dData }, { data: pData }, { data: cData }, { data: stockData }] = await Promise.all([
        supabase.from("designers").select("*").order("id"),
        supabase.from("product_usage").select("*").order("used_at", { ascending: false }),
        supabase.from("customers").select("id, phone, customer_no").eq("is_active", true),
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

  useEffect(() => {
    if (importOnly) queueMicrotask(() => loadImportBatches());
  }, [importOnly]);

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
    const serviceRevenue = dTransactions.reduce((sum, t) => sum + getServiceRevenue(t), 0);
    const baseDeduction = d.commission_base_deduction || 0;
    const commissionBase = Math.max(0, serviceRevenue - baseDeduction);
    const serviceCommission = Math.round(commissionBase * (d.commission_rate || 0));
    const brandFeeRate = (d as any).brand_fee_rate || 0;
    const brandFee = Math.round(serviceRevenue * brandFeeRate);
    const totalCommission = serviceCommission + brandFee;
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
  const serviceDetailRows: ReportDetailRow[] = monthlyTransactions.flatMap<ReportDetailRow>((transaction) => {
    const serviceItems = (transaction.service_items || []).map((item: any, sourceIndex) => ({ item, sourceIndex })).filter(({ item }) => !item.name?.startsWith("[商品]"));
    if (serviceItems.length === 0 && getServiceRevenue(transaction) > 0) {
      return [{
        id: `tx-${transaction.id}-service-total`,
        date: formatReportDate(transaction.created_at),
        designerName: getDesignerNameById(transaction.designer_id),
        kind: "服務明細",
        itemName: transaction.customer_name ? `${transaction.customer_name}｜服務收入` : "服務收入",
        quantity: "1",
        amount: formatMoney(getServiceRevenue(transaction)),
        sourceType: "legacy" as const,
        sourceId: transaction.id,
      }];
    }
    return serviceItems.map(({ item, sourceIndex }) => ({
      id: `tx-${transaction.id}-service-${sourceIndex}`,
      date: formatReportDate(transaction.created_at),
      designerName: getDesignerNameById(transaction.designer_id),
      kind: "服務明細",
      itemName: transaction.customer_name ? `${transaction.customer_name}｜${item.name}` : item.name,
      quantity: "1",
      amount: formatMoney(Number(item.amount || 0)),
      sourceType: "service" as const,
      sourceId: transaction.id,
      sourceIndex,
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
    sourceType: "selfUse",
    sourceId: usage.id,
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
      .map((item: any, sourceIndex) => ({ item, sourceIndex }))
      .filter(({ item }) => Number(item.discount || 0) > 0)
      .map(({ item, sourceIndex }) => ({
        id: `tx-${transaction.id}-service-discount-${sourceIndex}`,
        date: formatReportDate(transaction.created_at),
        designerName: getDesignerNameById(transaction.designer_id),
        kind: "服務折扣",
        itemName: transaction.customer_name ? `${transaction.customer_name}｜${item.name}` : item.name,
        quantity: "1",
        amount: formatMoney(Number(item.discount || 0), true),
        isNegative: true,
        sourceType: "discount" as const,
        sourceId: transaction.id,
        sourceIndex,
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
        sourceType: "legacy" as const,
        sourceId: transaction.id,
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
  const designerDetailSections: Array<{ key: DesignerDetailKey; title: string; rows: ReportDetailRow[] }> = [
    { key: "serviceRevenue", title: "服務業績明細", rows: designerDetailRowsByKey.serviceRevenue },
    { key: "productRevenue", title: "商品銷售明細", rows: designerDetailRowsByKey.productRevenue },
    { key: "selfUse", title: "自領商品明細", rows: designerDetailRowsByKey.selfUse },
    { key: "discount", title: "折扣明細", rows: designerDetailRowsByKey.discount },
  ];
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
      <div className="admin-topbar" style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => router.push("/admin/dashboard")} style={{ background: "#2C2C2A", color: "#fff", border: "1px solid #5F5E5A", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>← 返回</button>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{importOnly ? "帳務管理｜資料匯入與修正" : reportMode === "shop" ? "帳務管理｜店舖帳務報表" : "帳務管理｜設計師月結"}</div>
        </div>
        {!importOnly && <div style={{ fontSize: 12, color: "#888780" }}>{selectedMonth.replace("-", " 年 ")} 月</div>}
        <div />
      </div>

      <div style={{ padding: 16 }}>

        {/* 匯入歷史資料面板 */}
        {importOnly && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, border: "0.5px solid #BA7517" }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#2C2C2A", marginBottom: 6 }}>匯入歷史交易明細</div>
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
              {importing ? "處理中..." : "選擇 .xlsx 檔案預覽"}
              <input type="file" accept=".xlsx" onChange={handleImport} style={{ display: "none" }} disabled={importing} />
            </label>
            {importPreview && (() => {
              const validOrders = importPreview.orders.filter((order) => order.txData);
              const invalidOrders = importPreview.orders.filter((order) => !order.txData);
              const totalAmount = validOrders.reduce((sum, order) => sum + order.totalAmount, 0);
              return <div style={{ marginTop: 14, border: "1px solid #E8D8B9", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: 14, background: "#FFF8E8", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div><div style={{ fontSize: 14, fontWeight: 900, color: "#2C2C2A" }}>{importPreview.fileName}</div><div style={{ marginTop: 4, fontSize: 11, color: "#7A6A4A" }}>確認後才會寫入資料庫</div></div>
                  <button type="button" onClick={confirmImport} disabled={importing || validOrders.length === 0} style={{ border: "none", borderRadius: 9, padding: "9px 16px", background: validOrders.length ? "#BA7517" : "#D3D1C7", color: "#fff", fontSize: 12, fontWeight: 900, cursor: validOrders.length ? "pointer" : "default" }}>確認匯入 {validOrders.length} 筆</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(4,1fr)" : "1fr 1fr", gap: 1, background: "#EEE7D9" }}>
                  {[{ label: "檔案訂單", value: `${importPreview.orders.length} 筆` }, { label: "可匯入", value: `${validOrders.length} 筆` }, { label: "需處理", value: `${invalidOrders.length} 筆` }, { label: "可匯入金額", value: `NT$${totalAmount.toLocaleString()}` }].map((item) => <div key={item.label} style={{ padding: 12, background: "#fff" }}><div style={{ fontSize: 10, color: "#888780" }}>{item.label}</div><div style={{ marginTop: 4, fontSize: 16, fontWeight: 900, color: "#2C2C2A" }}>{item.value}</div></div>)}
                </div>
                {invalidOrders.length > 0 && <div style={{ padding: 12, background: "#FFF1F1" }}><div style={{ fontSize: 11, fontWeight: 900, color: "#A32D2D", marginBottom: 6 }}>以下資料不會匯入</div>{invalidOrders.slice(0, 12).map((order) => <div key={`${order.orderNo}-${order.orderTime}`} style={{ padding: "5px 0", borderTop: "1px solid #F4D6D6", fontSize: 11, color: "#7F1D1D" }}>{order.orderNo || "無訂單編號"}・{order.orderTime || "無日期"}・{order.error}</div>)}</div>}
              </div>;
            })()}
            {importResult && (
              <div style={{ marginTop: 10, padding: "10px 12px", background: importResult.includes("失敗") || importResult.includes("錯誤") ? "#FCEBEB" : "#E1F5EE", borderRadius: 8, fontSize: 12, color: importResult.includes("失敗") || importResult.includes("錯誤") ? "#A32D2D" : "#085041", whiteSpace: "pre-wrap" }}>
                {importResult}
              </div>
            )}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #EEEAE2" }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#2C2C2A" }}>最近匯入批次</div>
              <div style={{ marginTop: 4, fontSize: 11, color: "#888780" }}>未鎖帳批次可整批撤銷；已鎖帳資料請至月結明細新增更正。</div>
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {importBatches.length === 0 ? <div style={{ padding: 16, borderRadius: 10, background: "#F7F6F2", color: "#888780", fontSize: 12, textAlign: "center" }}>尚無匯入批次</div> : importBatches.map((batch) => <div key={batch.id} style={{ display: "grid", gridTemplateColumns: isDesktop ? "minmax(220px,1.5fr) 1fr 1fr auto" : "1fr", gap: 10, alignItems: "center", padding: 12, border: "1px solid #E5E1D8", borderRadius: 11, background: batch.status === "reverted" ? "#F7F6F2" : "#fff" }}>
                  <div><div style={{ fontSize: 12, fontWeight: 900, color: "#2C2C2A" }}>{batch.file_name}</div><div style={{ marginTop: 3, fontSize: 10, color: "#888780" }}>{new Date(batch.created_at).toLocaleString("zh-TW")}・{batch.admin_username}</div></div>
                  <div style={{ fontSize: 11, color: "#5F5E5A" }}>{batch.months.join("、") || "未辨識月份"}</div>
                  <div style={{ fontSize: 11, color: "#5F5E5A" }}>成功 {batch.success_count}・未匯入 {batch.error_count}</div>
                  {batch.status === "reverted" ? <span style={{ padding: "6px 10px", borderRadius: 999, background: "#EEECE6", color: "#77736A", fontSize: 10, fontWeight: 900 }}>已撤銷</span> : <button type="button" disabled={revertingBatchId === batch.id} onClick={() => revertImportBatch(batch)} style={{ border: "1px solid #E7B6B6", borderRadius: 8, background: "#FFF5F5", color: "#A32D2D", padding: "7px 10px", fontSize: 10, fontWeight: 900, cursor: "pointer" }}>{revertingBatchId === batch.id ? "撤銷中" : "整批撤銷"}</button>}
                </div>)}
              </div>
            </div>
          </div>
        )}

        {!importOnly && <>
        <div style={{ background: "#fff", borderRadius: 18, border: "0.5px solid #D3D1C7", padding: 16, marginBottom: 12, boxShadow: "0 10px 26px rgba(44,44,42,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#2C2C2A" }}>📅 結算區間</div>
              <div style={{ padding: "8px 13px", borderRadius: 12, background: reportMode === "shop" ? "#F7F5FF" : "#F1EFE8", color: reportMode === "shop" ? "#534AB7" : "#5F5E5A", fontSize: 13, fontWeight: 800 }}>{reportMode === "shop" ? "店舖報表" : "設計師月結"}</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => shiftReportPeriod(-1)} style={{ border: "none", padding: "9px 14px", borderRadius: 12, background: "#F1EFE8", color: "#5F5E5A", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>上一期</button>
              <button onClick={setCurrentReportPeriod} style={{ border: "none", padding: "9px 14px", borderRadius: 12, background: "#E2F2FF", color: "#0877B5", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>本期</button>
              <button onClick={() => shiftReportPeriod(1)} style={{ border: "none", padding: "9px 14px", borderRadius: 12, background: "#D7F8E6", color: "#047857", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>下一期</button>
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
            <button onClick={exportExcel} style={{ background: "#1D9E75", color: "#fff", border: "none", borderRadius: 12, padding: "9px 14px", fontSize: 13, cursor: "pointer", fontWeight: 800 }}>Excel</button>
            {reportMode === "designer" && (
              <button onClick={exportPdf} style={{ background: "#0877B5", color: "#fff", border: "none", borderRadius: 12, padding: "9px 14px", fontSize: 13, cursor: "pointer", fontWeight: 800 }}>PDF（每位設計師）</button>
            )}
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
                      {["設計師", "筆數", "服務業績", "商品銷售", "服務抽成", "品牌共享費", "應付 BC", "設計師實收"].map((head, index) => (
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
                          <td style={{ padding: "12px 14px", fontSize: 15, color: "#0877B5", fontWeight: 900, textAlign: "right" }}>NT${settlement.totals.serviceRevenue.toLocaleString()}</td>
                          <td style={{ padding: "12px 14px", fontSize: 15, color: "#6D28D9", fontWeight: 900, textAlign: "right" }}>NT${settlement.totals.productRevenue.toLocaleString()}</td>
                          <td style={{ padding: "12px 14px", fontSize: 15, color: "#087F5B", fontWeight: 900, textAlign: "right" }}>NT${settlement.serviceCommission.toLocaleString()}</td>
                          <td style={{ padding: "12px 14px", fontSize: 15, color: "#A55124", fontWeight: 900, textAlign: "right" }}>NT${settlement.brandFee.toLocaleString()}</td>
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
            <SettlementPreviewPage
              key={`${reportStartDate.slice(0, 7)}-${activeReportDesigner.id}`}
              embedded
              initialMonth={reportStartDate.slice(0, 7)}
              designerId={activeReportDesigner.id}
              reportSummary={{
                actualIncome: activeDesignerSettlement?.designerIncome || 0,
                serviceRevenue: designerTotals.serviceRevenue,
                productRevenue: designerTotals.productRevenue,
                selfUse: designerTotals.selfUse,
                discount: designerTotals.discount,
                customerCount: designerTotals.customerCount,
              }}
              activeMetric={activeDesignerDetail}
              onMetricChange={(key) => {
                if (["serviceRevenue", "productRevenue", "selfUse", "discount"].includes(key)) setActiveDesignerDetail(key as DesignerDetailKey);
              }}
              onConfirmed={() => { setSettlementLocked(true); setAuditRefresh((value) => value + 1); }}
              onUnlocked={() => { setSettlementLocked(false); setAuditRefresh((value) => value + 1); }}
            />
            <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #D3D1C7", overflow: "hidden", marginBottom: 12 }}>
              <div style={{ padding: "14px 16px 0" }}>
                <div style={{ fontSize: 17, color: "#2C2C2A", fontWeight: 900 }}>交易明細</div>
                <div style={{ display: "flex", overflowX: "auto", borderBottom: "1px solid #E8E5DE", marginTop: 8 }}>
                  {designerDetailSections.map((section) => {
                    const selected = activeDesignerDetail === section.key;
                    return <button key={section.key} type="button" onClick={() => setActiveDesignerDetail(section.key)} style={{ minWidth: isDesktop ? 170 : 132, border: "none", borderBottom: selected ? "3px solid #1976C9" : "3px solid transparent", background: selected ? "#F1F8FF" : "transparent", color: selected ? "#1269B0" : "#4F4E49", padding: "11px 16px 10px", fontSize: 13, fontWeight: selected ? 900 : 700, cursor: "pointer", whiteSpace: "nowrap" }}>{section.title.replace("明細", "")} <span style={{ color: selected ? "#1976C9" : "#888780", marginLeft: 5 }}>{section.rows.length}</span></button>;
                  })}
                </div>
              </div>
              <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, color: "#2C2C2A", fontWeight: 800 }}>{activeDesignerDetailTitle[activeDesignerDetail]}</div>
                  <div style={{ fontSize: 11, color: "#888780", marginTop: 3 }}>共 {activeDesignerDetailRows.length} 筆・點選上方分類切換明細</div>
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 860, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#F1EFE8" }}>
                      {["日期", "明細", "數量", "金額", "狀態", "操作"].map((head) => (
                        <th key={head} style={{ padding: "10px 14px", fontSize: 12, color: "#888780", fontWeight: 700, textAlign: "left" }}>{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeDesignerDetailRows.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: "24px 14px", color: "#888780", fontSize: 13, textAlign: "center" }}>目前沒有明細</td></tr>
                    ) : activeDesignerDetailRows.map((row, index) => {
                      const showDate = index === 0 || activeDesignerDetailRows[index - 1].date !== row.date;
                      const editable = isDetailEditable(row);
                      return <tr key={row.id} style={{ borderTop: "0.5px solid #F1EFE8" }}>
                        <td style={{ padding: "11px 14px", fontSize: 13, color: showDate ? "#2C2C2A" : "#B4AEA4", fontWeight: showDate ? 700 : 500 }}>{showDate ? row.date : ""}</td>
                        <td style={{ padding: "11px 14px", fontSize: 13, color: "#2C2C2A", fontWeight: 600 }}><span style={{ color: "#888780", marginRight: 8 }}>{row.kind}</span>{row.itemName}</td>
                        <td style={{ padding: "11px 14px", fontSize: 13, color: "#2C2C2A" }}>{row.quantity}</td>
                        <td style={{ padding: "11px 14px", fontSize: 13, color: row.isNegative ? "#A32D2D" : "#1976C9", fontWeight: 800 }}>{row.amount}</td>
                        <td style={{ padding: "8px 14px" }}><span style={{ display: "inline-block", borderRadius: 999, background: editable ? "#E6F3FF" : "#E4F8EA", color: editable ? "#1976C9" : "#1A7F45", padding: "5px 10px", fontSize: 10, fontWeight: 800 }}>{editable ? "可修改" : "已鎖定"}</span></td>
                        <td style={{ padding: "8px 14px" }}>{editable ? <button type="button" onClick={() => openDetailEditor(row)} style={{ border: "1px solid #CFC8F5", borderRadius: 8, background: "#fff", color: "#534AB7", padding: "6px 12px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>修改</button> : row.sourceType && row.sourceType !== "legacy" ? <div style={{ display: "grid", gap: 4, justifyItems: "start" }}><button type="button" onClick={() => openDetailEditor(row, true)} style={{ border: "1px solid #D6A54A", borderRadius: 8, background: "#FFF8E8", color: "#8A5A10", padding: "6px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>新增更正</button><span style={{ color: "#AAA49B", fontSize: 9 }}>{detailLockLabel(row)}</span></div> : <span style={{ color: "#AAA49B", fontSize: 10 }}>{detailLockLabel(row)}</span>}</td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <details style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #D3D1C7", overflow: "hidden", marginBottom: 12 }}>
              <summary style={{ padding: "13px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", listStyle: "none" }}>
                <div><div style={{ fontSize: 14, color: "#2C2C2A", fontWeight: 800 }}>修改紀錄</div><div style={{ marginTop: 3, color: "#888780", fontSize: 11 }}>查看哪個後台帳號在何時修改了什麼資料</div></div>
                <div style={{ color: "#888780", fontSize: 12, fontWeight: 700 }}>共 {adjustmentAuditLogs.length} 筆　▼</div>
              </summary>
              <div style={{ borderTop: "1px solid #EEEAE2" }}>
                {adjustmentAuditLogs.length === 0 ? <div style={{ padding: 18, color: "#888780", fontSize: 12, textAlign: "center" }}>本月尚無修改紀錄</div> : adjustmentAuditLogs.map((log) => <div key={log.id} style={{ padding: "12px 14px", borderBottom: "1px solid #F1EFE8", display: "grid", gridTemplateColumns: isDesktop ? "170px 160px minmax(0,1fr) 170px" : "1fr", gap: 8, alignItems: "center" }}>
                  <div style={{ color: "#5F5E5A", fontSize: 11 }}>{new Date(log.changedAt).toLocaleString("zh-TW")}</div>
                  <div><div style={{ color: "#2C2C2A", fontSize: 12, fontWeight: 800 }}>{log.username}</div><div style={{ color: "#888780", fontSize: 10 }}>{log.roleName}</div></div>
                  <div><div style={{ color: "#2C2C2A", fontSize: 12, fontWeight: 700 }}>{log.designerName ? `${log.designerName}・` : ""}{log.category}</div>{log.beforeName && log.afterName && log.beforeName !== log.afterName && <div style={{ color: "#534AB7", fontSize: 10, marginTop: 3 }}>{log.beforeName} → {log.afterName}</div>}<div style={{ color: "#888780", fontSize: 10, marginTop: 3 }}>原因：{log.reason}</div></div>
                  <div style={{ color: "#534AB7", fontSize: 12, fontWeight: 900, textAlign: isDesktop ? "right" : "left" }}>NT${Math.abs(log.beforeAmount).toLocaleString()} → NT${Math.abs(log.afterAmount).toLocaleString()}</div>
                </div>)}
              </div>
            </details>
          </>
        )}

        </>}

      </div>

      {!importOnly && editingDetail && <div onClick={() => !savingDetail && setEditingDetail(null)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(24,24,22,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
        <div onClick={(event) => event.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: "#fff", borderRadius: 18, padding: 18, boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
          <div style={{ fontSize: 18, color: "#2C2C2A", fontWeight: 900 }}>{isHistoricalCorrection ? "新增歷史更正" : "修改明細"}</div>
          <div style={{ marginTop: 5, color: "#888780", fontSize: 12 }}>{editingDetail.date}・{editingDetail.itemName}</div>
          {isHistoricalCorrection && <div style={{ marginTop: 10, padding: "9px 10px", borderRadius: 9, background: "#FFF5D9", color: "#765817", fontSize: 11, lineHeight: 1.5 }}>原始匯入紀錄會保留在修改紀錄中；報表與統計將使用更正後的品項與金額。</div>}
          <label style={{ display: "grid", gap: 6, marginTop: 16, color: "#5F5E5A", fontSize: 12, fontWeight: 700 }}>品項名稱／分類文字
            <input value={editItemName} onChange={(event) => setEditItemName(event.target.value)} placeholder="輸入正確的服務或商品名稱" style={{ padding: "11px 12px", border: "1px solid #D3D1C7", borderRadius: 10, fontSize: 14 }} />
          </label>
          <label style={{ display: "grid", gap: 6, marginTop: 12, color: "#5F5E5A", fontSize: 12, fontWeight: 700 }}>金額
            <input type="number" min="0" value={editAmount} onChange={(event) => setEditAmount(Number(event.target.value || 0))} style={{ padding: "11px 12px", border: "1px solid #D3D1C7", borderRadius: 10, fontSize: 15 }} />
          </label>
          <label style={{ display: "grid", gap: 6, marginTop: 12, color: "#5F5E5A", fontSize: 12, fontWeight: 700 }}>修改原因（必填）
            <textarea value={editReason} onChange={(event) => setEditReason(event.target.value)} placeholder="例如：原結帳金額輸入錯誤" rows={3} style={{ padding: "11px 12px", border: "1px solid #D3D1C7", borderRadius: 10, fontSize: 13, resize: "vertical" }} />
          </label>
          <div style={{ marginTop: 8, color: "#888780", fontSize: 10, lineHeight: 1.5 }}>儲存後會更新原始交易資料，並在交易備註留下後台更正原因。</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 16 }}>
            <button type="button" disabled={savingDetail} onClick={() => setEditingDetail(null)} style={{ border: "1px solid #D3D1C7", borderRadius: 10, background: "#fff", color: "#5F5E5A", padding: 10, fontWeight: 800 }}>取消</button>
            <button type="button" disabled={savingDetail} onClick={saveDetailCorrection} style={{ border: "none", borderRadius: 10, background: isHistoricalCorrection ? "#BA7517" : "#534AB7", color: "#fff", padding: 10, fontWeight: 800 }}>{savingDetail ? "儲存中" : isHistoricalCorrection ? "確認新增更正" : "確認修改"}</button>
          </div>
        </div>
      </div>}

      <AdminBottomNav current={importOnly ? "report-import" : reportMode === "designer" ? "report-designer" : "report-shop"} />
    </div>
  );
}
