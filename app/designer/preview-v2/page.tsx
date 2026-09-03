"use client";

import { useState } from "react";

type TabKey = "today" | "pending" | "calendar" | "earnings";
type ScheduleMode = "3日" | "週" | "月";
type PendingDecision = "pending" | "accepted" | "declined";
type EarningsRange = "今日" | "本月" | "指定日期或區間";
type SettingsPanel = "profile" | "roster";
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
type ScheduleItem = { text: string; tone: string };
type LeaveItem = { text: string; tone: "day-off" | "blocked" };
type LeaveDraft = {
  date: string;
  type: "整天休假" | "指定時段不接客";
  startTime: string;
  endTime: string;
  note: string;
};

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: "today", label: "今日", icon: "□" },
  { key: "pending", label: "待確認", icon: "◷" },
  { key: "calendar", label: "排程", icon: "▣" },
  { key: "earnings", label: "收入", icon: "$" },
];

const initialTodayRows: Appointment[] = [
  { time: "10:30", name: "Lynn", phone: "0920-262-570", service: "質感燙＋剪髮", status: "即將到來", tone: "upcoming", action: "查看", note: "想保留長度，髮尾整理即可。", image: "尚未上傳參考圖片" },
  { time: "13:00", name: "Mira", phone: "0912-345-678", service: "染髮（M）", status: "服務中", tone: "progress", action: "結帳", note: "偏冷棕，不要太亮。", image: "已上傳 1 張參考圖片" },
  { time: "15:30", name: "Joey", phone: "0988-111-222", service: "護髮", status: "已完成", tone: "done", action: "查看", note: "頭皮較敏感。", image: "尚未上傳參考圖片" },
];

const pendingRows = [
  { date: "8/13（四）", time: "11:00", name: "Peggy", phone: "0920-xxx-xxx", service: "剪髮（含髮浴）", detail: "想剪短一點，保留瀏海。" },
  { date: "8/14（五）", time: "16:30", name: "Alisa", phone: "0918-xxx-xxx", service: "設計染（L）", detail: "Please make the color natural brown." },
];

const initialScheduleItems: Record<number, ScheduleItem[]> = {
  5: [{ text: "10:00 剪髮", tone: "cut" }],
  8: [{ text: "13:00 染髮", tone: "color" }],
  10: [{ text: "15:30 護髮", tone: "treatment" }],
  12: [
    { text: "10:30 質感燙＋剪髮", tone: "perm" },
    { text: "13:00 染髮", tone: "color" },
    { text: "15:30 護髮", tone: "treatment" },
  ],
  20: [{ text: "11:00 燙髮", tone: "perm" }],
};

const initialLeaveItems: Record<number, LeaveItem[]> = {
  15: [{ text: "整天休假", tone: "day-off" }],
  19: [{ text: "13:00-17:00 不接客", tone: "blocked" }],
  24: [{ text: "上午不接客", tone: "blocked" }],
};

const customerRecords: CustomerRecord[] = [
  { id: "lynn", name: "Lynn", phone: "0920-262-570", lastService: "質感燙＋剪髮", note: "喜歡自然蓬鬆，瀏海不要剪太短。", lastVisit: "上次 7/10" },
  { id: "mira", name: "Mira", phone: "0912-345-678", lastService: "染髮（M）", note: "偏冷棕，不要太亮；頭皮較敏感。", lastVisit: "上次 7/24" },
  { id: "joey", name: "Joey", phone: "0988-111-222", lastService: "HHN深層結構護髮", note: "髮尾乾，護髮停留時間可拉長。", lastVisit: "上次 8/02" },
];

const earningsRanges: Record<EarningsRange, { period: string; service: number; product: number; discount: number; salary: number; count: number; label: string }> = {
  今日: { period: "8月12日", service: 4800, product: 1180, discount: 300, salary: 4500, count: 3, label: "今日收入" },
  本月: { period: "8月1日－8月31日", service: 38600, product: 7200, discount: 2100, salary: 36500, count: 12, label: "本月收入" },
  指定日期或區間: { period: "8月10日－8月15日", service: 16800, product: 2360, discount: 900, salary: 15120, count: 6, label: "指定日期或區間收入" },
};

