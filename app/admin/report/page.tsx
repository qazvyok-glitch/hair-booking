"use client";
import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminBottomNav from "../components/BottomNav";

type Designer = {
  id: number;
  name: string;
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
  service_items: { id: number; name: string; amount: number; discount: number }[];
  total_amount: number;
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

export default function AdminReport() {
  const router = useRouter();
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [productUsages, setProductUsages] = useState<ProductUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [isDesktop, setIsDesktop] = useState(false);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  });
  const [expandedDesigner, setExpandedDesigner] = useState<number | null>(null);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);


  function getCustomerNo(phone: string) {
    return (customers as any[])?.find((c: any) => c.phone === phone)?.customer_no || "-";
  }

  function exportExcel() {
    try {
      const XLSX = require("xlsx");
      const wb = XLSX.utils.book_new();
      const dr = designers.map((d: any) => {
        const r = calcDesignerReport(d);
        return { "設計師": d.name, "服務業績": r.serviceRevenue, "底扣金額": r.baseDeduction, "抽成比例": Math.round((d.commission_rate||0)*100)+"%", "服務抽成": r.serviceCommission, "品牌共享費": r.brandFee, "應付抽成": r.totalCommission };
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dr), "設計師抽成");
      const tr = monthlyTransactions.map((t: any) => ({
        "日期": t.created_at?.slice(0,10), "時間": t.created_at?.slice(11,16),
        "設計師": designers.find((d: any) => d.id === t.designer_id)?.name||"-",
        "會員編號": getCustomerNo(t.customer_phone||""), "客人姓名": t.customer_name,
        "服務項目": t.service_items?.map((s: any) => s.name).join("、")||"-",
        "購買商品": t.product_items?.map((p: any) => p.name + " x" + p.quantity).join("、")||"-",
        "服務金額": t.service_items?.reduce((sum: number, s: any) => sum + (s.amount||0), 0)||0,
        "商品金額": t.product_items?.reduce((sum: number, p: any) => sum + (p.amount||0), 0)||0,
        "總金額": t.total_amount, "支付方式": t.payment_method||"-",
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tr), "交易明細");
      const yr = yearlyData.map(([month, amount]: any) => ({ "月份": month, "總業績": amount }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(yr), "年度統計");
      XLSX.writeFile(wb, "BC_報表_" + selectedMonth + ".xlsx");
    } catch(e) { alert("Excel 導出失敗"); }
  }

  function exportPDF() {
    try {
      const { jsPDF } = require("jspdf");
      const autoTable = require("jspdf-autotable").default;
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(14);
      doc.text("Bing Cherry Hair Salon - " + selectedMonth + " 月報表", 14, 15);
      doc.setFontSize(11);
      doc.text("設計師抽成明細", 14, 26);
      autoTable(doc, {
        startY: 30,
        head: [["設計師","服務業績","底扣","抽成%","服務抽成","品牌費","應付抽成"]],
        body: designers.map((d: any) => {
          const r = calcDesignerReport(d);
          return [d.name, "$"+r.serviceRevenue.toLocaleString(), "$"+r.baseDeduction.toLocaleString(), Math.round((d.commission_rate||0)*100)+"%", "$"+r.serviceCommission.toLocaleString(), "$"+r.brandFee.toLocaleString(), "$"+r.totalCommission.toLocaleString()];
        }),
        headStyles: { fillColor: [83,74,183] }, styles: { fontSize: 9 },
      });
      const y1 = (doc as any).lastAutoTable.finalY + 10;
      doc.text("交易明細", 14, y1);
      autoTable(doc, {
        startY: y1 + 4,
        head: [["日期","設計師","會員編號","客人","服務項目","購買商品","總金額","支付"]],
        body: monthlyTransactions.map((t: any) => [
          t.created_at?.slice(0,10)||"",
          designers.find((d: any) => d.id === t.designer_id)?.name||"-",
          getCustomerNo(t.customer_phone||""),
          t.customer_name,
          t.service_items?.map((s: any) => s.name).join(",").slice(0,30)||"-",
          t.product_items?.map((p: any) => p.name).join(",").slice(0,20)||"-",
          "$"+t.total_amount?.toLocaleString(),
          t.payment_method||"-",
        ]),
        headStyles: { fillColor: [83,74,183] }, styles: { fontSize: 8 },
      });
      doc.save("BC_報表_" + selectedMonth + ".pdf");
    } catch(e) { alert("PDF 導出失敗"); }
  }


  useEffect(() => {
    const session = sessionStorage.getItem("adminSession");
    if (!session) { router.push("/admin/login"); return; }

    async function fetchData() {
      const [{ data: dData }, { data: tData }, { data: pData }, { data: cData }] = await Promise.all([
        supabase.from("designers").select("*").order("id"),
        supabase.from("transactions").select("*").order("created_at", { ascending: false }),
        supabase.from("product_usage").select("*").order("used_at", { ascending: false }),
        supabase.from("customers").select("id, phone, customer_no"),
      ]);
      if (dData) setDesigners(dData);
      if (tData) setTransactions(tData);
      if (pData) setProductUsages(pData);
      if (cData) setCustomers(cData);
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

  const monthlyTransactions = transactions.filter(t => t.created_at?.slice(0, 7) === selectedMonth);
  const monthlyProductUsages = productUsages.filter(p => p.used_at?.slice(0, 7) === selectedMonth);

  function calcDesignerReport(d: Designer) {
    const dTransactions = monthlyTransactions.filter(t => t.designer_id === d.id);

    // 服務業績（已含折扣後的實際金額）
    const serviceRevenue = dTransactions.reduce((sum, t) => sum + (t.total_amount || 0), 0);

    // 折扣總額（僅顯示用）
    const totalDiscount = dTransactions.reduce((sum, t) => {
      const discount = (t.service_items || []).reduce((s: number, si: any) => s + (si.discount || 0), 0);
      return sum + discount;
    }, 0);

    // 底扣
    const baseDeduction = d.commission_base_deduction || 0;

    // 服務抽成計算：(業績 - 底扣) × 抽成%
    const commissionBase = Math.max(0, serviceRevenue - baseDeduction);
    const serviceCommission = Math.round(commissionBase * (d.commission_rate || 0));

    // 品牌社群資源共享費：總業績 × %
    const brandFeeRate = (d as any).brand_fee_rate || 0;
    const brandFee = Math.round(serviceRevenue * brandFeeRate);

    // 實際應付抽成
    const totalCommission = Math.max(0, serviceCommission - brandFee);

    return {
      serviceRevenue,
      totalDiscount,
      baseDeduction,
      commissionBase,
      serviceCommission,
      brandFee,
      brandFeeRate,
      totalCommission,
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
          <button onClick={exportExcel} style={{ background: "#1D9E75", color: "#fff", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11, cursor: "pointer" }}>Excel</button>
          <button onClick={exportPDF} style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11, cursor: "pointer" }}>PDF</button>
        </div>
      </div>

      <div style={{ padding: 16 }}>
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

        {/* 各設計師報表 */}
        <div style={{ fontSize: 12, fontWeight: 600, color: "#888780", marginBottom: 8 }}>各設計師明細</div>
        {designers.filter(d => d.id !== undefined).map((d) => {
          const report = calcDesignerReport(d);
          const isExpanded = expandedDesigner === d.id;
          return (
            <div key={d.id} style={{ background: "#fff", borderRadius: 14, marginBottom: 10, border: "0.5px solid #D3D1C7", overflow: "hidden" }}>
              {/* 設計師標題列 */}
              <div onClick={() => setExpandedDesigner(isExpanded ? null : d.id)} style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: d.bg_color, color: d.text_color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0, overflow: "hidden" }}>
                  {d.avatar_url ? <img src={d.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : d.initials}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#2C2C2A" }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: "#888780" }}>業績 ${report.serviceRevenue.toLocaleString()} ・ {report.transactionCount} 筆</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#534AB7" }}>${report.totalCommission.toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: "#888780" }}>應付抽成</div>
                </div>
                <div style={{ fontSize: 12, color: "#888780", marginLeft: 4 }}>{isExpanded ? "▲" : "▼"}</div>
              </div>

              {/* 展開明細 */}
              {isExpanded && (
                <div style={{ borderTop: "0.5px solid #F1EFE8", padding: "12px 14px", background: "#FAFAF8" }}>
                  {/* 計算明細 */}
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
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, paddingTop: 6, borderTop: "0.5px solid #F1EFE8", marginTop: 2 }}>
                        <span style={{ color: "#2C2C2A" }}>應付抽成</span>
                        <span style={{ color: "#534AB7" }}>${report.totalCommission.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* 交易明細 */}
                  {report.transactions.length > 0 && (
                    <div style={{ background: "#fff", borderRadius: 10, padding: 12, border: "0.5px solid #D3D1C7" }}>
                      {report.transactions.map((t: any) => (
                        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "0.5px solid #F1EFE8", overflowX: "auto", whiteSpace: "nowrap" }}>
                          <span style={{ fontSize: 11, color: "#888780", flexShrink: 0 }}>{t.created_at?.slice(0, 10).replace(/-/g, "/")} {t.created_at?.slice(11, 16)}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#2C2C2A", flexShrink: 0 }}>{t.customer_name}</span>
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
