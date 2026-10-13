"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import AdminBottomNav from "../../components/BottomNav";

type Designer = {
  id: number;
  name: string;
  display_name: string;
  is_active: boolean;
  commission_base_deduction: number;
  commission_rate: number;
  brand_fee_rate: number;
};

type Transaction = {
  designer_id: number;
  total_amount: number;
  service_items: Array<{ name: string; amount: number; discount?: number }> | null;
  product_items: Array<{ amount: number; quantity: number }> | null;
  note?: string | null;
  created_at: string;
};

type ProductUsage = { designer_id: number; total_cost: number; used_at: string };
type ContractSettings = { effective_date: string; monthly_rent: number };
type SettlementItem = {
  designer_id: number;
  name: string;
  item_type: "addition" | "deduction";
  calculation_type: "fixed" | "percent";
  amount: number;
  rate: number;
  calculation_base: "service_revenue" | "product_revenue" | "total_revenue" | "net_income";
  include_in_bc_receivable: boolean;
  is_active: boolean;
};
type PaymentRecord = {
  status: "unpaid" | "partial" | "paid";
  paid_amount: number;
  paid_date: string;
  payment_method: string;
  note: string;
};
type SettlementRow = {
  designer: Designer;
  serviceRevenue: number;
  productRevenue?: number;
  selfUse: number;
  rent: number;
  threshold: number;
  businessCommission: number;
  marketingCommission: number;
  otherItems: Array<{ name: string; amount: number }>;
  receivable: number;
  contractMissing: boolean;
  payment?: PaymentRecord;
};
type SettlementSnapshot = {
  month: string;
  confirmed_at: string;
  confirmed_by: string;
  rows: SettlementRow[];
};

type EmbeddedReportSummary = {
  actualIncome: number;
  serviceRevenue: number;
  productRevenue: number;
  selfUse: number;
  discount: number;
  customerCount: number;
};

const money = (value: number) => `NT$${Math.round(value).toLocaleString()}`;

function productTotal(transaction: Transaction) {
  const productItemsTotal = (transaction.product_items || []).reduce((sum, item) => sum + Number(item.amount || 0) * Number(item.quantity || 1), 0);
  const importedProductTotal = (transaction.service_items || []).reduce((sum, item) => item.name?.startsWith("[商品]") ? sum + Number(item.amount || 0) : sum, 0);
  const productSection = (transaction.note || "").split("客人購買商品：")[1];
  const noteTotal = productSection
    ? productSection.split("、").reduce((sum, item) => {
      const amountMatch = item.match(/小計NT\$?([\d,]+)/);
      return sum + (amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : 0);
    }, 0)
    : 0;
  return productItemsTotal + importedProductTotal + noteTotal;
}

function serviceTotal(transaction: Transaction) {
  const explicit = (transaction.service_items || []).reduce((sum, item) => item.name?.startsWith("[商品]") ? sum : sum + Number(item.amount || 0), 0);
  return explicit > 0 ? explicit : Math.max(0, Number(transaction.total_amount || 0) - productTotal(transaction));
}