export default function DesignerPreviewV2Page() {
  const [activeTab, setActiveTab] = useState<TabKey>("today");
  const [showSettings, setShowSettings] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [checkoutAppointment, setCheckoutAppointment] = useState<Appointment | null>(null);
  const [checkoutComplete, setCheckoutComplete] = useState(false);
  const [pendingDecisions, setPendingDecisions] = useState<Record<string, PendingDecision>>({});
  const [selectedPending, setSelectedPending] = useState<(typeof pendingRows)[number] | null>(null);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("月");
  const [selectedScheduleDate, setSelectedScheduleDate] = useState("2026-08-12");
  const [bookingDraft, setBookingDraft] = useState<BookingDraft | null>(null);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [demoTodayRows, setDemoTodayRows] = useState<Appointment[]>(initialTodayRows);
  const [demoScheduleItems, setDemoScheduleItems] = useState<Record<number, ScheduleItem[]>>(initialScheduleItems);
  const [demoLeaveItems, setDemoLeaveItems] = useState<Record<number, LeaveItem[]>>(initialLeaveItems);

  function setDecision(name: string, decision: PendingDecision) {
    setPendingDecisions((prev) => ({ ...prev, [name]: decision }));
  }

  function completeDemoBooking() {
    if (!bookingDraft) return;

    const serviceLabel = bookingDraft.service.replace(/[（）()ＭMLL]/g, "").trim() || "預約";
    const day = Number(bookingDraft.date.split("-")[2]);
    const scheduleItem = { text: `${bookingDraft.time} ${serviceLabel}`, tone: getServiceTone(bookingDraft.service) };

    setDemoScheduleItems((prev) => ({
      ...prev,
      [day]: [...(prev[day] || []), scheduleItem].sort((a, b) => a.text.localeCompare(b.text)),
    }));

    if (bookingDraft.date === "2026-08-12") {
      setDemoTodayRows((prev) => [
        ...prev,
        {
          time: bookingDraft.time,
          name: bookingDraft.name || "新顧客",
          phone: bookingDraft.phone || "未填電話",
          service: bookingDraft.service,
          status: "即將到來",
          tone: "upcoming",
          action: "查看",
          note: bookingDraft.note || "未填備註",
          image: "尚未上傳參考圖片",
        },
      ].sort((a, b) => a.time.localeCompare(b.time)));
    }

    setBookingComplete(true);
  }

  function addDemoLeave(day: number, item: LeaveItem) {
    setDemoLeaveItems((prev) => ({
      ...prev,
      [day]: [...(prev[day] || []), item],
    }));
  }

  const pendingCount = pendingRows.filter((row) => (pendingDecisions[row.name] || "pending") === "pending").length;

  return (
    <main className="preview-page">
      <section className="phone-shell">
        <Header onOpenSettings={() => setShowSettings(true)} />
        <div className="screen-body">
          {showSettings ? (
            <SettingsView leaveItems={demoLeaveItems} onAddLeave={addDemoLeave} onBack={() => setShowSettings(false)} />
          ) : (
            <>
              {activeTab === "today" && <TodayView rows={demoTodayRows} onView={setSelectedAppointment} onCheckout={setCheckoutAppointment} onAddBooking={() => { setBookingComplete(false); setBookingDraft(createBookingDraft()); }} />}
              {activeTab === "pending" && <PendingView decisions={pendingDecisions} pendingCount={pendingCount} onOpen={setSelectedPending} />}
              {activeTab === "calendar" && <CalendarView mode={scheduleMode} selectedDate={selectedScheduleDate} scheduleItems={demoScheduleItems} onModeChange={setScheduleMode} onSelectDate={setSelectedScheduleDate} onAddBooking={(date, time) => { setBookingComplete(false); setBookingDraft(createBookingDraft(date, time)); }} />}
              {activeTab === "earnings" && <EarningsView />}
            </>
          )}
        </div>
        <BottomTabs activeTab={activeTab} pendingCount={pendingCount} onChange={(tab) => { setShowSettings(false); setActiveTab(tab); }} />
      </section>
      {selectedAppointment && <AppointmentModal row={selectedAppointment} onClose={() => setSelectedAppointment(null)} />}
      {selectedPending && <PendingConfirmModal row={selectedPending} decision={pendingDecisions[selectedPending.name] || "pending"} onDecide={setDecision} onClose={() => setSelectedPending(null)} />}
      {checkoutAppointment && <CheckoutModal row={checkoutAppointment} complete={checkoutComplete} onComplete={() => setCheckoutComplete(true)} onClose={() => { setCheckoutAppointment(null); setCheckoutComplete(false); }} />}
      {bookingDraft && <AddBookingModal draft={bookingDraft} complete={bookingComplete} onChange={setBookingDraft} onComplete={completeDemoBooking} onClose={() => { setBookingDraft(null); setBookingComplete(false); }} />}

      <style>{`
        .preview-page { min-height: 100vh; background: #eef0f3; display: flex; justify-content: center; padding: 20px; color: #1f2937; }
        .phone-shell { width: 100%; max-width: 430px; height: min(900px, calc(100vh - 40px)); background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 26px; overflow: hidden; box-shadow: 0 18px 40px rgba(31,41,55,.12); display: flex; flex-direction: column; }
        .top-bar { height: 72px; background: #fff; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; flex: 0 0 auto; }
        .brand-area { display: flex; align-items: center; gap: 10px; border: none; background: transparent; padding: 0; color: inherit; text-align: left; cursor: pointer; }
        .brand-area:focus-visible { outline: 2px solid #148bd8; outline-offset: 4px; border-radius: 14px; }
        .logo { width: 42px; height: 42px; border-radius: 50%; background: #050505; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 800; letter-spacing: -.04em; position: relative; }
        .logo::after { content: ""; width: 7px; height: 7px; border-radius: 50%; background: #9b1f1f; position: absolute; right: 9px; bottom: 8px; box-shadow: -7px 0 0 #c92d2d; }
        .designer-identity { display: flex; flex-direction: column; }
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
        .income-tabs { grid-template-columns: repeat(3, 1fr); margin-bottom: 14px; }
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
        .income-detail-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 4px; }
        .detail-link-btn { border: 1px solid #148bd8; background: #fff; color: #1478c8; border-radius: 999px; padding: 6px 10px; font-size: 12px; font-weight: 950; white-space: nowrap; cursor: pointer; }
        .income-detail-list { display: grid; gap: 14px; }
        .income-detail-section { border: 1px solid #edf0f4; border-radius: 14px; background: #fff; overflow: hidden; }
        .income-detail-title { padding: 10px 12px; background: #f8fafc; color: #1f2937; font-size: 14px; font-weight: 950; }
        .income-detail-row { display: grid; grid-template-columns: 58px 1fr auto; gap: 8px; align-items: center; padding: 10px 12px; border-top: 1px solid #edf0f4; color: #374151; font-size: 12px; font-weight: 800; }
        .income-detail-row strong { color: #1f2937; font-size: 13px; }
        .income-detail-row span { color: #6b7280; line-height: 1.35; }
        .income-detail-row em { color: #1478c8; font-style: normal; font-weight: 950; white-space: nowrap; }
        .breakdown-row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid #edf0f4; color: #374151; font-weight: 750; }
        .breakdown-row:last-child { border-bottom: none; color: #1478c8; font-weight: 900; }
        .negative { color: #ef244e; }
        .final-card { display: flex; justify-content: space-between; align-items: center; padding: 18px 16px; font-weight: 950; }
        .final-amount { font-size: 25px; }
        .settings-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
        .back-text-btn { border: 1px solid #dfe3ea; background: #fff; color: #4b5563; border-radius: 999px; padding: 8px 12px; font-size: 12px; font-weight: 900; cursor: pointer; }
        .settings-menu { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
        .settings-card { border: 1px solid #e1e7ef; background: #fff; border-radius: 16px; padding: 13px; text-align: left; color: #1f2937; cursor: pointer; box-shadow: 0 8px 18px rgba(31,41,55,.04); }
        .settings-card.active { border-color: #148bd8; background: #eaf7ff; }
        .settings-card-title { font-size: 15px; font-weight: 950; margin-bottom: 6px; }
        .settings-card-desc { color: #6b7280; font-size: 12px; font-weight: 750; line-height: 1.45; }
        .profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
        .profile-note { color: #8b95a3; font-size: 12px; font-weight: 750; line-height: 1.55; margin-bottom: 14px; }
        .full-width-btn { width: 100%; border: none; background: #148bd8; color: #fff; border-radius: 14px; padding: 13px 0; font-size: 14px; font-weight: 950; cursor: pointer; }
        .roster-calendar { display: grid; grid-template-columns: repeat(7, 1fr); border: 1px solid #edf0f4; border-radius: 14px; overflow: hidden; margin-bottom: 14px; }
        .roster-day { min-height: 58px; border: none; border-right: 1px solid #edf0f4; border-bottom: 1px solid #edf0f4; background: #fff; padding: 6px 4px; font-size: 12px; font-weight: 850; color: #374151; text-align: left; cursor: pointer; font-family: inherit; }
        .roster-day:focus-visible { outline: 2px solid #148bd8; outline-offset: -2px; }
        .roster-day:nth-child(7n) { border-right: none; }
        .roster-day.has-leave { background: #fff8ee; }
        .roster-day.has-blocked { background: #f1f8ff; }
        .leave-chip { display: block; margin-top: 5px; border-radius: 6px; padding: 3px 4px; font-size: 9px; line-height: 1.2; color: #374151; }
        .leave-chip.day-off { background: #ffe6d5; color: #b45309; }
        .leave-chip.blocked { background: #dff1ff; color: #126dc2; }
        .leave-list { display: grid; gap: 8px; margin-bottom: 14px; }
        .leave-row { display: flex; justify-content: space-between; gap: 10px; border: 1px solid #edf0f4; background: #fff; border-radius: 12px; padding: 10px 11px; font-size: 13px; font-weight: 850; }
        .leave-row span:last-child { color: #6b7280; text-align: right; }
        .leave-form { border: 1px solid #e1e7ef; background: #f8fafc; border-radius: 16px; padding: 12px; }
        .leave-type-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .leave-type-btn { border: 1px solid #dfe3ea; background: #fff; color: #4b5563; border-radius: 12px; padding: 10px 8px; font-size: 12px; font-weight: 900; cursor: pointer; }
        .leave-type-btn.active { border-color: #148bd8; background: #eaf7ff; color: #1478c8; }
        .bottom-tabs { height: 74px; background: #fff; border-top: 1px solid #e5e7eb; display: grid; grid-template-columns: repeat(4, 1fr); flex: 0 0 auto; }
        .tab-btn { border: none; background: transparent; color: #9aa3af; font-weight: 850; font-size: 13px; position: relative; padding-top: 9px; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
        .tab-btn.active { color: #148bd8; }
        .tab-btn.active::before { content: ""; position: absolute; top: 0; left: 28%; right: 28%; height: 4px; border-radius: 0 0 999px 999px; background: #148bd8; }
        .tab-icon { width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; font-size: 18px; line-height: 1; font-weight: 850; }
        .tab-icon-wrap { position: relative; display: inline-flex; }
        .tab-label-wrap { display: inline-flex; align-items: center; justify-content: center; gap: 4px; line-height: 1; }
        .tab-label-badge { min-width: 16px; height: 16px; border-radius: 999px; background: #ef244e; color: #fff; display: inline-flex; align-items: center; justify-content: center; padding: 0 4px; font-size: 10px; line-height: 1; font-weight: 950; box-sizing: border-box; }
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

function Header({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <header className="top-bar">
      <button className="brand-area" onClick={onOpenSettings} aria-label="開啟個人設定">
        <div className="logo">BC</div>
        <span className="designer-identity">
          <span className="designer-name">Cherry</span>
          <span className="designer-role">設計師</span>
        </span>
      </button>
      <button className="logout-btn">登出</button>
    </header>
  );
}

function SettingsView({ leaveItems, onAddLeave, onBack }: { leaveItems: Record<number, LeaveItem[]>; onAddLeave: (day: number, item: LeaveItem) => void; onBack: () => void }) {
  const [activePanel, setActivePanel] = useState<SettingsPanel>("profile");

  return (
    <>
      <div className="settings-heading">
        <div>
          <h1 className="page-title">設定</h1>
          <div className="page-subtitle">個人資料與排班管理</div>
        </div>
        <button className="back-text-btn" onClick={onBack}>返回</button>
      </div>
      <div className="settings-menu">
        <button className={`settings-card ${activePanel === "profile" ? "active" : ""}`} onClick={() => setActivePanel("profile")}>
          <div className="settings-card-title">個人資料</div>
          <div className="settings-card-desc">查看與編輯個人資訊</div>
        </button>
        <button className={`settings-card ${activePanel === "roster" ? "active" : ""}`} onClick={() => setActivePanel("roster")}>
          <div className="settings-card-title">排班表</div>
          <div className="settings-card-desc">查看已安排休假</div>
        </button>
      </div>
      {activePanel === "profile" ? <ProfileSettingsPanel /> : <RosterSettingsPanel leaveItems={leaveItems} onAddLeave={onAddLeave} />}
    </>
  );
}

function ProfileSettingsPanel() {
  return (
    <section className="panel">
      <div className="panel-label">個人資料</div>
      <div className="profile-grid">
        <DetailCard label="顯示名稱" value="Cherry" />
        <DetailCard label="職稱" value="設計師" />
        <DetailCard label="電話" value="0912-345-678" />
        <DetailCard label="專長" value="剪髮、染髮、燙髮、護髮" />
      </div>
      <div className="profile-note">這裡之後可以放設計師自己的簡介、作品集連結、可預約服務與通知設定。此頁目前是 V2 示意，不會寫入正式資料。</div>
      <button className="full-width-btn">編輯個人資訊</button>
    </section>
  );
}

function RosterSettingsPanel({ leaveItems, onAddLeave }: { leaveItems: Record<number, LeaveItem[]>; onAddLeave: (day: number, item: LeaveItem) => void }) {
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [draft, setDraft] = useState<LeaveDraft>({
    date: "2026-08-19",
    type: "整天休假",
    startTime: "13:00",
    endTime: "17:00",
    note: "",
  });
  const leaveRows = Object.entries(leaveItems).flatMap(([day, items]) =>
    items.map((item) => ({ day: Number(day), item }))
  ).sort((a, b) => a.day - b.day);

  function submitLeave() {
    const day = Number(draft.date.split("-")[2]);
    const isFullDay = draft.type === "整天休假";
    const text = isFullDay ? "整天休假" : `${draft.startTime}-${draft.endTime} 不接客`;
    onAddLeave(day, { text, tone: isFullDay ? "day-off" : "blocked" });
    setShowLeaveForm(false);
  }

  function openLeaveForm(day: number) {
    setDraft((prev) => ({ ...prev, date: formatScheduleDate(day) }));
    setShowLeaveForm(true);
  }

  return (
    <section className="panel">
      <div className="panel-label">排班表</div>
      <div className="calendar-header">
        <button className="circle-nav">‹</button>
        <div className="month-title">2026年8月</div>
        <button className="circle-nav">›</button>
      </div>
      <div className="weekday-grid">
        {["日", "一", "二", "三", "四", "五", "六"].map((day) => <div key={day}>{day}</div>)}
      </div>
      <div className="roster-calendar">
        {Array.from({ length: 31 }, (_, index) => {
          const date = index + 1;
          const items = leaveItems[date] || [];
          const toneClass = items.some((item) => item.tone === "day-off") ? "has-leave" : items.length > 0 ? "has-blocked" : "";
          return (
            <button className={`roster-day ${toneClass}`} key={date} onClick={() => openLeaveForm(date)}>
              <span>{date}</span>
              {items.map((item) => <span className={`leave-chip ${item.tone}`} key={item.text}>{item.text}</span>)}
            </button>
          );
        })}
      </div>
      <div className="leave-list">
        {leaveRows.map(({ day, item }, index) => (
          <div className="leave-row" key={`${day}-${item.text}-${index}`}>
            <strong>{formatScheduleDateLabel(formatScheduleDate(day))}</strong>
            <span>{item.text}</span>
          </div>
        ))}
      </div>
      {showLeaveForm && (
        <div className="leave-form">
          <div className="booking-field">
            <div className="booking-label">日期</div>
            <input className="checkout-input" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
          </div>
          <div className="booking-field">
            <div className="booking-label">類型</div>
            <div className="leave-type-grid">
              {(["整天休假", "指定時段不接客"] as LeaveDraft["type"][]).map((type) => (
                <button className={`leave-type-btn ${draft.type === type ? "active" : ""}`} key={type} onClick={() => setDraft({ ...draft, type })}>{type}</button>
              ))}
            </div>
          </div>
          {draft.type === "指定時段不接客" && (
            <div className="detail-grid">
              <BookingInput label="開始時間" value={draft.startTime} onChange={(value) => setDraft({ ...draft, startTime: value })} />
              <BookingInput label="結束時間" value={draft.endTime} onChange={(value) => setDraft({ ...draft, endTime: value })} />
            </div>
          )}
          <div className="booking-field">
            <div className="booking-label">備註</div>
            <textarea className="checkout-note" value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="例如：進修課、家庭日、臨時不接客..." />
          </div>
          <div className="modal-action-row">
            <button className="secondary-modal-btn" onClick={() => setShowLeaveForm(false)}>取消</button>
            <button className="primary-modal-btn" onClick={submitLeave}>加入排班表</button>
          </div>
        </div>
      )}
    </section>
  );
}

function TodayView({ rows, onView, onCheckout, onAddBooking }: { rows: Appointment[]; onView: (row: Appointment) => void; onCheckout: (row: Appointment) => void; onAddBooking: () => void }) {
  const statusCounts = rows.reduce(
    (counts, row) => ({
      ...counts,
      [row.tone]: counts[row.tone] + 1,
    }),
    { progress: 0, upcoming: 0, done: 0 }
  );

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
        <span className="progress-text"><i className="dot progress-dot" />服務中：{statusCounts.progress}</span>
        <span className="upcoming-text"><i className="dot upcoming-dot" />即將到來：{statusCounts.upcoming}</span>
        <span className="done-text"><i className="dot done-dot" />已完成：{statusCounts.done}</span>
      </div>
      <section className="list-card">
        {rows.map((row) => (
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

function PendingView({ decisions, pendingCount, onOpen }: { decisions: Record<string, PendingDecision>; pendingCount: number; onOpen: (row: (typeof pendingRows)[number]) => void }) {
  return (
    <>
      <h1 className="page-title">待確認</h1>
      <div className="page-subtitle">目前有 {pendingCount} 筆預約待回覆</div>
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

function CalendarView({ mode, selectedDate, scheduleItems, onModeChange, onSelectDate, onAddBooking }: { mode: ScheduleMode; selectedDate: string; scheduleItems: Record<number, ScheduleItem[]>; onModeChange: (mode: ScheduleMode) => void; onSelectDate: (date: string) => void; onAddBooking: (date: string, time?: string) => void }) {
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
        <MonthSchedule selectedDate={selectedDate} scheduleItems={scheduleItems} onSelectDate={onSelectDate} onAddBooking={onAddBooking} />
      ) : (
        <CompactSchedule mode={mode} selectedDate={selectedDate} scheduleItems={scheduleItems} onSelectDate={onSelectDate} onAddBooking={onAddBooking} />
      )}
    </>
  );
}

function MonthSchedule({ selectedDate, scheduleItems, onSelectDate, onAddBooking }: { selectedDate: string; scheduleItems: Record<number, ScheduleItem[]>; onSelectDate: (date: string) => void; onAddBooking: (date: string, time?: string) => void }) {
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

function CompactSchedule({ mode, selectedDate, scheduleItems, onSelectDate, onAddBooking }: { mode: Exclude<ScheduleMode, "月">; selectedDate: string; scheduleItems: Record<number, ScheduleItem[]>; onSelectDate: (date: string) => void; onAddBooking: (date: string, time?: string) => void }) {
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
      <SelectedDayPanel selectedDate={selectedDate} items={scheduleItems[Number(selectedDate.split("-")[2])] || []} onAddBooking={onAddBooking} />
    </>
  );
}

function SelectedDayPanel({ selectedDate, items, onAddBooking }: { selectedDate: string; items: ScheduleItem[]; onAddBooking: (date: string, time?: string) => void }) {
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
  const [showIncomeDetails, setShowIncomeDetails] = useState(false);
  const currentRange = earningsRanges[activeRange];
  const totalPerformance = currentRange.service + currentRange.product;

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
        {(["今日", "本月", "指定日期或區間"] as EarningsRange[]).map((tab) => (
          <button className={`income-segment ${activeRange === tab ? "active" : ""}`} key={tab} onClick={() => setActiveRange(tab)}>{tab}</button>
        ))}
      </div>
      <div className="summary-grid">
        <div className="summary-card"><div className="summary-amount">NT$ {totalPerformance.toLocaleString()}</div><div className="summary-title">總業績</div><div className="summary-sub">服務業績 NT${currentRange.service.toLocaleString()} · 商品銷售 NT${currentRange.product.toLocaleString()}</div></div>
        <div className="summary-card"><div className="summary-amount purple">NT$ {currentRange.salary.toLocaleString()}</div><div className="summary-title purple">實際薪資</div><div className="summary-sub">依抽成與獎金計算</div></div>
      </div>
      <section className="panel">
        <div className="income-detail-header">
          <div className="panel-label">{currentRange.label}｜總客數：{currentRange.count}</div>
          <button className="detail-link-btn" onClick={() => setShowIncomeDetails(true)}>查看明細</button>
        </div>
        <div className="breakdown-row"><span>服務業績</span><span>NT${currentRange.service.toLocaleString()}</span></div>
        <div className="breakdown-row"><span>商品銷售</span><span>NT${currentRange.product.toLocaleString()}</span></div>
        <div className="breakdown-row"><span>總業績</span><span>NT${totalPerformance.toLocaleString()}</span></div>
        <div className="breakdown-row"><span>折扣金額</span><span className="negative">-NT${currentRange.discount.toLocaleString()}</span></div>
        <div className="breakdown-row"><span>實際薪資</span><span>NT${currentRange.salary.toLocaleString()}</span></div>
      </section>
      <div className="final-card"><span>{activeRange}實際薪資</span><span className="final-amount">NT${currentRange.salary.toLocaleString()}</span></div>
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
      {showIncomeDetails && <IncomeDetailsModal range={activeRange} onClose={() => setShowIncomeDetails(false)} />}
    </>
  );
}

function IncomeDetailsModal({ range, onClose }: { range: EarningsRange; onClose: () => void }) {
  const currentRange = earningsRanges[range];
  const detailGroups = [
    {
      title: "服務明細",
      rows: [
        { name: "Lynn", item: "質感燙＋剪髮", amount: "NT$2,800" },
        { name: "Mira", item: "染髮（M）", amount: "NT$1,200" },
        { name: "Joey", item: "護髮", amount: "NT$800" },
      ],
    },
    {
      title: "商品銷售明細",
      rows: [
        { name: "Mira", item: "生命果油 GS 120ml", amount: "NT$1,180" },
      ],
    },
    {
      title: "自領商品明細",
      rows: [
        { name: "Cherry", item: "染護試用包 x1", amount: "店內自領" },
      ],
    },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">查看明細</div>
            <div className="modal-subtitle">{currentRange.period} · {currentRange.label}</div>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="income-detail-list">
          {detailGroups.map((group) => (
            <section className="income-detail-section" key={group.title}>
              <div className="income-detail-title">{group.title}</div>
              {group.rows.map((row) => (
                <div className="income-detail-row" key={`${group.title}-${row.name}-${row.item}`}>
                  <strong>{row.name}</strong>
                  <span>{row.item}</span>
                  <em>{row.amount}</em>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function RangePickerModal({ activeRange, onSelect, onClose }: { activeRange: EarningsRange; onSelect: (range: EarningsRange) => void; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">選擇收入區間</div>
            <div className="modal-subtitle">可快速查看今日、本月，或指定日期範圍</div>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="range-picker-list">
          {(["今日", "本月", "指定日期或區間"] as EarningsRange[]).map((range) => (
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

function getServiceTone(service: string) {
  if (service.includes("染")) return "color";
  if (service.includes("燙")) return "perm";
  if (service.includes("護")) return "treatment";
  return "cut";
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-card">
      <div className="detail-label">{label}</div>
      <div className="detail-value">{value}</div>
    </div>
  );
}

function BottomTabs({ activeTab, pendingCount, onChange }: { activeTab: TabKey; pendingCount: number; onChange: (tab: TabKey) => void }) {
  return (
    <nav className="bottom-tabs">
      {tabs.map((tab) => (
        <button className={`tab-btn ${activeTab === tab.key ? "active" : ""}`} key={tab.key} onClick={() => onChange(tab.key)}>
          <span className="tab-icon-wrap">
            <span className="tab-icon">{tab.icon}</span>
          </span>
          <span className="tab-label-wrap">
            {tab.label}
            {tab.key === "pending" && pendingCount > 0 && <span className="tab-label-badge">{pendingCount}</span>}
          </span>
        </button>
      ))}
    </nav>
  );
}
