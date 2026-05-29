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
  const [exportMode, setExportMode] = useState<"month" | "year" | "range">("month");
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [chartType, setChartType] = useState<"bar" | "pie">("bar");
  const [selectedDesigner, setSelectedDesigner] = useState<number | null>(null);
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

  function exportExcel() {
    try {
      const XLSX = require("xlsx");
      const exportTx = getExportTransactions();
      const wb = XLSX.utils.book_new();
      const dr = designers.map((d: any) => {
        const r = calcDesignerReport(d);
        return { "設計師": d.name, "服務業績": r.serviceRevenue, "底扣金額": r.baseDeduction, "抽成比例": Math.round((d.commission_rate||0)*100)+"%", "服務抽成": r.serviceCommission, "品牌共享費": r.brandFee, "應付抽成": r.totalCommission };
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dr), "設計師抽成");
      const tr: any[] = [];
      exportTx.forEach((t: any) => {
        const date = t.created_at?.slice(0,10).replace(/-/g, "/") || "";
        const time = t.created_at?.slice(11,16) || "";
        const designer = designers.find((d: any) => d.id === t.designer_id)?.name || "-";
        const memberNo = getCustomerNo(t.customer_phone||"");
        const customer = t.customer_name || "";
        const allItems = [
          ...(t.service_items||[]).map((s: any) => ({ name: s.name, amount: s.amount })),
          ...(t.product_items||[]).map((p: any) => ({ name: p.name, amount: p.amount })),
        ];
        if (allItems.length === 0) {
          tr.push({ "日期": date, "時間": time, "設計師": designer, "會員編號": memberNo, "客人姓名": customer, "項目": "-", "金額": "", "總金額": t.total_amount, "支付方式": t.payment_method||"-" });
        } else {
          allItems.forEach((item: any, idx: number) => {
            tr.push({
              "日期": idx === 0 ? date : "",
              "時間": idx === 0 ? time : "",
              "設計師": idx === 0 ? designer : "",
              "會員編號": idx === 0 ? memberNo : "",
              "客人姓名": idx === 0 ? customer : "",
              "項目": item.name,
              "金額": item.amount,
              "總金額": idx === allItems.length - 1 ? t.total_amount : "",
              "支付方式": idx === allItems.length - 1 ? (t.payment_method||"-") : "",
            });
          });
        }
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tr), "交易明細");
      const yr = yearlyData.map(([month, amount]: any) => ({ "月份": month, "總業績": amount }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(yr), "年度統計");
      XLSX.writeFile(wb, "BC_報表_" + getExportLabel() + ".xlsx");
    } catch(e) { alert("Excel 導出失敗"); }
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

  // 服務分類統計
  const serviceStats = (() => {
    const stats: Record<string, number> = {};
    monthlyTransactions.forEach((t: any) => {
      (t.service_items || []).forEach((s: any) => {
        if (!s.name) return;
        stats[s.name] = (stats[s.name] || 0) + (s.amount || 0);
      });
    });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  })();
  const maxServiceAmount = Math.max(...serviceStats.map(([, v]) => v), 1);
  const serviceColors = ["#534AB7","#7B6FD4","#1D9E75","#BA7517","#E24B4A","#0C447C","#085041","#A32D2D","#633806","#3C3489"];
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
          <button onClick={() => setShowExportPanel(!showExportPanel)} style={{ background: "#1D9E75", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>導出 Excel ▼</button>
        </div>
      </div>

      <div style={{ padding: 16 }}>
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

        {/* 設計師業績圓餅圖 */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, border: "0.5px solid #D3D1C7" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A", marginBottom: 14 }}>
            {selectedDesigner === null ? `${selectedMonth.replace("-", " 年 ")} 月設計師業績` : `${designers.find(d => d.id === selectedDesigner)?.name} 服務項目`}
          </div>

          {selectedDesigner === null ? (
            // 設計師業績圓餅圖
            <div>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                <svg width="260" height="260" viewBox="0 0 260 260">
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
                      const path = pct >= 1 ? `M ${cx} ${cy} m -${r} 0 a ${r} ${r} 0 1 1 ${r*2} 0 a ${r} ${r} 0 1 1 -${r*2} 0` : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                      const labelR = r + 22;
                      const lx = cx + labelR * Math.cos(midAngle), ly = cy + labelR * Math.sin(midAngle);
                      return (
                        <g key={d.id} onClick={() => setSelectedDesigner(d.id)} style={{ cursor: "pointer" }}>
                          <path d={path} fill={serviceColors[i % serviceColors.length]} stroke="#fff" strokeWidth="2" />
                          {pct >= 0.05 && (
                            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="600" fill={serviceColors[i % serviceColors.length]}>
                              <tspan x={lx} dy="-5">{d.name}</tspan>
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
                  <div style={{ flex: 1, fontSize: 13, color: "#2C2C2A", fontWeight: 500 }}>{d.name}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: serviceColors[i % serviceColors.length] }}>${calcDesignerReport(d).serviceRevenue.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: "#888780", background: "#fff", borderRadius: 6, padding: "1px 6px" }}>
                    {Math.round((calcDesignerReport(d).serviceRevenue / monthTotalRevenue) * 100)}%
                  </div>
                  <span style={{ fontSize: 11, color: "#888780" }}>→</span>
                </div>
              ))}
            </div>
          ) : (
            // 個別設計師服務項目圓餅圖
            <div>
              <button onClick={() => setSelectedDesigner(null)} style={{ background: "#F1EFE8", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer", marginBottom: 12, color: "#534AB7" }}>← 返回總覽</button>
              {(() => {
                const dTx = monthlyTransactions.filter((t: any) => t.designer_id === selectedDesigner);
                const stats: Record<string, number> = {};
                dTx.forEach((t: any) => {
                  (t.service_items || []).forEach((s: any) => {
                    if (s.name) stats[s.name] = (stats[s.name] || 0) + (s.amount || 0);
                  });
                });
                const entries = Object.entries(stats).sort((a, b) => b[1] - a[1]);
                const total = entries.reduce((sum, [, v]) => sum + v, 0);
                if (entries.length === 0) return <div style={{ textAlign: "center", padding: 20, color: "#888780" }}>本月無服務紀錄</div>;
                let cumulative = 0;
                return (
                  <div>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                      <svg width="260" height="260" viewBox="0 0 260 260">
                        {entries.map(([name, amount], i) => {
                          const pct = amount / total;
                          const startAngle = cumulative * 2 * Math.PI - Math.PI / 2;
                          cumulative += pct;
                          const endAngle = cumulative * 2 * Math.PI - Math.PI / 2;
                          const midAngle = (startAngle + endAngle) / 2;
                          const r = 90, cx = 130, cy = 130;
                          const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
                          const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
                          const largeArc = pct > 0.5 ? 1 : 0;
                          const d = pct >= 1 ? `M ${cx} ${cy} m -${r} 0 a ${r} ${r} 0 1 1 ${r*2} 0 a ${r} ${r} 0 1 1 -${r*2} 0` : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                          const labelR = r + 22;
                          const lx = cx + labelR * Math.cos(midAngle), ly = cy + labelR * Math.sin(midAngle);
                          return (
                            <g key={name}>
                              <path d={d} fill={serviceColors[i % serviceColors.length]} stroke="#fff" strokeWidth="2" />
                              {pct >= 0.05 && (
                                <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="600" fill={serviceColors[i % serviceColors.length]}>
                                  <tspan x={lx} dy="-5">{name.slice(0, 4)}</tspan>
                                  <tspan x={lx} dy="12">${(amount/1000).toFixed(1)}k</tspan>
                                </text>
                              )}
                            </g>
                          );
                        })}
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
