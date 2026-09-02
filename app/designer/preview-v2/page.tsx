"use client";

import { useState } from "react";

type TabKey = "today" | "pending" | "calendar" | "earnings";
type ScheduleMode = "3日" | "週" | "月";
type PendingDecision = "pending" | "accepted" | "declined";
type EarningsRange = "今日" | "本月" | "指定月份" | "日期區間";
type Appointment = {
  time: string;
  name: string;
  phone: string;
  service: string;
  status: string;
  tone: "upcoming" | "progress" | "done";
  action: "查看" | "結帳";
  note: string;
  image: string;
};
type CheckoutDraft = {
  serviceAmount: number;
  serviceDiscount: number;
  productAmount: number;
  productDiscount: number;
  paymentMethod: string;
  note: string;
};
type BookingDraft = {
  date: string;
  time: string;
  name: string;
  phone: string;
  service: string;
  note: string;
};
type CustomerRecord = {
  id: string;
  name: string;
  phone: string;
  lastService: string;
  note: string;
  lastVisit: string;
};

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: "today", label: "今日", icon: "□" },
  { key: "pending", label: "待確認", icon: "◷" },
  { key: "calendar", label: "排程", icon: "▣" },
  { key: "earnings", label: "收入", icon: "$" },
];

const todayRows: Appointment[] = [
  { time: "10:30", name: "Lynn", phone: "0920-262-570", service: "質感燙＋剪髮", status: "即將到來", tone: "upcoming", action: "查看", note: "想保留長度，髮尾整理即可。", image: "尚未上傳參考圖片" },
  { time: "13:00", name: "Mira", phone: "0912-345-678", service: "染髮（M）", status: "服務中", tone: "progress", action: "結帳", note: "偏冷棕，不要太亮。", image: "已上傳 1 張參考圖片" },
  { time: "15:30", name: "Joey", phone: "0988-111-222", service: "護髮", status: "已完成", tone: "done", action: "查看", note: "頭皮較敏感。", image: "尚未上傳參考圖片" },
];

const pendingRows = [
  { date: "8/13（四）", time: "11:00", name: "Peggy", phone: "0920-xxx-xxx", service: "剪髮（含髮浴）", detail: "想剪短一點，保留瀏海。" },
  { date: "8/14（五）", time: "16:30", name: "Alisa", phone: "0918-xxx-xxx", service: "設計染（L）", detail: "Please make the color natural brown." },
];

const scheduleItems: Record<number, { text: string; tone: string }[]> = {
  5: [{ text: "10:00 剪髮", tone: "cut" }],
  8: [{ text: "13:00 染髮", tone: "color" }],
  10: [{ text: "15:30 護髮", tone: "treatment" }],
  20: [{ text: "11:00 燙髮", tone: "perm" }],
};

const customerRecords: CustomerRecord[] = [
  { id: "lynn", name: "Lynn", phone: "0920-262-570", lastService: "質感燙＋剪髮", note: "喜歡自然蓬鬆，瀏海不要剪太短。", lastVisit: "上次 7/10" },
  { id: "mira", name: "Mira", phone: "0912-345-678", lastService: "染髮（M）", note: "偏冷棕，不要太亮；頭皮較敏感。", lastVisit: "上次 7/24" },
  { id: "joey", name: "Joey", phone: "0988-111-222", lastService: "HHN深層結構護髮", note: "髮尾乾，護髮停留時間可拉長。", lastVisit: "上次 8/02" },
];

const earningsRanges: Record<EarningsRange, { period: string; service: number; discount: number; count: number; label: string }> = {
  今日: { period: "8月12日", service: 4800, discount: 300, count: 2, label: "今日收入" },
  本月: { period: "8月1日－8月31日", service: 38600, discount: 2100, count: 12, label: "本月收入" },
  指定月份: { period: "2026年7月", service: 52400, discount: 3600, count: 18, label: "指定月份收入" },
  日期區間: { period: "8月10日－8月15日", service: 16800, discount: 900, count: 6, label: "日期區間收入" },
};

