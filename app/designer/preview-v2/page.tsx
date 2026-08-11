"use client";

import { useState } from "react";

type TabKey = "today" | "pending" | "calendar" | "earnings";

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: "today", label: "今日", icon: "□" },
  { key: "pending", label: "待確認", icon: "◷" },
  { key: "calendar", label: "排程", icon: "▣" },
  { key: "earnings", label: "收入", icon: "$" },
];

const todayRows = [
  { time: "10:30", name: "Lynn", service: "質感燙＋剪髮", status: "即將到來", tone: "upcoming", action: "查看" },
  { time: "13:00", name: "Mira", service: "染髮（M）", status: "服務中", tone: "progress", action: "結帳" },
  { time: "15:30", name: "Joey", service: "護髮", status: "已完成", tone: "done", action: "查看" },
];

const pendingRows = [
  { time: "11:00", name: "Peggy", service: "剪髮（含髮浴）", detail: "0920-xxx-xxx" },
  { time: "16:30", name: "Alisa", service: "設計染（L）", detail: "需要翻譯備註" },
];

const scheduleItems: Record<number, { text: string; tone: string }[]> = {
  5: [{ text: "10:00 剪髮", tone: "cut" }],
  8: [{ text: "13:00 染髮", tone: "color" }],
  10: [{ text: "15:30 護髮", tone: "treatment" }],
  20: [{ text: "11:00 燙髮", tone: "perm" }],
};