export default function SettlementPreviewPage({ embedded = false, initialMonth, designerId, reportSummary, activeMetric, onMetricChange, onConfirmed, onUnlocked }: {
  embedded?: boolean;
  initialMonth?: string;
  designerId?: number | null;
  reportSummary?: EmbeddedReportSummary;
  activeMetric?: string;
  onMetricChange?: (key: string) => void;
  onConfirmed?: () => void;
  onUnlocked?: () => void;
} = {}) {
  const router = useRouter();
  const now = new Date();
  const [month, setMonth] = useState(initialMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [productUsages, setProductUsages] = useState<ProductUsage[]>([]);
  const [contracts, setContracts] = useState<Record<number, ContractSettings>>({});
  const [items, setItems] = useState<SettlementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [snapshot, setSnapshot] = useState<SettlementSnapshot | null>(null);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");

  useEffect(() => {
    if (!sessionStorage.getItem("adminSession")) {
      router.push("/admin/login");
      return;
    }
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    async function load() {
      const [{ data: designerData }, { data: transactionData }, { data: usageData }, { data: contractData }, { data: itemData }, { data: snapshotData }] = await Promise.all([
        supabase.from("designers").select("id,name,display_name,is_active,commission_base_deduction,commission_rate,brand_fee_rate").order("sort_order", { nullsFirst: false }).order("id"),
        supabase.from("transactions").select("designer_id,total_amount,service_items,product_items,note,created_at").gte("created_at", `${month}-01`).lt("created_at", nextMonth(month)),
        supabase.from("product_usage").select("designer_id,total_cost,used_at").gte("used_at", `${month}-01`).lt("used_at", nextMonth(month)),
        supabase.from("shop_info").select("key,value").like("key", "designer_contract_%"),
        supabase.from("designer_settlement_items").select("designer_id,name,item_type,calculation_type,amount,rate,calculation_base,include_in_bc_receivable,is_active").eq("is_active", true),
        supabase.from("shop_info").select("value").eq("key", snapshotKey(month)).maybeSingle(),
      ]);
      setDesigners((designerData || []) as Designer[]);
      setTransactions((transactionData || []) as Transaction[]);
      setProductUsages((usageData || []) as ProductUsage[]);
      setItems((itemData || []) as SettlementItem[]);
      setContracts(Object.fromEntries((contractData || []).flatMap((entry) => {
        try {
          return [[Number(entry.key.replace("designer_contract_", "")), JSON.parse(entry.value || "{}")]];
        } catch {
          return [];
        }
      })));
      try {
        setSnapshot(snapshotData?.value ? JSON.parse(snapshotData.value) : null);
      } catch {
        setSnapshot(null);
      }
      setLoading(false);
    }
    void load();
    return () => window.removeEventListener("resize", check);
  }, [month, router]);

  const rows: SettlementRow[] = designers.filter((designer) => designer.is_active !== false).map((designer) => {
    const designerTransactions = transactions.filter((item) => item.designer_id === designer.id);
    const serviceRevenue = designerTransactions.reduce((sum, item) => sum + serviceTotal(item), 0);
    const productRevenue = designerTransactions.reduce((sum, item) => sum + productTotal(item), 0);
    const selfUse = productUsages.filter((item) => item.designer_id === designer.id).reduce((sum, item) => sum + Number(item.total_cost || 0), 0);
    const rent = Number(contracts[designer.id]?.monthly_rent || 0);
    const threshold = Number(designer.commission_base_deduction || 0);
    const businessCommission = Math.round(Math.max(0, serviceRevenue - threshold) * Number(designer.commission_rate || 0));
    const marketingCommission = Math.round(serviceRevenue * Number(designer.brand_fee_rate || 0));
    const otherItems = items.filter((item) => {
      const normalizedName = item.name.replace(/\s/g, "");
      const isDuplicateRent = ["租金", "月租", "月租金", "每月租金", "固定月租", "固定租金"].includes(normalizedName);
      return item.designer_id === designer.id && item.include_in_bc_receivable && !isDuplicateRent;
    }).map((item) => {
      // 商品銷售僅供查看，不作為任何月結項目的計算基準。
      const bases = { service_revenue: serviceRevenue, product_revenue: 0, total_revenue: serviceRevenue, net_income: serviceRevenue };
      const amount = item.calculation_type === "fixed" ? Number(item.amount || 0) : Math.round(bases[item.calculation_base] * Number(item.rate || 0));
      return { name: item.name, amount: item.item_type === "deduction" ? amount : -amount };
    });
    const otherTotal = otherItems.reduce((sum, item) => sum + item.amount, 0);
    return {
      designer,
      serviceRevenue,
      productRevenue,
      selfUse,
      rent,
      threshold,
      businessCommission,
      marketingCommission,
      otherItems,
      receivable: rent + businessCommission + marketingCommission + selfUse + otherTotal,
      contractMissing: !contracts[designer.id],
    };
  });
  const displayRows = (snapshot?.rows || rows).filter((row) => !designerId || row.designer.id === designerId);
  const totalReceivable = displayRows.reduce((sum, row) => sum + row.receivable, 0);
  const totalPaid = displayRows.reduce((sum, row) => sum + Number(row.payment?.paid_amount || 0), 0);

  async function saveSnapshot(nextSnapshot: SettlementSnapshot) {
    const key = snapshotKey(month);
    const value = JSON.stringify(nextSnapshot);
    const { data: existing, error: lookupError } = await supabase.from("shop_info").select("id").eq("key", key).maybeSingle();
    if (lookupError) throw lookupError;
    const result = existing
      ? await supabase.from("shop_info").update({ value, is_active: true }).eq("id", existing.id)
      : await supabase.from("shop_info").insert({ key, label: `${month} 設計師月結帳單`, value, is_active: true, sort_order: 110 });
    if (result.error) throw result.error;
  }

  async function confirmMonth() {
    if (rows.some((row) => row.contractMissing || row.rent <= 0) && !window.confirm("部分設計師尚未設定月租，會以 0 元建立帳單。仍要繼續嗎？")) return;
    if (!window.confirm(`確認建立 ${month.replace("-", " 年 ")} 月帳單？確認後計算金額將固定。`)) return;
    setSaving(true);
    setNotice("");
    const session = JSON.parse(sessionStorage.getItem("adminSession") || "{}");
    const nextSnapshot: SettlementSnapshot = {
      month,
      confirmed_at: new Date().toISOString(),
      confirmed_by: session.username || "admin",
      rows: rows.map((row) => ({ ...row, payment: { status: "unpaid", paid_amount: 0, paid_date: "", payment_method: "現金", note: "" } })),
    };
    try {
      const { error } = await supabase.rpc("confirm_settlement_secure", {
        p_month: month, p_value: JSON.stringify(nextSnapshot), p_total: totalReceivable, p_designer_id: designerId || null,
      });
      if (error) throw error;
      setSnapshot(nextSnapshot);
      onConfirmed?.();
      setNotice("本月帳單已確認，計算金額已保存");
    } catch {
      setNotice("帳單確認失敗，請再試一次");
    } finally {
      setSaving(false);
    }
  }

  async function writeSettlementAudit(eventType: "settlement_confirmed" | "settlement_unlocked", reason: string) {
    const session = JSON.parse(sessionStorage.getItem("adminSession") || "{}");
    const { error } = await supabase.from("settlement_audit_logs").insert({
      settlement_month: month,
      designer_id: designerId || null,
      designer_name: displayRows[0]?.designer.display_name || displayRows[0]?.designer.name || "全體設計師",
      event_type: eventType,
      category: eventType === "settlement_unlocked" ? "解除鎖帳" : "確認鎖帳",
      item_name: `${month} 月結帳單`,
      before_amount: totalReceivable,
      after_amount: totalReceivable,
      reason,
      admin_username: session.username || "admin",
      admin_role_name: session.role_name || (session.role === "manager" ? "店長管理員" : "最高管理員"),
    });
    if (error) throw error;
  }

  async function unlockMonth() {
    const session = JSON.parse(sessionStorage.getItem("adminSession") || "{}");
    if (session.role === "manager") {
      setNotice("只有最高管理員可以解除鎖帳");
      return;
    }
    if (!unlockReason.trim()) {
      setNotice("請填寫解除鎖帳原因");
      return;
    }
    setSaving(true);
    setNotice("");
    try {
      const { error } = await supabase.rpc("unlock_settlement_secure", {
        p_month: month, p_reason: unlockReason.trim(), p_total: totalReceivable, p_designer_id: designerId || null,
      });
      if (error) throw error;
      setSnapshot(null);
      setShowUnlock(false);
      setUnlockReason("");
      setNotice("帳單已解除鎖定，可重新核對與更正");
      onUnlocked?.();
    } catch {
      setNotice("解除鎖帳失敗，請再試一次");
    } finally {
      setSaving(false);
    }
  }

  async function updatePayment(designerId: number, payment: PaymentRecord) {
    if (!snapshot) return;
    setSaving(true);
    const normalizedPayment = {
      ...payment,
      status: payment.paid_amount <= 0 ? "unpaid" as const : payment.paid_amount >= (snapshot.rows.find((row) => row.designer.id === designerId)?.receivable || 0) ? "paid" as const : "partial" as const,
    };
    const nextSnapshot = { ...snapshot, rows: snapshot.rows.map((row) => row.designer.id === designerId ? { ...row, payment: normalizedPayment } : row) };
    try {
      await saveSnapshot(nextSnapshot);
      setSnapshot(nextSnapshot);
      setNotice("收款紀錄已儲存");
    } catch {
      setNotice("收款紀錄儲存失敗，請再試一次");
    } finally {
      setSaving(false);
    }
  }

  if (embedded) {
    const sourceRow = displayRows[0];
    if (loading || !sourceRow) return <div style={{ color: "#888780", padding: 20 }}>載入月結資料...</div>;
    const serviceRevenue = reportSummary?.serviceRevenue ?? sourceRow.serviceRevenue;
    const selfUse = reportSummary?.selfUse ?? sourceRow.selfUse;
    const businessCommission = Math.round(Math.max(0, serviceRevenue - sourceRow.threshold) * Number(sourceRow.designer.commission_rate || 0));
    const marketingCommission = Math.round(serviceRevenue * Number(sourceRow.designer.brand_fee_rate || 0));
    const otherTotal = sourceRow.otherItems.reduce((sum, item) => sum + item.amount, 0);
    const row: SettlementRow = {
      ...sourceRow,
      serviceRevenue,
      productRevenue: reportSummary?.productRevenue ?? sourceRow.productRevenue,
      selfUse,
      businessCommission,
      marketingCommission,
      receivable: sourceRow.rent + businessCommission + marketingCommission + selfUse + otherTotal,
    };
    const paidAmount = Number(row.payment?.paid_amount || 0);
    const isPaid = row.payment?.status === "paid";
    const metricCards = [
      { key: "serviceRevenue", label: "服務業績", value: money(reportSummary?.serviceRevenue ?? row.serviceRevenue), color: "#534AB7" },
      { key: "productRevenue", label: "商品銷售・查看", value: money(reportSummary?.productRevenue ?? row.productRevenue ?? 0), color: "#BA7517" },
      { key: "actualIncome", label: "總客數", value: String(reportSummary?.customerCount ?? 0), color: "#0B66C3" },
      { key: "selfUse", label: "自領商品", value: money(reportSummary?.selfUse ?? row.selfUse), color: "#A32D2D" },
      { key: "discount", label: "折扣", value: `-${money(reportSummary?.discount ?? 0)}`, color: "#E24B4A" },
      { key: "due", label: "本月應繳公司", value: money(row.receivable), color: "#534AB7" },
    ];
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", margin: "2px 4px 12px" }}>
          {[
            ["1 業績已整理", true],
            ["2 後台核對中", !snapshot],
            ["3 帳單已確認", Boolean(snapshot)],
            ["4 待收款", Boolean(snapshot && !isPaid)],
            ["5 已結清", isPaid],
          ].map(([label, active], index) => (
            <div key={String(label)} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              {index > 0 && <span style={{ color: "#AAA49B", fontSize: 11 }}>→</span>}
              <span style={{ padding: "7px 11px", borderRadius: 999, background: active ? "#534AB7" : index === 0 ? "#DFF4E9" : "#E9E5DC", color: active ? "#fff" : index === 0 ? "#176447" : "#6E685E", fontSize: 11, fontWeight: 800 }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(6, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))", gap: 8, marginBottom: 12 }}>
          {metricCards.map((card) => (
            <button key={card.label} type="button" onClick={() => card.key !== "due" && onMetricChange?.(card.key)} style={{ minHeight: 92, padding: 13, textAlign: "left", borderRadius: 14, border: card.key === "due" || activeMetric === card.key ? "1.5px solid #534AB7" : "1px solid #DDD8CE", background: card.key === "due" || activeMetric === card.key ? "#F4F1FF" : "#fff", cursor: card.key === "due" ? "default" : "pointer" }}>
              <div style={{ color: "#888780", fontSize: 11, fontWeight: 700, marginBottom: 9 }}>{card.label}</div>
              <div style={{ color: card.color, fontSize: 18, fontWeight: 900, whiteSpace: "nowrap" }}>{card.value}</div>
            </button>
          ))}
        </div>

        {notice && <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 10, background: notice.includes("失敗") ? "#FCEBEB" : "#E1F5EE", color: notice.includes("失敗") ? "#A32D2D" : "#085041", fontSize: 12, fontWeight: 800 }}>{notice}</div>}

        <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "minmax(0, 1fr) 360px" : "1fr", gap: 12 }}>
          <section style={{ background: "#fff", border: "1px solid #DDD8CE", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #EEEAE2" }}>
              <div style={{ fontSize: 16, color: "#2C2C2A", fontWeight: 900 }}>月結計算</div>
              <div style={{ fontSize: 11, color: "#888780", marginTop: 3 }}>由業績與個人合約設定自動計算</div>
            </div>
            <div style={{ padding: "2px 16px" }}>
              <CalculationLine label="每月租金" note={row.rent > 0 ? "合約固定金額" : "尚未在合約設定月租"} value={row.rent} warning={row.rent <= 0} />
              <CalculationLine label="服務抽成" note={`(${money(row.serviceRevenue)}－${money(row.threshold)}) × ${Math.round(Number(row.designer.commission_rate || 0) * 100)}%`} value={row.businessCommission} />
              <CalculationLine label="品牌共享費" note={`服務業績 ${money(row.serviceRevenue)} × ${Math.round(Number(row.designer.brand_fee_rate || 0) * 100)}%`} value={row.marketingCommission} />
              <CalculationLine label="自領商品" note="依商品定價計算" value={row.selfUse} />
              {row.otherItems.map((item, index) => <CalculationLine key={`${item.name}-${index}`} label={item.name} note="其他月結調整" value={item.amount} />)}
            </div>
          </section>

          <aside style={{ background: "#fff", border: "1px solid #DDD8CE", borderRadius: 16, padding: 16, alignSelf: "start" }}>
            <div style={{ fontSize: 16, color: "#2C2C2A", fontWeight: 900 }}>本月帳單</div>
            <div style={{ fontSize: 11, color: "#888780", marginTop: 4 }}>核對完成後建立帳單，再登記收款。</div>
            <div style={{ margin: "14px 0", padding: 16, borderRadius: 13, background: "#F1EFFF" }}>
              <div style={{ fontSize: 11, color: "#6F66B4" }}>設計師應繳公司</div>
              <div style={{ marginTop: 5, color: "#4D41AD", fontSize: 28, fontWeight: 900 }}>{money(row.receivable)}</div>
              {snapshot && <div style={{ marginTop: 6, color: "#7772B8", fontSize: 10 }}>已收 {money(paidAmount)}・未收 {money(Math.max(0, row.receivable - paidAmount))}</div>}
            </div>
            {row.rent <= 0 && <div style={{ padding: "10px 11px", borderRadius: 10, background: "#FFF5D9", color: "#765817", fontSize: 11, lineHeight: 1.5, marginBottom: 12 }}>月租尚未設定，目前以 NT$0 試算。請先至設計師合約設定補齊。</div>}
            {!snapshot ? (
              <button type="button" onClick={confirmMonth} disabled={saving} style={{ width: "100%", border: "none", borderRadius: 11, background: "#534AB7", color: "#fff", padding: 12, fontSize: 12, fontWeight: 900, cursor: "pointer" }}>{saving ? "確認中" : "確認本月帳單"}</button>
            ) : (
              <PaymentEditor row={row} saving={saving} onSave={(payment) => updatePayment(row.designer.id, payment)} />
            )}
            {snapshot && <div style={{ marginTop: 12, paddingTop: 11, borderTop: "1px solid #EEEAE2", color: "#888780", fontSize: 10, lineHeight: 1.6 }}>確認時間：{new Date(snapshot.confirmed_at).toLocaleString("zh-TW")}<br />確認人：{snapshot.confirmed_by}</div>}
            {snapshot && JSON.parse(sessionStorage.getItem("adminSession") || "{}").role !== "manager" && <div style={{ marginTop: 10 }}>
              {!showUnlock ? <button type="button" onClick={() => setShowUnlock(true)} style={{ width: "100%", border: "1px solid #E8B4B4", borderRadius: 9, background: "#FFF5F5", color: "#A32D2D", padding: 9, fontSize: 11, fontWeight: 800 }}>最高管理員解除鎖帳</button> : <div style={{ padding: 10, borderRadius: 10, background: "#FFF5F5", border: "1px solid #E8B4B4" }}><textarea value={unlockReason} onChange={(event) => setUnlockReason(event.target.value)} placeholder="請填寫解除鎖帳原因" rows={3} style={{ width: "100%", boxSizing: "border-box", padding: 9, border: "1px solid #D3D1C7", borderRadius: 8, resize: "vertical", fontSize: 11 }} /><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginTop: 7 }}><button type="button" onClick={() => { setShowUnlock(false); setUnlockReason(""); }} style={{ border: "1px solid #D3D1C7", borderRadius: 8, background: "#fff", padding: 8 }}>取消</button><button type="button" disabled={saving} onClick={unlockMonth} style={{ border: "none", borderRadius: 8, background: "#A32D2D", color: "#fff", padding: 8, fontWeight: 800 }}>{saving ? "處理中" : "確認解除"}</button></div></div>}
            </div>}
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: embedded ? undefined : "100vh", background: embedded ? "transparent" : "#F1EFE8", paddingLeft: embedded ? 0 : isDesktop ? 220 : 0, paddingBottom: embedded ? 0 : 80 }}>
      {!embedded && <div className="admin-topbar" style={{ background: "#1A1A1A", color: "#fff", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>帳務管理｜設計師月結</div>
        <div style={{ fontSize: 11, color: snapshot ? "#8FE3BD" : "#B7B4AC" }}>{snapshot ? "本月帳單已確認" : "僅供核對，尚未鎖定帳款"}</div>
      </div>}
      <main style={{ maxWidth: embedded ? undefined : 1200, margin: "0 auto", padding: embedded ? 0 : 18 }}>
        <section style={{ background: "#fff", borderRadius: 18, border: "1px solid #E5E1D7", padding: 16, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#2C2C2A" }}>月結帳單</div>
              <div style={{ fontSize: 11, color: "#888780", marginTop: 4 }}>依服務業績、個人合約與自領商品自動計算公司應收。</div>
            </div>
            {!embedded && <label style={{ display: "grid", gap: 5, fontSize: 11, color: "#5F5E5A", fontWeight: 800 }}>結算月份
              <input type="month" value={month} onChange={(event) => { setLoading(true); setMonth(event.target.value); }} style={{ padding: "9px 12px", border: "1px solid #D3D1C7", borderRadius: 10, fontSize: 13 }} />
            </label>}
          </div>
          <div style={{ marginTop: 14, padding: "14px 16px", borderRadius: 14, background: "#EEEDFE", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: "#534AB7", fontSize: 13, fontWeight: 800 }}>{snapshot ? "本月公司應收帳單" : "本月公司應收試算"}</div>
              {snapshot && <div style={{ color: "#7772B8", fontSize: 10, marginTop: 3 }}>已收 {money(totalPaid)}・未收 {money(Math.max(0, totalReceivable - totalPaid))}</div>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <strong style={{ color: "#534AB7", fontSize: 24 }}>{money(totalReceivable)}</strong>
              {!snapshot && <button onClick={confirmMonth} disabled={saving || loading} style={{ padding: "9px 13px", border: "none", borderRadius: 10, background: "#534AB7", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>{saving ? "確認中" : "確認本月帳單"}</button>}
            </div>
          </div>
          {snapshot && <div style={{ fontSize: 10, color: "#888780", marginTop: 8 }}>確認時間：{new Date(snapshot.confirmed_at).toLocaleString("zh-TW")}・確認人：{snapshot.confirmed_by}</div>}
        </section>

        {notice && <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 10, background: notice.includes("失敗") ? "#FCEBEB" : "#E1F5EE", color: notice.includes("失敗") ? "#A32D2D" : "#085041", fontSize: 12, fontWeight: 800 }}>{notice}</div>}

        {loading ? <div style={{ color: "#888780", padding: 20 }}>載入試算資料...</div> : (
          <div style={{ display: "grid", gap: 12 }}>
            {displayRows.map((row) => (
              <details key={row.designer.id} style={{ background: "#fff", border: "1px solid #E5E1D7", borderRadius: 16, padding: "14px 16px" }}>
                <summary style={{ cursor: "pointer", listStyle: "none", display: "grid", gridTemplateColumns: isDesktop ? "minmax(150px, 1fr) repeat(4, minmax(105px, .8fr)) 140px" : "1fr auto", gap: 10, alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: "#2C2C2A" }}>{row.designer.display_name || row.designer.name}</div>
                    <div style={{ fontSize: 10, color: row.contractMissing || row.rent <= 0 ? "#A32D2D" : "#888780", marginTop: 3 }}>{row.contractMissing || row.rent <= 0 ? "月租尚未設定" : `門檻 ${money(row.threshold)}`}{snapshot ? `・${paymentLabel(row.payment?.status)}` : ""}</div>
                  </div>
                  {isDesktop && <><Metric label="服務業績" value={money(row.serviceRevenue)} /><Metric label="商品銷售（查看）" value={money(row.productRevenue || 0)} /><Metric label="月租" value={row.rent > 0 ? money(row.rent) : "尚未設定"} /><Metric label="服務＋品牌費" value={money(row.businessCommission + row.marketingCommission)} /></>}
                  <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, color: "#888780" }}>公司應收</div><div style={{ fontSize: 18, color: "#534AB7", fontWeight: 900 }}>{money(row.receivable)}</div></div>
                </summary>
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #EEEAE2", display: "grid", gridTemplateColumns: isDesktop ? "repeat(2, minmax(0, 1fr))" : "1fr", gap: 8 }}>
                  <Line label="每月租金" value={row.rent} />
                  <Line label={`營業抽成（超過 ${money(row.threshold)} 後 ${Math.round(Number(row.designer.commission_rate || 0) * 100)}%）`} value={row.businessCommission} />
                  <Line label={`品牌共享費（服務業績 ${Math.round(Number(row.designer.brand_fee_rate || 0) * 100)}%）`} value={row.marketingCommission} />
                  <Line label="商品銷售（僅供查看，不列入計算）" value={row.productRevenue || 0} />
                  <Line label="自領商品代收" value={row.selfUse} />
                  {row.otherItems.map((item, index) => <Line key={`${item.name}-${index}`} label={item.name} value={item.amount} />)}
                </div>
                {snapshot && <PaymentEditor row={row} saving={saving} onSave={(payment) => updatePayment(row.designer.id, payment)} />}
              </details>
            ))}
          </div>
        )}
      </main>
      {!embedded && <AdminBottomNav current="report-designer" />}
    </div>
  );
}

function nextMonth(month: string) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(year, value, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

const snapshotKey = (month: string) => `monthly_settlement_${month}`;

function paymentLabel(status?: PaymentRecord["status"]) {
  if (status === "paid") return "已結清";
  if (status === "partial") return "部分收款";
  return "未收款";
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><div style={{ fontSize: 10, color: "#888780" }}>{label}</div><div style={{ fontSize: 13, color: "#2C2C2A", fontWeight: 800, marginTop: 2 }}>{value}</div></div>;
}

function Line({ label, value }: { label: string; value: number }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 11px", borderRadius: 10, background: "#F8F7F3", fontSize: 12 }}><span style={{ color: "#5F5E5A" }}>{label}</span><strong style={{ color: value < 0 ? "#087F5B" : "#2C2C2A" }}>{value < 0 ? `-${money(Math.abs(value))}` : money(value)}</strong></div>;
}

function CalculationLine({ label, note, value, warning = false }: { label: string; note: string; value: number; warning?: boolean }) {
  return <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 145px", gap: 12, padding: "13px 0", borderBottom: "1px solid #F0ECE4", alignItems: "center" }}><div style={{ color: "#2C2C2A", fontSize: 13, fontWeight: 700 }}>{label}<div style={{ color: warning ? "#A32D2D" : "#898279", fontSize: 10, fontWeight: 500, marginTop: 3 }}>{note}</div></div><strong style={{ textAlign: "right", color: warning ? "#A32D2D" : value < 0 ? "#087F5B" : "#2C2C2A", fontSize: 14 }}>{value < 0 ? `-${money(Math.abs(value))}` : money(value)}</strong></div>;
}

function PaymentEditor({ row, saving, onSave }: { row: SettlementRow; saving: boolean; onSave: (payment: PaymentRecord) => void }) {
  const [payment, setPayment] = useState<PaymentRecord>(row.payment || { status: "unpaid", paid_amount: 0, paid_date: "", payment_method: "現金", note: "" });
  return (
    <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#F7F5FF", border: "1px solid #E3DFFC" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <strong style={{ fontSize: 12, color: "#534AB7" }}>收款紀錄</strong>
        <span style={{ padding: "3px 8px", borderRadius: 999, background: payment.status === "paid" ? "#D7F8E6" : payment.status === "partial" ? "#FAEEDA" : "#F1EFE8", color: payment.status === "paid" ? "#087F5B" : payment.status === "partial" ? "#BA7517" : "#5F5E5A", fontSize: 10, fontWeight: 800 }}>{paymentLabel(payment.status)}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 8 }}>
        <label style={{ display: "grid", gap: 4, fontSize: 10, color: "#5F5E5A" }}>實收金額
          <input type="number" min="0" max={row.receivable} value={payment.paid_amount || ""} onChange={(event) => {
            const amount = Number(event.target.value || 0);
            setPayment({ ...payment, paid_amount: amount, status: amount <= 0 ? "unpaid" : amount >= row.receivable ? "paid" : "partial" });
          }} style={{ padding: "8px 9px", border: "1px solid #D3D1C7", borderRadius: 8, fontSize: 12 }} />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 10, color: "#5F5E5A" }}>收款日期
          <input type="date" value={payment.paid_date} onChange={(event) => setPayment({ ...payment, paid_date: event.target.value })} style={{ padding: "8px 9px", border: "1px solid #D3D1C7", borderRadius: 8, fontSize: 12 }} />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 10, color: "#5F5E5A" }}>付款方式
          <select value={payment.payment_method} onChange={(event) => setPayment({ ...payment, payment_method: event.target.value })} style={{ padding: "8px 9px", border: "1px solid #D3D1C7", borderRadius: 8, background: "#fff", fontSize: 12 }}><option>現金</option><option>轉帳</option><option>LINE Pay</option></select>
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 10, color: "#5F5E5A" }}>備註
          <input value={payment.note} onChange={(event) => setPayment({ ...payment, note: event.target.value })} placeholder="收款或調整說明" style={{ padding: "8px 9px", border: "1px solid #D3D1C7", borderRadius: 8, fontSize: 12 }} />
        </label>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
        <button type="button" onClick={() => setPayment({ ...payment, paid_amount: row.receivable, paid_date: payment.paid_date || new Date().toLocaleDateString("en-CA"), status: "paid" })} style={{ padding: "7px 10px", border: "1px solid #D3D1C7", borderRadius: 8, background: "#fff", color: "#534AB7", fontSize: 10, fontWeight: 800 }}>全額結清</button>
        <button type="button" disabled={saving} onClick={() => onSave(payment)} style={{ padding: "7px 12px", border: "none", borderRadius: 8, background: "#534AB7", color: "#fff", fontSize: 10, fontWeight: 800 }}>{saving ? "儲存中" : "儲存收款"}</button>
      </div>
    </div>
  );
}