export default function DesignerPreviewV2Page() {
  const [activeTab, setActiveTab] = useState<TabKey>("today");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [checkoutAppointment, setCheckoutAppointment] = useState<Appointment | null>(null);
  const [checkoutComplete, setCheckoutComplete] = useState(false);
  const [pendingDecisions, setPendingDecisions] = useState<Record<string, PendingDecision>>({});
  const [selectedPending, setSelectedPending] = useState<(typeof pendingRows)[number] | null>(null);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("月");
  const [selectedScheduleDate, setSelectedScheduleDate] = useState("2026-08-12");
  const [bookingDraft, setBookingDraft] = useState<BookingDraft | null>(null);
  const [bookingComplete, setBookingComplete] = useState(false);

  function setDecision(name: string, decision: PendingDecision) {
    setPendingDecisions((prev) => ({ ...prev, [name]: decision }));
  }

  return (
    <main className="preview-page">
      <section className="phone-shell">
        <Header />
        <div className="screen-body">
          {activeTab === "today" && <TodayView onView={setSelectedAppointment} onCheckout={setCheckoutAppointment} onAddBooking={() => { setBookingComplete(false); setBookingDraft(createBookingDraft()); }} />}
          {activeTab === "pending" && <PendingView decisions={pendingDecisions} onOpen={setSelectedPending} />}
          {activeTab === "calendar" && <CalendarView mode={scheduleMode} selectedDate={selectedScheduleDate} onModeChange={setScheduleMode} onSelectDate={setSelectedScheduleDate} onAddBooking={(date, time) => { setBookingComplete(false); setBookingDraft(createBookingDraft(date, time)); }} />}
          {activeTab === "earnings" && <EarningsView />}
        </div>
        <BottomTabs activeTab={activeTab} onChange={setActiveTab} />
      </section>
      {selectedAppointment && <AppointmentModal row={selectedAppointment} onClose={() => setSelectedAppointment(null)} />}
      {selectedPending && <PendingConfirmModal row={selectedPending} decision={pendingDecisions[selectedPending.name] || "pending"} onDecide={setDecision} onClose={() => setSelectedPending(null)} />}
      {checkoutAppointment && <CheckoutModal row={checkoutAppointment} complete={checkoutComplete} onComplete={() => setCheckoutComplete(true)} onClose={() => { setCheckoutAppointment(null); setCheckoutComplete(false); }} />}
      {bookingDraft && <AddBookingModal draft={bookingDraft} complete={bookingComplete} onChange={setBookingDraft} onComplete={() => setBookingComplete(true)} onClose={() => { setBookingDraft(null); setBookingComplete(false); }} />}

      <style>{`
        .preview-page { min-height: 100vh; background: #eef0f3; display: flex; justify-content: center; padding: 20px; color: #1f2937; }
        .phone-shell { width: 100%; max-width: 430px; height: min(900px, calc(100vh - 40px)); background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 26px; overflow: hidden; box-shadow: 0 18px 40px rgba(31,41,55,.12); display: flex; flex-direction: column; }
        .top-bar { height: 72px; background: #fff; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; flex: 0 0 auto; }
        .brand-area { display: flex; align-items: center; gap: 10px; }
        .logo { width: 42px; height: 42px; border-radius: 50%; background: #050505; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 800; letter-spacing: -.04em; position: relative; }
        .logo::after { content: ""; width: 7px; height: 7px; border-radius: 50%; background: #9b1f1f; position: absolute; right: 9px; bottom: 8px; box-shadow: -7px 0 0 #c92d2d; }
        .designer-name { font-size: 18px; font-weight: 850; line-height: 1.05; }
        .designer-role { font-size: 13px; color: #6b7280; margin-top: 4px; font-weight: 650; }
        .logout-btn { border: 1px solid #dfe3ea; background: #fff; color: #5f6673; border-radius: 12px; padding: 10px 16px; font-size: 14px; font-weight: 750; }
        .screen-body { flex: 1 1 auto; overflow-y: auto; padding: 20px 16px 18px; }
        .page-heading-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
        .page-title { font-size: 25px; line-height: 1.1; margin: 0 0 8px; font-weight: 900; letter-spacing: -.04em; }
        .page-subtitle { color: #9aa3af; font-size: 16px; font-weight: 700; margin-bottom: 16px; }
        .page-heading-row .page-subtitle { margin-bottom: 0; }
        .status-line { display: flex; flex-wrap: wrap; gap: 14px; font-size: 13px; font-weight: 850; margin-bottom: 22px; }
        .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; }
        .progress-text { color: #1d6fd4; } .upcoming-text { color: #c96810; } .done-text { color: #258354; }
        .progress-dot { background: #2389de; } .upcoming-dot { background: #f28b13; } .done-dot { background: #22a566; }
        .list-card, .pending-card, .panel, .summary-card, .period-card, .final-card, .compact-section { background: #fff; border: 1px solid #e6e9ef; border-radius: 16px; box-shadow: 0 8px 18px rgba(31,41,55,.04); }
        .appointment-row { display: grid; grid-template-columns: 64px 1fr auto; align-items: center; gap: 10px; min-height: 96px; padding: 0 14px; border-bottom: 1px solid #edf0f4; }
        .appointment-row:last-child { border-bottom: none; }
        .row-time { font-size: 18px; font-weight: 850; color: #1f2937; }
        .row-date { display: block; color: #8b95a3; font-size: 12px; font-weight: 850; margin-bottom: 4px; white-space: nowrap; }
        .row-name { font-size: 16px; font-weight: 900; margin-bottom: 5px; }
        .row-service { color: #5f6673; font-size: 13px; font-weight: 700; line-height: 1.5; }
        .row-actions { display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
        .pill { border-radius: 9px; padding: 5px 9px; font-size: 12px; font-weight: 850; white-space: nowrap; }
        .pill.upcoming { background: #fff0dc; color: #d06a00; }
        .pill.progress { background: #e8f2ff; color: #126dc2; }
        .pill.done { background: #e8f7ef; color: #208051; }
        .small-action { min-width: 50px; border: 1px solid #2290e6; color: #1478c8; background: #fff; border-radius: 8px; padding: 6px 9px; font-weight: 850; font-size: 13px; cursor: pointer; }
        .add-booking-btn { border: none; background: #148bd8; color: #fff; border-radius: 999px; padding: 8px 12px; font-size: 12px; font-weight: 950; white-space: nowrap; cursor: pointer; box-shadow: 0 8px 16px rgba(20,139,216,.16); }
        .pending-list { display: grid; gap: 14px; }
        .pending-card { min-height: 118px; display: grid; grid-template-columns: 58px 1fr 78px; gap: 10px; align-items: center; padding: 14px; }
        .pending-card.is-done { opacity: .74; }
        .pending-actions { display: grid; gap: 9px; }
        .accept-btn, .decline-btn { border-radius: 8px; padding: 8px 0; background: #fff; font-weight: 900; font-size: 14px; cursor: pointer; }
        .accept-btn { border: 1px solid #f59f2c; color: #e67600; }
        .decline-btn { border: 1px solid #ff6b7a; color: #e43751; }
        .note-text { color: #e67600; font-weight: 850; }
        .decision-note { border-radius: 8px; padding: 8px 0; text-align: center; font-size: 13px; font-weight: 900; }
        .decision-note.accepted { background: #e8f7ef; color: #208051; }
        .decision-note.declined { background: #fff0f2; color: #d52740; }
        .segmented, .income-tabs { display: grid; background: #fff; border: 1px solid #e5e7eb; border-radius: 18px; padding: 3px; gap: 3px; margin-bottom: 18px; }
        .segmented { grid-template-columns: repeat(3, 1fr); }
        .income-tabs { grid-template-columns: repeat(4, 1fr); margin-bottom: 14px; }
        .segment, .income-segment { border: none; background: transparent; color: #4b5563; border-radius: 15px; padding: 9px 0; font-weight: 850; font-size: 14px; cursor: pointer; }
        .income-segment { font-size: 12px; padding: 8px 0; }
        .segment.active, .income-segment.active { background: #148bd8; color: #fff; }
        .calendar-header { display: flex; justify-content: space-between; align-items: center; margin: 8px 0 18px; }
        .month-title { font-size: 21px; font-weight: 900; }
        .circle-nav { width: 32px; height: 32px; border: none; border-radius: 50%; background: #eef1f5; color: #4b5563; font-weight: 900; }
        .weekday-grid, .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); }
        .weekday-grid { color: #7b8492; font-size: 12px; font-weight: 850; text-align: center; margin-bottom: 8px; }
        .day-cell { min-height: 66px; border: 1px solid #edf0f4; background: #fff; padding: 7px 5px; font-size: 13px; font-weight: 850; color: #374151; position: relative; }
        .day-cell.selected { background: #eaf7ff; outline: 1.5px solid #74c8ff; z-index: 1; }
        .day-cell.can-add { cursor: pointer; }
        .date-badge { display: inline-flex; width: 25px; height: 25px; border-radius: 50%; align-items: center; justify-content: center; }
        .selected .date-badge { background: #208bd8; color: #fff; }
        .schedule-bar { display: block; margin-top: 5px; border-radius: 5px; padding: 3px 4px; font-size: 10px; line-height: 1.15; color: #374151; }
        .cut { background: #dff1ff; } .color { background: #d7f8ef; } .perm { background: #ffe2ef; } .treatment { background: #fff0cf; }
        .legend { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 18px; color: #6b7280; font-size: 12px; font-weight: 750; }
        .legend-mark { display: inline-block; width: 12px; height: 12px; border-radius: 4px; margin-right: 5px; vertical-align: -2px; }
        .compact-section { padding: 14px; margin-bottom: 14px; }
        .compact-title { font-size: 15px; font-weight: 900; margin-bottom: 10px; }
        .selected-day-title { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
        .selected-day-date { font-size: 16px; font-weight: 950; color: #1f2937; }
        .selected-day-hint { color: #8b95a3; font-size: 12px; font-weight: 800; }
        .selected-day-add { border: none; background: #148bd8; color: #fff; border-radius: 999px; padding: 7px 11px; font-size: 12px; font-weight: 900; white-space: nowrap; cursor: pointer; box-shadow: 0 6px 14px rgba(20,139,216,.16); }
        .empty-day { padding: 10px 0 2px; color: #8b95a3; font-size: 13px; font-weight: 750; }
        .timeline-row { display: grid; grid-template-columns: 58px 1fr; gap: 10px; padding: 10px 0; border-bottom: 1px solid #edf0f4; }
        .timeline-row.can-add { cursor: pointer; }
        .timeline-row:last-child { border-bottom: none; }
        .period-grid, .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
        .period-card, .summary-card { padding: 13px; }
        .period-action-card { width: 100%; text-align: left; cursor: pointer; background: linear-gradient(135deg, #ffffff 0%, #f1f8ff 100%); font: inherit; }
        .period-action-card .period-date::after { content: " ›"; color: #148bd8; font-weight: 950; }
        .period-label, .panel-label { color: #8b95a3; font-size: 10px; font-weight: 900; letter-spacing: .08em; margin-bottom: 6px; }
        .period-date { font-weight: 900; font-size: 14px; }
        .summary-amount { color: #1478c8; font-size: 21px; font-weight: 950; margin-bottom: 8px; }
        .summary-amount.purple { color: #6847d9; }
        .summary-title { font-weight: 900; color: #1478c8; margin-bottom: 4px; }
        .summary-title.purple { color: #6847d9; }
        .summary-sub { color: #36a9ff; font-size: 12px; font-weight: 750; }
        .panel { padding: 16px; margin-bottom: 14px; }
        .breakdown-row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid #edf0f4; color: #374151; font-weight: 750; }
        .breakdown-row:last-child { border-bottom: none; color: #1478c8; font-weight: 900; }
        .negative { color: #ef244e; }
        .final-card { display: flex; justify-content: space-between; align-items: center; padding: 18px 16px; font-weight: 950; }
        .final-amount { font-size: 25px; }
        .bottom-tabs { height: 74px; background: #fff; border-top: 1px solid #e5e7eb; display: grid; grid-template-columns: repeat(4, 1fr); flex: 0 0 auto; }
        .tab-btn { border: none; background: transparent; color: #9aa3af; font-weight: 850; font-size: 12px; position: relative; padding-top: 10px; cursor: pointer; }
        .tab-btn.active { color: #148bd8; }
        .tab-btn.active::before { content: ""; position: absolute; top: 0; left: 28%; right: 28%; height: 4px; border-radius: 0 0 999px 999px; background: #148bd8; }
        .tab-icon { display: block; font-size: 23px; line-height: 1; margin-bottom: 5px; }
        .modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.42); display: flex; justify-content: center; align-items: flex-end; padding: 18px; z-index: 20; }
        .modal-panel { width: 100%; max-width: 430px; background: #fff; border-radius: 22px; padding: 18px; box-shadow: 0 18px 40px rgba(15,23,42,.25); }
        .modal-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; margin-bottom: 16px; }
        .modal-title { font-size: 21px; font-weight: 950; margin-bottom: 4px; }
        .modal-subtitle { color: #6b7280; font-weight: 750; }
        .close-btn { width: 34px; height: 34px; border-radius: 50%; border: none; background: #eef1f5; color: #4b5563; font-size: 19px; font-weight: 900; cursor: pointer; }
        .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
        .detail-card { background: #f8fafc; border: 1px solid #edf0f4; border-radius: 14px; padding: 12px; }
        .detail-label { color: #8b95a3; font-size: 11px; font-weight: 900; margin-bottom: 5px; }
        .detail-value { color: #1f2937; font-size: 14px; font-weight: 850; line-height: 1.45; }
        .modal-action-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
        .primary-modal-btn, .secondary-modal-btn { border-radius: 12px; padding: 12px 0; font-size: 14px; font-weight: 900; cursor: pointer; }
        .primary-modal-btn { border: none; background: #1478c8; color: #fff; }
        .secondary-modal-btn { border: 1px solid #dfe3ea; background: #fff; color: #4b5563; }
        .range-picker-list { display: grid; gap: 10px; }
        .range-option { width: 100%; border: 1px solid #e1e7ef; background: #fff; border-radius: 14px; padding: 12px 13px; text-align: left; cursor: pointer; color: #1f2937; }
        .range-option.selected { border-color: #148bd8; background: #eaf7ff; }
        .range-option span { display: block; font-size: 15px; font-weight: 950; margin-bottom: 4px; }
        .range-option small { color: #6b7280; font-size: 12px; font-weight: 800; }
        .checkout-line { display: grid; grid-template-columns: 1fr 92px; gap: 10px; align-items: center; padding: 10px 0; border-bottom: 1px solid #edf0f4; }
        .checkout-line:last-child { border-bottom: none; }
        .checkout-input, .checkout-select, .checkout-note { width: 100%; border: 1px solid #dfe3ea; border-radius: 10px; padding: 9px 10px; font-size: 14px; box-sizing: border-box; background: #fff; color: #1f2937; }
        .checkout-note { min-height: 70px; resize: none; margin-top: 8px; }
        .booking-field { margin-bottom: 12px; }
        .booking-label { color: #6b7280; font-size: 12px; font-weight: 900; margin-bottom: 6px; }
        .customer-search-panel { background: #f8fafc; border: 1px solid #edf0f4; border-radius: 16px; padding: 12px; margin-bottom: 14px; }
        .customer-result-list { display: grid; gap: 8px; margin-top: 9px; }
        .customer-result { width: 100%; border: 1px solid #e1e7ef; background: #fff; color: #1f2937; border-radius: 12px; padding: 10px 11px; text-align: left; cursor: pointer; }
        .customer-result.selected { border-color: #148bd8; background: #eaf7ff; }
        .customer-result span { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 4px; }
        .customer-result strong { font-size: 14px; font-weight: 950; }
        .customer-result em { color: #6b7280; font-size: 12px; font-style: normal; font-weight: 800; }
        .customer-result small { display: block; color: #8b95a3; font-size: 11px; font-weight: 800; line-height: 1.35; }
        .customer-empty { color: #8b95a3; font-size: 12px; font-weight: 800; padding: 8px 2px 0; }
        .customer-note-preview { margin-top: 10px; background: #eef9f4; color: #207153; border-radius: 10px; padding: 9px 10px; font-size: 12px; font-weight: 800; line-height: 1.45; }
        .amount-preview { background: #0f172a; color: #fff; border-radius: 16px; padding: 16px; margin-top: 12px; display: flex; justify-content: space-between; align-items: center; font-weight: 900; }
        .amount-preview strong { font-size: 24px; }
        .complete-state { text-align: center; padding: 22px 8px 8px; }
        .complete-icon { width: 54px; height: 54px; border-radius: 50%; margin: 0 auto 14px; background: #e8f7ef; color: #208051; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 950; }
        @media (max-width: 460px) { .preview-page { padding: 0; } .phone-shell { max-width: none; height: 100vh; border-radius: 0; border: none; } }
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

function TodayView({ onView, onCheckout, onAddBooking }: { onView: (row: Appointment) => void; onCheckout: (row: Appointment) => void; onAddBooking: () => void }) {
  return (
    <>
      <div className="page-heading-row">
        <div>
          <h1 className="page-title">今日</h1>
          <div className="page-subtitle">8月12日 星期三</div>
        </div>
        <button className="add-booking-btn" onClick={onAddBooking}>＋新增預約</button>
      </div>
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
              <button className="small-action" onClick={() => row.action === "結帳" ? onCheckout(row) : onView(row)}>{row.action}</button>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}

function PendingView({ decisions, onOpen }: { decisions: Record<string, PendingDecision>; onOpen: (row: (typeof pendingRows)[number]) => void }) {
  return (
    <>
      <h1 className="page-title">待確認</h1>
      <div className="page-subtitle">目前有 2 筆預約待回覆</div>
      <section className="pending-list">
        {pendingRows.map((row) => {
          const decision = decisions[row.name] || "pending";
          return (
            <div className={`pending-card ${decision !== "pending" ? "is-done" : ""}`} key={`${row.time}-${row.name}`}>
              <div className="row-time">
                <span className="row-date">{row.date}</span>
                {row.time}
              </div>
              <div>
                <div className="row-name">{row.name}</div>
                <div className="row-service">{row.service}</div>
                <div className={`row-service ${row.detail.includes("翻譯") ? "note-text" : ""}`}>{row.detail}</div>
              </div>
              {decision === "pending" ? (
                <div className="pending-actions">
                  <button className="accept-btn" onClick={() => onOpen(row)}>確認</button>
                  <button className="decline-btn" onClick={() => onOpen(row)}>查看</button>
                </div>
              ) : (
                <div className={`decision-note ${decision}`}>{decision === "accepted" ? "已接受" : "已婉拒"}</div>
              )}
            </div>
          );
        })}
      </section>
    </>
  );
}

function CalendarView({ mode, selectedDate, onModeChange, onSelectDate, onAddBooking }: { mode: ScheduleMode; selectedDate: string; onModeChange: (mode: ScheduleMode) => void; onSelectDate: (date: string) => void; onAddBooking: (date: string, time?: string) => void }) {
  return (
    <>
      <div className="page-heading-row">
        <div>
          <h1 className="page-title">排程</h1>
          <div className="page-subtitle">{formatScheduleDateLabel(selectedDate)}</div>
        </div>
        <button className="add-booking-btn" onClick={() => onAddBooking(selectedDate, "10:00")}>＋新增預約</button>
      </div>
      <div className="segmented">
        {(["3日", "週", "月"] as ScheduleMode[]).map((item) => (
          <button className={`segment ${mode === item ? "active" : ""}`} key={item} onClick={() => onModeChange(item)}>{item}</button>
        ))}
      </div>
      {mode === "月" ? (
        <MonthSchedule selectedDate={selectedDate} onSelectDate={onSelectDate} onAddBooking={onAddBooking} />
      ) : (
        <CompactSchedule mode={mode} selectedDate={selectedDate} onSelectDate={onSelectDate} onAddBooking={onAddBooking} />
      )}
    </>
  );
}

function MonthSchedule({ selectedDate, onSelectDate, onAddBooking }: { selectedDate: string; onSelectDate: (date: string) => void; onAddBooking: (date: string, time?: string) => void }) {
  const selectedDay = Number(selectedDate.split("-")[2]);
  const selectedItems = scheduleItems[selectedDay] || [];

  return (
    <>
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
          const fullDate = formatScheduleDate(date);
          return (
            <div className={`day-cell can-add ${date === selectedDay ? "selected" : ""}`} key={date} onClick={() => onSelectDate(fullDate)}>
              <span className="date-badge">{date}</span>
              {items.map((item) => <span className={`schedule-bar ${item.tone}`} key={item.text}>{item.text}</span>)}
            </div>
          );
        })}
      </div>
      <Legend />
      <SelectedDayPanel selectedDate={selectedDate} items={selectedItems} onAddBooking={onAddBooking} />
    </>
  );
}

function CompactSchedule({ mode, selectedDate, onSelectDate, onAddBooking }: { mode: Exclude<ScheduleMode, "月">; selectedDate: string; onSelectDate: (date: string) => void; onAddBooking: (date: string, time?: string) => void }) {
  const rows = mode === "3日"
    ? [
      { day: "8/12（三）", date: "2026-08-12", items: ["10:30 Lynn 質感燙＋剪髮", "13:00 Mira 染髮（M）"] },
      { day: "8/13（四）", date: "2026-08-13", items: ["11:00 Peggy 剪髮", "16:30 Alisa 設計染"] },
      { day: "8/14（五）", date: "2026-08-14", items: ["15:30 Joey 護髮"] },
    ]
    : [
      { day: "週三", date: "2026-08-12", items: ["10:30 Lynn", "13:00 Mira"] },
      { day: "週四", date: "2026-08-13", items: ["11:00 Peggy", "16:30 Alisa"] },
      { day: "週五", date: "2026-08-14", items: ["15:30 Joey"] },
      { day: "週六", date: "2026-08-15", items: ["休假"] },
    ];

  return (
    <>
      <div className="calendar-header">
        <button className="circle-nav">‹</button>
        <div className="month-title">{mode}排程</div>
        <button className="circle-nav">›</button>
      </div>
      <section className="compact-section">
        <div className="compact-title">快速瀏覽</div>
        {rows.map((row) => (
          <div className="timeline-row can-add" key={row.day} onClick={() => onSelectDate(row.date)}>
            <div className="row-time">{row.day}</div>
            <div className="row-service">{row.items.join("、")}</div>
          </div>
        ))}
      </section>
      <Legend />
      <section className="compact-section">
        <div className="selected-day-title">
          <div className="selected-day-date">{formatScheduleDateLabel(selectedDate)}</div>
        </div>
        <div className="selected-day-hint">先選日期，再新增</div>
      </section>
    </>
  );
}

function SelectedDayPanel({ selectedDate, items, onAddBooking }: { selectedDate: string; items: { text: string; tone: string }[]; onAddBooking: (date: string, time?: string) => void }) {
  return (
    <section className="compact-section">
      <div className="selected-day-title">
        <div className="selected-day-date">{formatScheduleDateLabel(selectedDate)}</div>
      </div>
      {items.length > 0 ? (
        items.map((item) => {
          const [time, ...serviceParts] = item.text.split(" ");
          return (
            <div className="timeline-row" key={item.text}>
              <div className="row-time">{time}</div>
              <div className="row-service">{serviceParts.join(" ")}</div>
            </div>
          );
        })
      ) : (
        <div className="empty-day">此日目前沒有預約。</div>
      )}
    </section>
  );
}

function Legend() {
  return (
    <div className="legend">
      <span><i className="legend-mark cut" />剪髮</span>
      <span><i className="legend-mark color" />染髮</span>
      <span><i className="legend-mark perm" />燙髮</span>
      <span><i className="legend-mark treatment" />護髮</span>
    </div>
  );
}

function EarningsView() {
  const [activeRange, setActiveRange] = useState<EarningsRange>("本月");
  const [showRangePicker, setShowRangePicker] = useState(false);
  const currentRange = earningsRanges[activeRange];
  const storeAmount = currentRange.service - currentRange.discount;

  return (
    <>
      <h1 className="page-title">我的收入</h1>
      <div className="period-grid">
        <div className="period-card"><div className="period-label">{activeRange === "本月" ? "本月區間" : "查詢區間"}</div><div className="period-date">{currentRange.period}</div></div>
        <button className="period-card period-action-card" onClick={() => setShowRangePicker(true)}>
          <div className="period-label">自訂查詢區間</div>
          <div className="period-date">選擇月份或日期</div>
        </button>
      </div>
      <div className="income-tabs">
        {(["今日", "本月", "指定月份", "日期區間"] as EarningsRange[]).map((tab) => (
          <button className={`income-segment ${activeRange === tab ? "active" : ""}`} key={tab} onClick={() => setActiveRange(tab)}>{tab}</button>
        ))}
      </div>
      <div className="summary-grid">
        <div className="summary-card"><div className="summary-amount">NT$ {currentRange.service.toLocaleString()}</div><div className="summary-title">服務收入</div><div className="summary-sub">{currentRange.count} 筆服務 · 折扣前</div></div>
        <div className="summary-card"><div className="summary-amount purple">NT$ {storeAmount.toLocaleString()}</div><div className="summary-title purple">店收金額</div><div className="summary-sub">已扣除折扣</div></div>
      </div>
      <section className="panel">
        <div className="panel-label">{currentRange.label}</div>
        <div className="breakdown-row"><span>原價（折扣前）</span><span>NT${currentRange.service.toLocaleString()}</span></div>
        <div className="breakdown-row"><span>折扣金額</span><span className="negative">-NT${currentRange.discount.toLocaleString()}</span></div>
        <div className="breakdown-row"><span>店收金額</span><span>NT${storeAmount.toLocaleString()}</span></div>
        <div className="breakdown-row"><span>{activeRange}可查看金額</span><span>NT${storeAmount.toLocaleString()}</span></div>
      </section>
      <div className="final-card"><span>{activeRange}合計</span><span className="final-amount">NT${storeAmount.toLocaleString()}</span></div>
      {showRangePicker && (
        <RangePickerModal
          activeRange={activeRange}
          onSelect={(range) => {
            setActiveRange(range);
            setShowRangePicker(false);
          }}
          onClose={() => setShowRangePicker(false)}
        />
      )}
    </>
  );
}

function RangePickerModal({ activeRange, onSelect, onClose }: { activeRange: EarningsRange; onSelect: (range: EarningsRange) => void; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">選擇收入區間</div>
            <div className="modal-subtitle">可用月份或日期區間快速查看</div>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="range-picker-list">
          {(["今日", "本月", "指定月份", "日期區間"] as EarningsRange[]).map((range) => (
            <button className={`range-option ${activeRange === range ? "selected" : ""}`} key={range} onClick={() => onSelect(range)}>
              <span>{range}</span>
              <small>{earningsRanges[range].period}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AppointmentModal({ row, onClose }: { row: Appointment; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{row.name}</div>
            <div className="modal-subtitle">{row.time} · {row.status}</div>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="detail-grid">
          <DetailCard label="電話" value={row.phone} />
          <DetailCard label="服務項目" value={row.service} />
          <DetailCard label="備註" value={row.note} />
          <DetailCard label="參考圖片" value={row.image} />
        </div>
        <div className="modal-action-row">
          <button className="secondary-modal-btn">聯絡客人</button>
          <button className="primary-modal-btn" onClick={onClose}>關閉</button>
        </div>
      </div>
    </div>
  );
}

function PendingConfirmModal({ row, decision, onDecide, onClose }: { row: (typeof pendingRows)[number]; decision: PendingDecision; onDecide: (name: string, decision: PendingDecision) => void; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">預約確認</div>
            <div className="modal-subtitle">{row.date} {row.time} · {row.name}</div>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="detail-grid">
          <DetailCard label="電話" value={row.phone} />
          <DetailCard label="服務項目" value={row.service} />
          <DetailCard label="顧客備註" value={row.detail} />
          <DetailCard label="翻譯中文" value={row.detail.includes("Please") ? "請讓顏色呈現自然棕色。" : "不需翻譯"} />
        </div>
        {decision === "pending" ? (
          <div className="modal-action-row">
            <button className="secondary-modal-btn" onClick={() => { onDecide(row.name, "declined"); onClose(); }}>婉拒預約</button>
            <button className="primary-modal-btn" onClick={() => { onDecide(row.name, "accepted"); onClose(); }}>接受預約</button>
          </div>
        ) : (
          <div className={`decision-note ${decision}`}>{decision === "accepted" ? "此預約已接受" : "此預約已婉拒"}</div>
        )}
      </div>
    </div>
  );
}

function CheckoutModal({ row, complete, onComplete, onClose }: { row: Appointment; complete: boolean; onComplete: () => void; onClose: () => void }) {
  const [draft, setDraft] = useState<CheckoutDraft>({
    serviceAmount: 3000,
    serviceDiscount: 0,
    productAmount: 1180,
    productDiscount: 0,
    paymentMethod: "現金",
    note: "",
  });
  const total = Math.max(0, draft.serviceAmount - draft.serviceDiscount) + Math.max(0, draft.productAmount - draft.productDiscount);

  if (complete) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
          <div className="complete-state">
            <div className="complete-icon">✓</div>
            <div className="modal-title">結帳完成</div>
            <div className="modal-subtitle">{row.name} 的服務已完成，此為暫存預覽，不會寫入正式資料。</div>
          </div>
          <div className="amount-preview"><span>本次總額</span><strong>NT${total.toLocaleString()}</strong></div>
          <div className="modal-action-row">
            <button className="secondary-modal-btn" onClick={onClose}>返回今日</button>
            <button className="primary-modal-btn" onClick={onClose}>完成</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">結帳</div>
            <div className="modal-subtitle">{row.name} · {row.service}</div>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <section className="panel">
          <div className="panel-label">服務項目</div>
          <CheckoutNumber label={row.service} value={draft.serviceAmount} onChange={(value) => setDraft({ ...draft, serviceAmount: value })} />
          <CheckoutNumber label="服務折扣" value={draft.serviceDiscount} onChange={(value) => setDraft({ ...draft, serviceDiscount: value })} />
        </section>
        <section className="panel">
          <div className="panel-label">客人購買商品</div>
          <CheckoutNumber label="生命果油 GS 120ml" value={draft.productAmount} onChange={(value) => setDraft({ ...draft, productAmount: value })} />
          <CheckoutNumber label="商品折扣" value={draft.productDiscount} onChange={(value) => setDraft({ ...draft, productDiscount: value })} />
        </section>
        <section className="panel">
          <div className="panel-label">付款與備註</div>
          <select className="checkout-select" value={draft.paymentMethod} onChange={(event) => setDraft({ ...draft, paymentMethod: event.target.value })}>
            {["現金", "轉帳", "LINE Pay", "刷卡", "其他"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <textarea className="checkout-note" value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="折扣原因、顧客狀況、服務紀錄..." />
        </section>
        <div className="amount-preview"><span>客人應收總額</span><strong>NT${total.toLocaleString()}</strong></div>
        <div className="modal-action-row">
          <button className="secondary-modal-btn" onClick={onClose}>稍後處理</button>
          <button className="primary-modal-btn" onClick={onComplete}>建立暫存交易</button>
        </div>
      </div>
    </div>
  );
}

function CheckoutNumber({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="checkout-line">
      <div className="row-service">{label}</div>
      <input className="checkout-input" type="number" value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} />
    </div>
  );
}

function AddBookingModal({ draft, complete, onChange, onComplete, onClose }: { draft: BookingDraft; complete: boolean; onChange: (draft: BookingDraft) => void; onComplete: () => void; onClose: () => void }) {
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const searchText = customerSearch.trim().toLowerCase();
  const matchedCustomers = searchText
    ? customerRecords.filter((customer) => `${customer.name} ${customer.phone}`.toLowerCase().includes(searchText)).slice(0, 3)
    : customerRecords.slice(0, 2);
  const selectedCustomer = customerRecords.find((customer) => customer.id === selectedCustomerId);

  function applyCustomer(customer: CustomerRecord) {
    setSelectedCustomerId(customer.id);
    setCustomerSearch(`${customer.name} / ${customer.phone}`);
    onChange({
      ...draft,
      name: customer.name,
      phone: customer.phone,
      service: customer.lastService,
      note: customer.note,
    });
  }

  if (complete) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
          <div className="complete-state">
            <div className="complete-icon">✓</div>
            <div className="modal-title">暫存預約已建立</div>
            <div className="modal-subtitle">這是 V2 預覽流程，不會寫入正式預約資料。</div>
          </div>
          <div className="detail-grid">
            <DetailCard label="客人" value={draft.name || "未填姓名"} />
            <DetailCard label="日期時間" value={`${draft.date} ${draft.time}`} />
            <DetailCard label="電話" value={draft.phone || "未填電話"} />
            <DetailCard label="服務" value={draft.service || "未選服務"} />
            <DetailCard label="顧客資料" value={selectedCustomer ? "已帶入既有顧客紀錄" : "新顧客，完成後自動建立資料"} />
            <DetailCard label="預約備註" value={draft.note || "未填備註"} />
          </div>
          <div className="modal-action-row">
            <button className="secondary-modal-btn" onClick={onClose}>返回</button>
            <button className="primary-modal-btn" onClick={onClose}>完成</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">幫客人預約</div>
            <div className="modal-subtitle">設計師本人模式：預設預約給 Cherry</div>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <section className="customer-search-panel">
          <div className="booking-label">搜尋顧客資料</div>
          <input
            className="checkout-input"
            value={customerSearch}
            onChange={(event) => {
              setCustomerSearch(event.target.value);
              setSelectedCustomerId(null);
            }}
            placeholder="輸入姓名或電話，快速帶入顧客資訊"
          />
          <div className="customer-result-list">
            {matchedCustomers.length > 0 ? matchedCustomers.map((customer) => (
              <button
                className={`customer-result ${selectedCustomerId === customer.id ? "selected" : ""}`}
                key={customer.id}
                onClick={() => applyCustomer(customer)}
              >
                <span>
                  <strong>{customer.name}</strong>
                  <em>{customer.phone}</em>
                </span>
                <small>{customer.lastVisit} · {customer.lastService}</small>
              </button>
            )) : (
              <div className="customer-empty">找不到顧客，完成預約後會建立新顧客資料。</div>
            )}
          </div>
          {selectedCustomer && (
            <div className="customer-note-preview">
              <strong>已帶入：</strong>{selectedCustomer.note}
            </div>
          )}
        </section>
        <div className="detail-grid">
          <BookingInput label="日期" value={draft.date} onChange={(value) => onChange({ ...draft, date: value })} />
          <BookingInput label="時間" value={draft.time} onChange={(value) => onChange({ ...draft, time: value })} />
          <BookingInput label="客人姓名" value={draft.name} onChange={(value) => onChange({ ...draft, name: value })} />
          <BookingInput label="電話" value={draft.phone} onChange={(value) => onChange({ ...draft, phone: value })} />
        </div>
        <div className="booking-field">
          <div className="booking-label">服務項目</div>
          <select className="checkout-select" value={draft.service} onChange={(event) => onChange({ ...draft, service: event.target.value })}>
            {["剪髮（含髮浴）", "質感燙＋剪髮", "設計染（M）", "HHN深層結構護髮"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <div className="booking-field">
          <div className="booking-label">備註</div>
          <textarea className="checkout-note" value={draft.note} onChange={(event) => onChange({ ...draft, note: event.target.value })} placeholder="特殊需求、現場安排、顧客偏好..." />
        </div>
        <div className="modal-action-row">
          <button className="secondary-modal-btn" onClick={onClose}>取消</button>
          <button className="primary-modal-btn" onClick={onComplete}>建立暫存預約</button>
        </div>
      </div>
    </div>
  );
}

function BookingInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="booking-field">
      <div className="booking-label">{label}</div>
      <input className="checkout-input" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function createBookingDraft(date = "2026-08-12", time = "10:00"): BookingDraft {
  return {
    date,
    time,
    name: "",
    phone: "",
    service: "剪髮（含髮浴）",
    note: "",
  };
}

function formatScheduleDate(day: number) {
  return `2026-08-${String(day).padStart(2, "0")}`;
}

function formatScheduleDateLabel(date: string) {
  const parsedDate = new Date(`${date}T00:00:00+08:00`);
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][parsedDate.getDay()];
  return `${parsedDate.getMonth() + 1}/${parsedDate.getDate()}（${weekday}）`;
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-card">
      <div className="detail-label">{label}</div>
      <div className="detail-value">{value}</div>
    </div>
  );
}

function BottomTabs({ activeTab, onChange }: { activeTab: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <nav className="bottom-tabs">
      {tabs.map((tab) => (
        <button className={`tab-btn ${activeTab === tab.key ? "active" : ""}`} key={tab.key} onClick={() => onChange(tab.key)}>
          <span className="tab-icon">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