export default function DesignerPreviewV2Page() {
  const [activeTab, setActiveTab] = useState<TabKey>("today");

  return (
    <main className="preview-page">
      <section className="phone-shell">
        <Header />
        <div className="screen-body">
          {activeTab === "today" && <TodayView />}
          {activeTab === "pending" && <PendingView />}
          {activeTab === "calendar" && <CalendarView />}
          {activeTab === "earnings" && <EarningsView />}
        </div>
        <BottomTabs activeTab={activeTab} onChange={setActiveTab} />
      </section>

      <style>{`
        .preview-page {
          min-height: 100vh;
          background: #eef0f3;
          display: flex;
          justify-content: center;
          padding: 20px;
          color: #1f2937;
        }

        .phone-shell {
          width: 100%;
          max-width: 430px;
          height: min(900px, calc(100vh - 40px));
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 26px;
          overflow: hidden;
          box-shadow: 0 18px 40px rgba(31, 41, 55, 0.12);
          display: flex;
          flex-direction: column;
        }

        .top-bar {
          height: 72px;
          background: #fff;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          flex: 0 0 auto;
        }

        .brand-area {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .logo {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: #050505;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -0.04em;
          position: relative;
        }

        .logo::after {
          content: "";
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #9b1f1f;
          position: absolute;
          right: 9px;
          bottom: 8px;
          box-shadow: -7px 0 0 #c92d2d;
        }

        .designer-name {
          font-size: 18px;
          font-weight: 850;
          line-height: 1.05;
        }

        .designer-role {
          font-size: 13px;
          color: #6b7280;
          margin-top: 4px;
          font-weight: 650;
        }

        .logout-btn {
          border: 1px solid #dfe3ea;
          background: #fff;
          color: #5f6673;
          border-radius: 12px;
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 750;
        }

        .screen-body {
          flex: 1 1 auto;
          overflow-y: auto;
          padding: 20px 16px 18px;
        }

        .page-title {
          font-size: 25px;
          line-height: 1.1;
          margin: 0 0 8px;
          font-weight: 900;
          letter-spacing: -0.04em;
        }

        .page-subtitle {
          color: #9aa3af;
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 16px;
        }

        .status-line {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          font-size: 13px;
          font-weight: 850;
          margin-bottom: 22px;
        }

        .dot {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          margin-right: 6px;
        }

        .progress-text { color: #1d6fd4; }
        .upcoming-text { color: #c96810; }
        .done-text { color: #258354; }
        .progress-dot { background: #2389de; }
        .upcoming-dot { background: #f28b13; }
        .done-dot { background: #22a566; }

        .list-card,
        .pending-card,
        .panel,
        .summary-card,
        .period-card,
        .final-card {
          background: #fff;
          border: 1px solid #e6e9ef;
          border-radius: 16px;
          box-shadow: 0 8px 18px rgba(31, 41, 55, 0.04);
        }

        .appointment-row {
          display: grid;
          grid-template-columns: 64px 1fr auto;
          align-items: center;
          gap: 10px;
          min-height: 96px;
          padding: 0 14px;
          border-bottom: 1px solid #edf0f4;
        }

        .appointment-row:last-child {
          border-bottom: none;
        }

        .row-time {
          font-size: 18px;
          font-weight: 850;
          color: #1f2937;
        }

        .row-name {
          font-size: 16px;
          font-weight: 900;
          margin-bottom: 5px;
        }

        .row-service {
          color: #5f6673;
          font-size: 13px;
          font-weight: 700;
        }

        .row-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: flex-end;
        }

        .pill {
          border-radius: 9px;
          padding: 5px 9px;
          font-size: 12px;
          font-weight: 850;
          white-space: nowrap;
        }

        .pill.upcoming {
          background: #fff0dc;
          color: #d06a00;
        }

        .pill.progress {
          background: #e8f2ff;
          color: #126dc2;
        }

        .pill.done {
          background: #e8f7ef;
          color: #208051;
        }

        .small-action {
          min-width: 50px;
          border: 1px solid #2290e6;
          color: #1478c8;
          background: #fff;
          border-radius: 8px;
          padding: 6px 9px;
          font-weight: 850;
          font-size: 13px;
        }

        .pending-list {
          display: grid;
          gap: 14px;
        }

        .pending-card {
          min-height: 118px;
          display: grid;
          grid-template-columns: 58px 1fr 78px;
          gap: 10px;
          align-items: center;
          padding: 14px;
        }

        .pending-actions {
          display: grid;
          gap: 9px;
        }

        .accept-btn,
        .decline-btn {
          border-radius: 8px;
          padding: 8px 0;
          background: #fff;
          font-weight: 900;
          font-size: 14px;
        }

        .accept-btn {
          border: 1px solid #f59f2c;
          color: #e67600;
        }

        .decline-btn {
          border: 1px solid #ff6b7a;
          color: #e43751;
        }

        .note-text {
          color: #e67600;
          font-weight: 850;
        }

        .segmented {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          padding: 3px;
          gap: 3px;
          margin-bottom: 18px;
        }

        .segment,
        .income-segment {
          border: none;
          background: transparent;
          color: #4b5563;
          border-radius: 15px;
          padding: 9px 0;
          font-weight: 850;
          font-size: 14px;
        }

        .segment.active,
        .income-segment.active {
          background: #148bd8;
          color: #fff;
        }

        .calendar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 8px 0 18px;
        }

        .month-title {
          font-size: 21px;
          font-weight: 900;
        }

        .circle-nav {
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 50%;
          background: #eef1f5;
          color: #4b5563;
          font-weight: 900;
        }

        .weekday-grid,
        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
        }

        .weekday-grid {
          color: #7b8492;
          font-size: 12px;
          font-weight: 850;
          text-align: center;
          margin-bottom: 8px;
        }

        .day-cell {
          min-height: 66px;
          border: 1px solid #edf0f4;
          background: #fff;
          padding: 7px 5px;
          font-size: 13px;
          font-weight: 850;
          color: #374151;
          position: relative;
        }

        .day-cell.selected {
          background: #eaf7ff;
          outline: 1.5px solid #74c8ff;
          z-index: 1;
        }

        .date-badge {
          display: inline-flex;
          width: 25px;
          height: 25px;
          border-radius: 50%;
          align-items: center;
          justify-content: center;
        }

        .selected .date-badge {
          background: #208bd8;
          color: #fff;
        }

        .schedule-bar {
          display: block;
          margin-top: 5px;
          border-radius: 5px;
          padding: 3px 4px;
          font-size: 10px;
          line-height: 1.15;
          color: #374151;
        }

        .cut { background: #dff1ff; }
        .color { background: #d7f8ef; }
        .perm { background: #ffe2ef; }
        .treatment { background: #fff0cf; }

        .legend {
          display: flex;
          gap: 12px;
          margin-top: 18px;
          color: #6b7280;
          font-size: 12px;
          font-weight: 750;
        }

        .legend-mark {
          display: inline-block;
          width: 12px;
          height: 12px;
          border-radius: 4px;
          margin-right: 5px;
          vertical-align: -2px;
        }

        .period-grid,
        .summary-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 12px;
        }

        .period-card {
          padding: 13px;
        }

        .period-label,
        .panel-label {
          color: #8b95a3;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.08em;
          margin-bottom: 6px;
        }

        .period-date {
          font-weight: 900;
          font-size: 14px;
        }

        .income-tabs {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          padding: 3px;
          gap: 3px;
          margin-bottom: 14px;
        }

        .income-segment {
          font-size: 12px;
          padding: 8px 0;
        }

        .summary-card {
          padding: 16px;
        }

        .summary-amount {
          color: #1478c8;
          font-size: 21px;
          font-weight: 950;
          margin-bottom: 8px;
        }

        .summary-amount.purple {
          color: #6847d9;
        }

        .summary-title {
          font-weight: 900;
          color: #1478c8;
          margin-bottom: 4px;
        }

        .summary-title.purple {
          color: #6847d9;
        }

        .summary-sub {
          color: #36a9ff;
          font-size: 12px;
          font-weight: 750;
        }

        .panel {
          padding: 16px;
          margin-bottom: 14px;
        }

        .breakdown-row {
          display: flex;
          justify-content: space-between;
          padding: 9px 0;
          border-bottom: 1px solid #edf0f4;
          color: #374151;
          font-weight: 750;
        }

        .breakdown-row:last-child {
          border-bottom: none;
          color: #1478c8;
          font-weight: 900;
        }

        .negative {
          color: #ef244e;
        }

        .final-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px 16px;
          font-weight: 950;
        }

        .final-amount {
          font-size: 25px;
        }

        .bottom-tabs {
          height: 74px;
          background: #fff;
          border-top: 1px solid #e5e7eb;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          flex: 0 0 auto;
        }

        .tab-btn {
          border: none;
          background: transparent;
          color: #9aa3af;
          font-weight: 850;
          font-size: 12px;
          position: relative;
          padding-top: 10px;
        }

        .tab-btn.active {
          color: #148bd8;
        }

        .tab-btn.active::before {
          content: "";
          position: absolute;
          top: 0;
          left: 28%;
          right: 28%;
          height: 4px;
          border-radius: 0 0 999px 999px;
          background: #148bd8;
        }

        .tab-icon {
          display: block;
          font-size: 23px;
          line-height: 1;
          margin-bottom: 5px;
        }

        @media (max-width: 460px) {
          .preview-page {
            padding: 0;
          }

          .phone-shell {
            max-width: none;
            height: 100vh;
            border-radius: 0;
            border: none;
          }
        }
      `}</style>
    </main>
  );
}

function Header() {
  return (
    <header className="top-bar">
      <div className="brand-area">
        <div className="logo">BC</div>
        <div>
          <div className="designer-name">Cherry</div>
          <div className="designer-role">設計師</div>
        </div>
      </div>
      <button className="logout-btn">登出</button>
    </header>
  );
}

function TodayView() {
  return (
    <>
      <h1 className="page-title">今日</h1>
      <div className="page-subtitle">8月11日 星期二</div>
      <div className="status-line">
        <span className="progress-text"><i className="dot progress-dot" />服務中：1</span>
        <span className="upcoming-text"><i className="dot upcoming-dot" />即將到來：3</span>
        <span className="done-text"><i className="dot done-dot" />已完成：2</span>
      </div>
      <section className="list-card">
        {todayRows.map((row) => (
          <div className="appointment-row" key={`${row.time}-${row.name}`}>
            <div className="row-time">{row.time}</div>
            <div>
              <div className="row-name">{row.name}</div>
              <div className="row-service">{row.service}</div>
            </div>
            <div className="row-actions">
              <span className={`pill ${row.tone}`}>{row.status}</span>
              <button className="small-action">{row.action}</button>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}

function PendingView() {
  return (
    <>
      <h1 className="page-title">待確認</h1>
      <div className="page-subtitle">目前有 2 筆預約待回覆</div>
      <section className="pending-list">
        {pendingRows.map((row) => (
          <div className="pending-card" key={`${row.time}-${row.name}`}>
            <div className="row-time">{row.time}</div>
            <div>
              <div className="row-name">{row.name}</div>
              <div className="row-service">{row.service}</div>
              <div className={`row-service ${row.detail.includes("翻譯") ? "note-text" : ""}`}>{row.detail}</div>
            </div>
            <div className="pending-actions">
              <button className="accept-btn">接受</button>
              <button className="decline-btn">婉拒</button>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}

function CalendarView() {
  return (
    <>
      <div className="segmented">
        <button className="segment">3日</button>
        <button className="segment">週</button>
        <button className="segment active">月</button>
      </div>
      <div className="calendar-header">
        <button className="circle-nav">‹</button>
        <div className="month-title">2026年8月</div>
        <button className="circle-nav">›</button>
      </div>
      <div className="weekday-grid">
        {["日", "一", "二", "三", "四", "五", "六"].map((day) => <div key={day}>{day}</div>)}
      </div>
      <div className="calendar-grid">
        {Array.from({ length: 31 }, (_, index) => {
          const date = index + 1;
          const items = scheduleItems[date] || [];
          return (
            <div className={`day-cell ${date === 11 ? "selected" : ""}`} key={date}>
              <span className="date-badge">{date}</span>
              {items.map((item) => (
                <span className={`schedule-bar ${item.tone}`} key={item.text}>{item.text}</span>
              ))}
            </div>
          );
        })}
      </div>
      <div className="legend">
        <span><i className="legend-mark cut" />剪髮</span>
        <span><i className="legend-mark color" />染髮</span>
        <span><i className="legend-mark perm" />燙髮</span>
        <span><i className="legend-mark treatment" />護髮</span>
      </div>
    </>
  );
}

function EarningsView() {
  return (
    <>
      <h1 className="page-title">我的收入</h1>
      <div className="period-grid">
        <div className="period-card">
          <div className="period-label">本期區間</div>
          <div className="period-date">8月1日－8月15日</div>
        </div>
        <div className="period-card">
          <div className="period-label">下期區間</div>
          <div className="period-date">8月16日－8月31日</div>
        </div>
      </div>
      <div className="income-tabs">
        <button className="income-segment">今日</button>
        <button className="income-segment">下期</button>
        <button className="income-segment active">本期</button>
        <button className="income-segment">上期</button>
        <button className="income-segment">本月</button>
      </div>
      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-amount">NT$ 38,600</div>
          <div className="summary-title">服務收入</div>
          <div className="summary-sub">12 筆服務 · 折扣前</div>
        </div>
        <div className="summary-card">
          <div className="summary-amount purple">NT$ 36,500</div>
          <div className="summary-title purple">店收金額</div>
          <div className="summary-sub">已扣除折扣</div>
        </div>
      </div>
      <section className="panel">
        <div className="panel-label">收入明細</div>
        <div className="breakdown-row"><span>原價（折扣前）</span><span>NT$38,600</span></div>
        <div className="breakdown-row"><span>折扣金額</span><span className="negative">-NT$2,100</span></div>
        <div className="breakdown-row"><span>店收金額</span><span>NT$36,500</span></div>
        <div className="breakdown-row"><span>本期可查看金額</span><span>NT$36,500</span></div>
      </section>
      <div className="final-card">
        <span>本期合計</span>
        <span className="final-amount">NT$36,500</span>
      </div>
    </>
  );
}

function BottomTabs({ activeTab, onChange }: { activeTab: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <nav className="bottom-tabs">
      {tabs.map((tab) => (
        <button
          className={`tab-btn ${activeTab === tab.key ? "active" : ""}`}
          key={tab.key}
          onClick={() => onChange(tab.key)}
        >
          <span className="tab-icon">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
