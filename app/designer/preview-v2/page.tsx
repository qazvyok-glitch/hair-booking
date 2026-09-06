"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type TabKey = "today" | "pending" | "calendar" | "earnings";
type ScheduleMode = "3日" | "週" | "月";
type PendingDecision = "pending" | "accepted" | "declined";
type PendingScope = "self" | "team";
type EarningsRange = "今日" | "本月" | "指定日期或區間";
type SettingsPanel = "profile" | "roster";
type PendingRow = {
  key: string;
  id?: number;
  date: string;
  time: string;
  name: string;
  phone: string;
  service: string;
  detail: string;
  designer?: string;
};
type Appointment = {
  id?: number;
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
  primaryServiceName: string;
  serviceAmount: number;
  serviceDiscount: number;
  extraServiceItems: CheckoutServiceItem[];
  productItems: CheckoutProductItem[];
  paymentMethod: string;
  note: string;
};
type BookingDraft = {
  date: string;
  time: string;
  designer: string;
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
type ScheduleItem = { text: string; tone: string; designer?: string; customer?: string };
type LeaveItem = { text: string; tone: "day-off" | "blocked"; designer?: string };
type CalendarItem = { text: string; tone: string; designer?: string; customer?: string; category?: "booking" | "leave" };
type CalendarRecords<T> = Record<string, T[]>;
type LeaveDraft = {
  date: string;
  type: "整天休假" | "指定時段不接客";
  startTime: string;
  endTime: string;
  note: string;
};
type DesignerProfile = {
  name: string;
  role: string;
  phone: string;
  specialties: string;
  avatarUrl: string;
  joinedDate: string;
  leftDate: string;
};
type DesignerSession = { id: number; name: string; nickname?: string; is_manager?: boolean };
type BackendDesigner = {
  id: number;
  name: string;
  display_name?: string;
  nickname?: string;
  style?: string;
  avatar_url?: string;
  joined_date?: string | null;
  left_date?: string | null;
  is_manager?: boolean;
  is_active?: boolean;
};
type BackendDesignerPriceItem = {
  id: number;
  designer_id: number;
  category: string;
  name: string;
  price_range: string;
  sort_order?: number | null;
  is_active?: boolean;
};
type BackendPriceItem = { id: number; category: string; name: string; price_range: string; sort_order?: number | null };
type BackendService = { id: number; name: string; category_id?: number };
type BackendBooking = {
  id: number;
  designer_id: number;
  customer_name: string;
  customer_phone?: string;
  booking_date: string;
  booking_time: string;
  service_ids?: number[];
  note?: string;
  status: string;
  designers?: { name?: string; display_name?: string; nickname?: string };
};
type BackendOffDay = { designer_id: number; off_date: string };
type BackendOffSlot = { designer_id: number; slot_date: string; slot_time: string };
type BackendShopInfo = { key: string; value: string; is_active: boolean };
type BackendServiceItem = { id?: number; name: string; amount?: number; original_amount?: number; discount?: number };
type BackendTransaction = {
  id: number;
  booking_id?: number | null;
  designer_id: number;
  customer_name: string;
  service_items?: BackendServiceItem[];
  total_amount: number;
  note?: string;
  created_at: string;
};
type BackendProductUsage = {
  designer_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_cost: number;
  used_at: string;
};
type BackendProduct = { id: number; name: string; unit?: string; unit_price: number; category?: string; stock_quantity?: number; is_active?: boolean; sort_order?: number | null };
type BackendCustomer = { id: string; name?: string | null; phone?: string | null; customer_no?: string | null };
type CheckoutServiceOption = { key: string; name: string; category: string; priceLabel: string; amount: number };
type CheckoutServiceItem = { name: string; amount: number };
type CheckoutProductItem = { product: BackendProduct; quantity: number; linePrice: number; discount: number };
type SelfUseMaterialItem = { product: BackendProduct; quantity: number };
type EarningsData = { period: string; service: number; product: number; selfUse: number; discount: number; salary: number; count: number; label: string };
type IncomeDetailRow = { date?: string; name: string; item: string; amount: string };
type IncomeDetailGroup = { title: string; rows: IncomeDetailRow[] };
type IncomeDetailGroupsByRange = Record<EarningsRange, IncomeDetailGroup[]>;
type IncomeDateRange = { startDate: string; endDate: string };

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: "today", label: "今日", icon: "" },
  { key: "pending", label: "待確認", icon: "" },
  { key: "calendar", label: "排程", icon: "" },
  { key: "earnings", label: "收入", icon: "$" },
];

const initialTodayRows: Appointment[] = [];

const pendingRows: PendingRow[] = [];

const initialScheduleItems: CalendarRecords<ScheduleItem> = {};

const teamScheduleItems: CalendarRecords<ScheduleItem> = {};

const initialLeaveItems: CalendarRecords<LeaveItem> = {};

const teamLeaveItems: CalendarRecords<LeaveItem> = {};

const initialDesignerProfile: DesignerProfile = {
  name: "Cherry",
  role: "設計師",
  phone: "0912-345-678",
  specialties: "剪髮、染髮、燙髮、護髮",
  avatarUrl: "",
  joinedDate: "2026-08-01",
  leftDate: "",
};

const customerRecords: CustomerRecord[] = [];

const earningsRanges: Record<EarningsRange, EarningsData> = {
  今日: { period: "今日", service: 0, product: 0, selfUse: 0, discount: 0, salary: 0, count: 0, label: "今日收入" },
  本月: { period: "本月", service: 0, product: 0, selfUse: 0, discount: 0, salary: 0, count: 0, label: "本月收入" },
  指定日期或區間: { period: "指定日期或區間", service: 0, product: 0, selfUse: 0, discount: 0, salary: 0, count: 0, label: "指定日期或區間收入" },
};

export default function DesignerPreviewV2Page() {
  const [activeTab, setActiveTab] = useState<TabKey>("today");
  const [showSettings, setShowSettings] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [checkoutAppointment, setCheckoutAppointment] = useState<Appointment | null>(null);
  const [checkoutComplete, setCheckoutComplete] = useState(false);
  const [pendingDecisions, setPendingDecisions] = useState<Record<string, PendingDecision>>({});
  const [selectedPending, setSelectedPending] = useState<PendingRow | null>(null);
  const [pendingScope, setPendingScope] = useState<PendingScope>("self");
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("月");
  const [selectedScheduleDate, setSelectedScheduleDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [bookingDraft, setBookingDraft] = useState<BookingDraft | null>(null);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [showSelfUseModal, setShowSelfUseModal] = useState(false);
  const [selfUseComplete, setSelfUseComplete] = useState(false);
  const emptyTodayRows = initialTodayRows;
  const emptyScheduleItems = initialScheduleItems;
  const emptyLeaveItems = initialLeaveItems;
  const [backendSession, setBackendSession] = useState<DesignerSession | null>(null);
  const [backendConnected, setBackendConnected] = useState(false);
  const [backendLoading, setBackendLoading] = useState(false);
  const [backendDesigners, setBackendDesigners] = useState<BackendDesigner[]>([]);
  const [backendServices, setBackendServices] = useState<BackendService[]>([]);
  const [backendBookings, setBackendBookings] = useState<BackendBooking[]>([]);
  const [backendTransactions, setBackendTransactions] = useState<BackendTransaction[]>([]);
  const [backendProductUsage, setBackendProductUsage] = useState<BackendProductUsage[]>([]);
  const [backendProducts, setBackendProducts] = useState<BackendProduct[]>([]);
  const [backendCustomers, setBackendCustomers] = useState<CustomerRecord[]>(customerRecords);
  const [designerPriceItems, setDesignerPriceItems] = useState<BackendDesignerPriceItem[]>([]);
  const [priceCategoryOrder, setPriceCategoryOrder] = useState<string[]>([]);
  const [backendScheduleItems, setBackendScheduleItems] = useState<CalendarRecords<ScheduleItem>>({});
  const [backendTeamScheduleItems, setBackendTeamScheduleItems] = useState<CalendarRecords<ScheduleItem>>({});
  const [backendLeaveItems, setBackendLeaveItems] = useState<CalendarRecords<LeaveItem>>({});
  const [backendTeamLeaveItems, setBackendTeamLeaveItems] = useState<CalendarRecords<LeaveItem>>({});
  const [customIncomeRange, setCustomIncomeRange] = useState<IncomeDateRange>(() => getDefaultIncomeDateRange());
  const [designerProfile, setDesignerProfile] = useState<DesignerProfile>(initialDesignerProfile);

  useEffect(() => {
    let cancelled = false;
    async function initBackendSession() {
      const session = await resolveDesignerSession();
      if (cancelled) return;
      if (!session) {
        setBackendConnected(false);
        return;
      }
      setBackendSession(session);
      setBackendConnected(true);
      setSelectedScheduleDate(new Date().toLocaleDateString("en-CA"));
      await loadBackendData(session);
    }
    initBackendSession();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadBackendData(session: DesignerSession) {
    setBackendLoading(true);
    const bookingQuery = supabase
      .from("bookings")
      .select("*, designers(name, display_name, nickname)")
      .neq("status", "cancelled")
      .order("booking_date")
      .order("booking_time");
    const transactionQuery = supabase.from("transactions").select("*").order("created_at", { ascending: false });
    const productUsageQuery = supabase.from("product_usage").select("*").order("used_at", { ascending: false });
    const [{ data: designerData }, { data: serviceData }, { data: bookingData }, { data: transactionData }, { data: productUsageData }, { data: productData }, { data: customerData }, { data: publicPriceData }, { data: priceData }, { data: categorySettingData }, { data: offDayData }, { data: offSlotData }] = await Promise.all([
      supabase.from("designers").select("id, name, display_name, nickname, style, avatar_url, joined_date, left_date, is_manager, is_active").eq("is_active", true).order("sort_order", { nullsFirst: false }).order("id"),
      supabase.from("services").select("id, name, category_id").eq("is_active", true).order("sort_order"),
      session.is_manager ? bookingQuery : bookingQuery.eq("designer_id", session.id),
      transactionQuery.eq("designer_id", session.id),
      productUsageQuery.eq("designer_id", session.id),
      supabase.from("products").select("id, name, unit, unit_price, category, stock_quantity, is_active, sort_order").eq("is_active", true).order("category").order("sort_order"),
      supabase.from("customers").select("id, name, phone, customer_no").order("customer_no"),
      supabase.from("price_items").select("id, category, name, price_range, sort_order").order("category").order("sort_order"),
      supabase.from("designer_price_items").select("id, designer_id, category, name, price_range, sort_order, is_active").eq("designer_id", session.id).eq("is_active", true).order("category").order("sort_order"),
      supabase.from("shop_info").select("key, value, is_active").in("key", ["price_category_order", designerCategoryOrderKey(session.id)]),
      session.is_manager ? supabase.from("designer_off_days").select("*") : supabase.from("designer_off_days").select("*").eq("designer_id", session.id),
      session.is_manager ? supabase.from("designer_off_slots").select("*") : supabase.from("designer_off_slots").select("*").eq("designer_id", session.id),
    ]);

    const designers = (designerData || []) as BackendDesigner[];
    const services = (serviceData || []) as BackendService[];
    const bookings = (bookingData || []) as BackendBooking[];
    const transactions = (transactionData || []) as BackendTransaction[];
    const productUsage = (productUsageData || []) as BackendProductUsage[];
    const products = (productData || []) as BackendProduct[];
    const customers = ((customerData || []) as BackendCustomer[]).map((customer) => ({
      id: customer.id,
      name: customer.name || customer.customer_no || "未命名顧客",
      phone: customer.phone || "",
      lastService: "",
      note: customer.customer_no ? `會員編號 ${customer.customer_no}` : "",
      lastVisit: "",
    }));
    const publicPriceItems = (publicPriceData || []) as BackendPriceItem[];
    const designerSpecificPriceItems = (priceData || []) as BackendDesignerPriceItem[];
    const categorySettings = (categorySettingData || []) as BackendShopInfo[];
    const nextPriceCategoryOrder = readCategoryOrder(
      categorySettings.find((item) => item.key === designerCategoryOrderKey(session.id) && item.is_active)?.value
      || categorySettings.find((item) => item.key === "price_category_order" && item.is_active)?.value
    );
    const priceItems = designerSpecificPriceItems.length > 0
      ? designerSpecificPriceItems
      : publicPriceItems.map((item) => ({
        id: item.id,
        designer_id: session.id,
        category: item.category,
        name: item.name,
        price_range: item.price_range,
        sort_order: item.sort_order,
        is_active: true,
      }));
    const offDays = (offDayData || []) as BackendOffDay[];
    const offSlots = (offSlotData || []) as BackendOffSlot[];
    const currentDesigner = designers.find((designer) => designer.id === session.id);

    setBackendDesigners(designers);
    setBackendServices(services);
    setBackendBookings(bookings);
    setBackendTransactions(transactions);
    setBackendProductUsage(productUsage);
    setBackendProducts(products);
    setBackendCustomers(customers);
    setPriceCategoryOrder(nextPriceCategoryOrder);
    setDesignerPriceItems(sortDesignerPriceItems(priceItems, nextPriceCategoryOrder));
    setBackendScheduleItems(mapBookingsToCalendar(bookings.filter((booking) => booking.designer_id === session.id), services, designers));
    setBackendTeamScheduleItems(mapBookingsToCalendar(bookings.filter((booking) => booking.designer_id !== session.id), services, designers));
    setBackendLeaveItems(mapLeavesToCalendar(offDays.filter((item) => item.designer_id === session.id), offSlots.filter((item) => item.designer_id === session.id), designers));
    setBackendTeamLeaveItems(mapLeavesToCalendar(offDays.filter((item) => item.designer_id !== session.id), offSlots.filter((item) => item.designer_id !== session.id), designers));

    if (currentDesigner) {
      setDesignerProfile({
        name: currentDesigner.display_name || currentDesigner.name,
        role: currentDesigner.nickname || "設計師",
        phone: designerProfile.phone,
        specialties: currentDesigner.style || designerProfile.specialties,
        avatarUrl: currentDesigner.avatar_url || "",
        joinedDate: currentDesigner.joined_date || "",
        leftDate: currentDesigner.left_date || "",
      });
    }
    setBackendLoading(false);
  }

  async function setDecision(row: PendingRow, decision: PendingDecision) {
    if (!backendConnected || !backendSession || !row.id) {
      alert("後台尚未連線，無法同步預約狀態。");
      return;
    }
    setPendingDecisions((prev) => ({ ...prev, [row.key]: decision }));
    const status = decision === "accepted" ? "confirmed" : decision === "declined" ? "cancelled" : "pending";
    const { error } = await supabase.from("bookings").update({ status }).eq("id", row.id);
    if (error) {
      alert("預約狀態同步失敗，請稍後再試。");
      return;
    }
    await loadBackendData(backendSession);
  }

  async function completeSyncedBooking() {
    if (!bookingDraft) return;

    const serviceLabel = bookingDraft.service.replace(/[（）()ＭMLL]/g, "").trim() || "預約";

    if (backendConnected && backendSession) {
      const targetDesigner = findDesignerByLabel(backendDesigners, bookingDraft.designer) || backendDesigners.find((designer) => designer.id === backendSession.id);
      const selectedService = backendServices.find((service) => service.name === bookingDraft.service) || backendServices.find((service) => bookingDraft.service.includes(service.name) || service.name.includes(serviceLabel));
      if (!targetDesigner) {
        alert("找不到指定設計師，請重新選擇。");
        return;
      }
      const customerName = bookingDraft.name.trim() || "新顧客";
      const customerPhone = bookingDraft.phone.trim();
      if (customerPhone) {
        const { data: existingCustomer } = await supabase.from("customers").select("id").eq("phone", customerPhone).maybeSingle();
        if (existingCustomer?.id) {
          await supabase.from("customers").update({ name: customerName }).eq("id", existingCustomer.id);
        } else {
          await supabase.from("customers").insert({
            id: crypto.randomUUID(),
            name: customerName,
            phone: customerPhone,
          });
        }
      }
      const { error } = await supabase.from("bookings").insert({
        designer_id: targetDesigner.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        booking_date: bookingDraft.date,
        booking_time: bookingDraft.time,
        note: bookingDraft.note,
        status: "confirmed",
        service_ids: selectedService ? [selectedService.id] : [],
      });
      if (error) {
        alert("新增預約失敗，請稍後再試。");
        return;
      }
      await loadBackendData(backendSession);
      setBookingComplete(true);
      return;
    }

    alert("後台尚未連線，新增預約未送出。請重新整理後再試。");
  }

  async function addSyncedLeave(date: string, item: LeaveItem) {
    if (!backendConnected || !backendSession) {
      alert("後台尚未連線，排休未送出。請重新整理後再試。");
      return;
    }

    if (item.tone === "day-off") {
      await supabase.from("designer_off_days").insert({ designer_id: backendSession.id, off_date: date });
    } else {
      const slots = getBlockedSlots(item.text);
      if (slots.length > 0) {
        await supabase.from("designer_off_slots").insert(slots.map((slot) => ({ designer_id: backendSession.id, slot_date: date, slot_time: slot })));
      }
    }
    await loadBackendData(backendSession);
  }

  async function saveDesignerProfile(profile: DesignerProfile) {
    if (!backendConnected || !backendSession) {
      alert("後台尚未連線，個人資料未更新。請重新整理後再試。");
      return;
    }
    const { error } = await supabase.from("designers").update({
      display_name: profile.name,
      nickname: profile.role,
      style: profile.specialties,
    }).eq("id", backendSession.id);
    if (error) alert("個人資料同步失敗，請稍後再試。");
    else {
      setDesignerProfile(profile);
      await loadBackendData(backendSession);
    }
  }

  async function uploadDesignerAvatar(file: File) {
    if (!backendConnected || !backendSession) {
      alert("後台尚未連線，大頭照未上傳。請重新整理後再試。");
      return null;
    }
    const ext = file.name.split(".").pop() || "jpg";
    const path = `designer-${backendSession.id}.${ext}`;
    const { error } = await supabase.storage.from("designer-avatars").upload(path, file, { upsert: true });
    if (error) {
      alert("大頭照上傳失敗，請稍後再試。");
      return null;
    }
    const { data: { publicUrl } } = supabase.storage.from("designer-avatars").getPublicUrl(path);
    await supabase.from("designers").update({ avatar_url: publicUrl }).eq("id", backendSession.id);
    setDesignerProfile((prev) => ({ ...prev, avatarUrl: publicUrl }));
    return publicUrl;
  }

  async function completeCheckout(draft: CheckoutDraft, total: number) {
    if (!checkoutAppointment) return;
    if (backendConnected && backendSession) {
      const productRows = draft.productItems.map((item) => {
      const originalTotal = item.linePrice;
      const finalTotal = Math.max(0, originalTotal - item.discount);
      const discountText = item.discount > 0 ? `，折扣NT$${item.discount.toLocaleString()}` : "";
      return `${item.product.name} x${item.quantity}，金額NT$${item.linePrice.toLocaleString()}${discountText}，小計NT$${finalTotal.toLocaleString()}`;
      });
      const noteRows = [
        draft.note,
        productRows.length > 0 ? `客人購買商品：${productRows.join("、")}` : "",
      ].filter(Boolean);
      const { error } = await supabase.from("transactions").insert({
        booking_id: checkoutAppointment.id || null,
        designer_id: backendSession.id,
        customer_name: checkoutAppointment.name || "現場客人",
        service_items: distributeServiceDiscount(draft),
        total_amount: total,
        note: noteRows.join("\n"),
        payment_method: draft.paymentMethod,
      });
      if (error) {
        alert("結帳同步失敗，請稍後再試。");
        return;
      }
      if (checkoutAppointment.id) {
        const { error: bookingError } = await supabase.from("bookings").update({ status: "completed" }).eq("id", checkoutAppointment.id);
        if (bookingError) {
          alert("交易已同步，但預約狀態更新失敗，請稍後重新整理確認。");
        }
      }
      for (const item of draft.productItems) {
        const { data: product } = await supabase.from("products").select("stock_quantity").eq("id", item.product.id).single();
        if (product) {
          const newStock = Math.max(0, (product.stock_quantity || 0) - item.quantity);
          await supabase.from("products").update({ stock_quantity: newStock }).eq("id", item.product.id);
          await supabase.from("stock_records").insert({
            product_id: item.product.id,
            product_name: item.product.name,
            quantity: -item.quantity,
            type: "out",
            note: `客人購買 - ${checkoutAppointment.name || "現場客人"}`,
          });
        }
      }
      await loadBackendData(backendSession);
    } else {
      alert("後台尚未連線，結帳未送出。請重新整理後再試。");
      return;
    }
    setCheckoutComplete(true);
  }

  async function saveSelfUseMaterials(items: SelfUseMaterialItem[]) {
    if (!backendConnected || !backendSession) {
      alert("後台尚未連線，自領材料未送出。請重新整理後再試。");
      return;
    }
    if (items.length === 0) {
      alert("請先選擇自領材料。");
      return;
    }

    const usageDate = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("product_usage").insert(
      items.map((item) => ({
        designer_id: backendSession.id,
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.product.unit_price,
        total_cost: item.product.unit_price * item.quantity,
        used_at: usageDate,
      }))
    );
    if (error) {
      alert("自領材料同步失敗，請稍後再試。");
      return;
    }

    for (const item of items) {
      const { data: product } = await supabase.from("products").select("stock_quantity").eq("id", item.product.id).single();
      if (product) {
        const newStock = Math.max(0, (product.stock_quantity || 0) - item.quantity);
        await supabase.from("products").update({ stock_quantity: newStock }).eq("id", item.product.id);
        await supabase.from("stock_records").insert({
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: -item.quantity,
          type: "out",
          note: `設計師自領 - ${designerProfile.name}`,
        });
      }
    }

    await loadBackendData(backendSession);
    setSelfUseComplete(true);
  }

  const activeScheduleItems = backendConnected ? backendScheduleItems : emptyScheduleItems;
  const activeLeaveItems = backendConnected ? backendLeaveItems : emptyLeaveItems;
  const activeTeamScheduleItems = backendConnected ? backendTeamScheduleItems : teamScheduleItems;
  const activeTeamLeaveItems = backendConnected ? backendTeamLeaveItems : teamLeaveItems;
  const activeDesignerOptions = backendDesigners.length > 0 ? backendDesigners.map(getDesignerLabel) : [designerProfile.name];
  const activeServiceOptions = backendServices.length > 0 ? backendServices.map((service) => service.name) : [];
  const checkoutServiceOptions = buildCheckoutServiceOptions(designerPriceItems, priceCategoryOrder);
  const defaultBookingDate = selectedScheduleDate;
  const defaultBookingService = activeServiceOptions[0] || "";
  const activeTodayRows = backendConnected ? mapBookingsToTodayRows(backendBookings, backendTransactions, backendServices, backendSession?.id) : emptyTodayRows;
  const isManager = backendSession?.is_manager ?? false;
  const visiblePendingBookings = isManager && pendingScope === "team"
    ? backendBookings
    : backendBookings.filter((booking) => !backendSession || booking.designer_id === backendSession.id);
  const activePendingRows = backendConnected ? mapBookingsToPendingRows(visiblePendingBookings, backendServices, isManager && pendingScope === "team") : pendingRows;
  const activeEarningsRanges = backendConnected ? buildEarningsRanges(backendTransactions, backendProductUsage, customIncomeRange) : withCustomIncomeRange(earningsRanges, customIncomeRange);
  const activeIncomeDetails = backendConnected ? buildIncomeDetailGroups(backendTransactions, backendProductUsage, customIncomeRange) : null;
  const activePendingCount = activePendingRows.filter((row) => (pendingDecisions[row.key] || "pending") === "pending").length;

  return (
    <main className="preview-page">
      <section className="phone-shell">
        <Header profile={designerProfile} onOpenSettings={() => setShowSettings(true)} />
        <div className="screen-body">
          {backendLoading && <div className="sync-banner">正在同步後台資料...</div>}
          {showSettings ? (
            <SettingsView profile={designerProfile} priceItems={designerPriceItems} priceCategoryOrder={priceCategoryOrder} onProfileChange={saveDesignerProfile} onAvatarUpload={uploadDesignerAvatar} isSynced={backendConnected} leaveItems={activeLeaveItems} onAddLeave={addSyncedLeave} onBack={() => setShowSettings(false)} />
          ) : (
            <>
              {activeTab === "today" && <TodayView rows={activeTodayRows} onView={setSelectedAppointment} onCheckout={setCheckoutAppointment} onAddBooking={() => { setBookingComplete(false); setBookingDraft(createBookingDraft(defaultBookingDate, "10:00", designerProfile.name, defaultBookingService)); }} />}
              {activeTab === "pending" && <PendingView rows={activePendingRows} decisions={pendingDecisions} pendingCount={activePendingCount} isManager={isManager} pendingScope={pendingScope} onScopeChange={setPendingScope} onOpen={setSelectedPending} />}
              {activeTab === "calendar" && <CalendarView mode={scheduleMode} selectedDate={selectedScheduleDate} scheduleItems={activeScheduleItems} teamScheduleItemsSource={activeTeamScheduleItems} leaveItems={activeLeaveItems} teamLeaveItemsSource={activeTeamLeaveItems} isManager={backendSession?.is_manager ?? false} designerName={designerProfile.name} onModeChange={setScheduleMode} onSelectDate={setSelectedScheduleDate} onAddBooking={(date, time) => { setBookingComplete(false); setBookingDraft(createBookingDraft(date, time, designerProfile.name, defaultBookingService)); }} />}
              {activeTab === "earnings" && <EarningsView ranges={activeEarningsRanges} detailGroups={activeIncomeDetails} customRange={customIncomeRange} onCustomRangeChange={setCustomIncomeRange} onOpenSelfUse={() => { setSelfUseComplete(false); setShowSelfUseModal(true); }} />}
            </>
          )}
        </div>
        <BottomTabs activeTab={activeTab} pendingCount={activePendingCount} onChange={(tab) => { setShowSettings(false); setActiveTab(tab); }} />
      </section>
      {selectedAppointment && <AppointmentModal row={selectedAppointment} onClose={() => setSelectedAppointment(null)} />}
      {selectedPending && <PendingConfirmModal row={selectedPending} decision={pendingDecisions[selectedPending.key] || "pending"} onDecide={setDecision} onClose={() => setSelectedPending(null)} />}
      {showSelfUseModal && <SelfUseMaterialModal products={backendProducts} complete={selfUseComplete} isSynced={backendConnected} onComplete={saveSelfUseMaterials} onClose={() => { setShowSelfUseModal(false); setSelfUseComplete(false); }} />}
      {checkoutAppointment && <CheckoutModal row={checkoutAppointment} serviceOptions={checkoutServiceOptions} products={backendProducts} complete={checkoutComplete} isSynced={backendConnected} onComplete={completeCheckout} onClose={() => { setCheckoutAppointment(null); setCheckoutComplete(false); }} />}
      {bookingDraft && <AddBookingModal draft={bookingDraft} complete={bookingComplete} designerOptions={activeDesignerOptions} serviceOptions={activeServiceOptions} customerRecords={backendCustomers} isSynced={backendConnected} onChange={setBookingDraft} onComplete={completeSyncedBooking} onClose={() => { setBookingDraft(null); setBookingComplete(false); }} />}

      <style>{`
        .preview-page { min-height: 100vh; background: #eef0f3; display: flex; justify-content: center; padding: 20px; color: #1f2937; }
        .phone-shell { width: 100%; max-width: 430px; height: min(900px, calc(100vh - 40px)); background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 26px; overflow: hidden; box-shadow: 0 18px 40px rgba(31,41,55,.12); display: flex; flex-direction: column; }
        .top-bar { height: 72px; background: #fff; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; flex: 0 0 auto; }
        .brand-area { display: flex; align-items: center; gap: 10px; border: none; background: transparent; padding: 0; color: inherit; text-align: left; cursor: pointer; }
        .brand-area:focus-visible { outline: 2px solid #148bd8; outline-offset: 4px; border-radius: 14px; }
        .logo { width: 42px; height: 42px; border-radius: 50%; background: #050505; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 800; letter-spacing: -.04em; position: relative; overflow: hidden; flex: 0 0 auto; }
        .logo::after { content: ""; width: 7px; height: 7px; border-radius: 50%; background: #9b1f1f; position: absolute; right: 9px; bottom: 8px; box-shadow: -7px 0 0 #c92d2d; }
        .logo.has-avatar::after { display: none; }
        .logo img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .large-avatar { width: 64px; height: 64px; font-size: 24px; }
        .large-avatar::after { width: 10px; height: 10px; right: 13px; bottom: 12px; box-shadow: -10px 0 0 #c92d2d; }
        .designer-identity { display: flex; flex-direction: column; }
        .designer-name { font-size: 18px; font-weight: 850; line-height: 1.05; }
        .designer-role { font-size: 13px; color: #6b7280; margin-top: 4px; font-weight: 650; }
        .logout-btn { border: 1px solid #dfe3ea; background: #fff; color: #5f6673; border-radius: 12px; padding: 10px 16px; font-size: 14px; font-weight: 750; }
        .screen-body { flex: 1 1 auto; overflow-y: auto; padding: 20px 16px 18px; }
        .sync-banner { margin: 0 0 12px; border: 1px solid #bfe6ff; background: #eef9ff; color: #126dc2; border-radius: 12px; padding: 9px 12px; font-size: 12px; font-weight: 850; }
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
        .pending-scope-tabs { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; margin: 0 0 16px; padding: 4px; border: 1px solid #e1e7ef; border-radius: 999px; background: #eef3f8; }
        .pending-scope-btn { border: none; border-radius: 999px; background: transparent; color: #6b7280; padding: 9px 4px; font-size: 13px; font-weight: 950; cursor: pointer; }
        .pending-scope-btn.active { background: #148bd8; color: #fff; box-shadow: 0 6px 14px rgba(20,139,216,.22); }
        .pending-list { display: grid; gap: 14px; }
        .pending-card { min-height: 118px; display: grid; grid-template-columns: 58px 1fr 78px; gap: 10px; align-items: center; padding: 14px; }
        .pending-card.is-done { opacity: .74; }
        .pending-designer { color: #1478c8; font-size: 13px; font-weight: 950; margin-bottom: 4px; }
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
        .income-tabs { grid-template-columns: repeat(2, 1fr); margin-bottom: 14px; }
        .segment, .income-segment { border: none; background: transparent; color: #4b5563; border-radius: 15px; padding: 9px 0; font-weight: 850; font-size: 14px; cursor: pointer; }
        .income-segment { font-size: 12px; padding: 8px 0; }
        .segment.active, .income-segment.active { background: #148bd8; color: #fff; }
        .manager-scope-card { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #fff; border: 1px solid #e1e7ef; border-radius: 16px; padding: 12px; margin-bottom: 16px; box-shadow: 0 8px 18px rgba(31,41,55,.04); }
        .manager-scope-title { color: #1f2937; font-size: 14px; font-weight: 950; margin-bottom: 3px; }
        .manager-scope-subtitle { color: #8b95a3; font-size: 11px; font-weight: 800; line-height: 1.35; }
        .scope-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; background: #eef1f5; border-radius: 999px; padding: 4px; flex: 0 0 128px; }
        .scope-toggle button { border: none; border-radius: 999px; background: transparent; color: #6b7280; padding: 7px 0; font-size: 12px; font-weight: 950; cursor: pointer; }
        .scope-toggle button.active { background: #208bd8; color: #fff; }
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
        .schedule-bar.day-off { background: #ffe6d5; color: #b45309; font-weight: 950; }
        .schedule-bar.blocked { background: #dff1ff; color: #126dc2; font-weight: 950; }
        .schedule-bar.team-a { background: #eadffd; color: #6847d9; font-weight: 950; }
        .schedule-bar.team-b { background: #ffe2ef; color: #bd2f67; font-weight: 950; }
        .schedule-bar.team-c { background: #e1f6dc; color: #4c7b1f; font-weight: 950; }
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
        .leave-timeline-row .row-time, .leave-timeline-row .row-service { color: #126dc2; font-weight: 950; }
        .schedule-detail { display: flex; flex-direction: column; gap: 3px; }
        .detail-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; color: #8b95a3; font-size: 12px; font-weight: 850; line-height: 1.3; }
        .detail-name { color: #1f2937; font-size: 13px; font-weight: 950; }
        .detail-service { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; color: #1f2937; font-size: 14px; font-weight: 950; line-height: 1.35; }
        .detail-customer { color: #1f2937; font-weight: 950; }
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
        .earnings-action-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 0 0 14px; }
        .earnings-action-btn { border: 1px solid #148bd8; background: #fff; color: #1478c8; border-radius: 999px; padding: 10px 8px; font-size: 13px; font-weight: 950; cursor: pointer; white-space: nowrap; }
        .earnings-action-btn.primary { background: #148bd8; color: #fff; box-shadow: 0 8px 16px rgba(20,139,216,.18); }
        .earnings-action-btn.muted { border-color: #dfe3ea; color: #9aa3af; cursor: default; }
        .panel { padding: 16px; margin-bottom: 14px; }
        .income-detail-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 4px; }
        .income-detail-header .panel-label { color: #1478c8; font-size: 13px; letter-spacing: 0; }
        .detail-link-btn { border: 1px solid #148bd8; background: #fff; color: #1478c8; border-radius: 999px; padding: 6px 10px; font-size: 12px; font-weight: 950; white-space: nowrap; cursor: pointer; }
        .income-detail-list { display: grid; gap: 14px; }
        .income-detail-section { border: 1px solid #edf0f4; border-radius: 14px; background: #fff; overflow: hidden; }
        .income-detail-title { padding: 10px 12px; background: #f8fafc; color: #1f2937; font-size: 14px; font-weight: 950; }
        .income-detail-row { display: grid; grid-template-columns: 46px 54px 1fr auto; gap: 8px; align-items: center; padding: 10px 12px; border-top: 1px solid #edf0f4; color: #374151; font-size: 12px; font-weight: 800; }
        .income-detail-row strong { color: #1f2937; font-size: 13px; }
        .income-detail-row span { color: #6b7280; line-height: 1.35; }
        .income-detail-row em { color: #1478c8; font-style: normal; font-weight: 950; white-space: nowrap; }
        .breakdown-row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid #edf0f4; color: #374151; font-weight: 750; }
        .breakdown-row:last-child { border-bottom: none; color: #1478c8; font-weight: 900; }
        .deduction-row { color: #ef244e; font-weight: 900; }
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
        .profile-editor-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .avatar-upload-btn { border: 1px solid #148bd8; background: #fff; color: #1478c8; border-radius: 999px; padding: 9px 12px; font-size: 12px; font-weight: 950; cursor: pointer; }
        .avatar-upload-btn input { display: none; }
        .profile-input-card { background: #f8fafc; border: 1px solid #edf0f4; border-radius: 14px; padding: 10px 12px; display: grid; gap: 5px; }
        .profile-input-card span { color: #8b95a3; font-size: 11px; font-weight: 900; }
        .profile-input-card input { width: 100%; border: none; background: transparent; color: #1f2937; font-size: 14px; font-weight: 850; outline: none; font-family: inherit; }
        .readonly-profile-card { background: #f8fafc; border: 1px solid #edf0f4; border-radius: 14px; padding: 10px 12px; display: grid; gap: 5px; }
        .readonly-profile-card.wide { grid-column: 1 / -1; }
        .readonly-profile-card span { color: #8b95a3; font-size: 11px; font-weight: 900; }
        .readonly-profile-card strong { color: #1f2937; font-size: 14px; font-weight: 850; }
        .price-list-card { border: 1px solid #d7eaff; background: linear-gradient(135deg, #ffffff 0%, #f1f8ff 100%); border-radius: 16px; padding: 14px; margin-bottom: 14px; }
        .price-list-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
        .price-list-title { color: #1f2937; font-size: 16px; font-weight: 950; }
        .readonly-badge { background: #e8f2ff; color: #1478c8; border-radius: 999px; padding: 5px 9px; font-size: 11px; font-weight: 950; white-space: nowrap; }
        .price-list-subtitle { color: #8b95a3; font-size: 12px; font-weight: 850; margin: -4px 0 12px; }
        .price-accordion { display: grid; gap: 8px; }
        .price-category-panel { border: 1px solid #edf0f4; border-radius: 14px; overflow: hidden; background: #fff; }
        .price-category-panel[open] { border-color: #c9e6ff; box-shadow: 0 8px 18px rgba(20, 139, 216, .08); }
        .price-category-summary { list-style: none; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px; color: #1f2937; font-size: 14px; font-weight: 950; cursor: pointer; }
        .price-category-summary::-webkit-details-marker { display: none; }
        .price-category-summary::after { content: "⌄"; color: #148bd8; font-size: 16px; font-weight: 950; transition: transform .18s ease; }
        .price-category-panel[open] .price-category-summary::after { transform: rotate(180deg); }
        .price-category-count { color: #8b95a3; font-size: 11px; font-weight: 850; margin-left: auto; }
        .price-list-rows { display: grid; border-top: 1px solid #edf0f4; background: #fff; }
        .price-list-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; padding: 10px 12px; border-bottom: 1px solid #edf0f4; color: #1f2937; font-size: 12px; font-weight: 850; }
        .price-list-row:last-child { border-bottom: none; }
        .price-name { color: #1f2937; font-weight: 950; }
        .price-value { color: #1478c8; font-weight: 950; white-space: nowrap; }
        .price-note { border: 1px solid #edf0f4; background: #f8fafc; color: #6b7280; border-radius: 14px; padding: 12px; font-size: 12px; font-weight: 800; line-height: 1.55; margin-top: 10px; }
        .price-empty { color: #8b95a3; font-size: 12px; font-weight: 800; padding: 12px; text-align: center; border: 1px solid #edf0f4; border-radius: 14px; background: #fff; }
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
        .today-tab-icon { width: 24px; height: 24px; display: block; stroke: currentColor; fill: none; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
        .today-tab-icon text { fill: currentColor; stroke: none; font-size: 7px; font-weight: 950; font-family: inherit; }
        .pending-tab-icon { width: 24px; height: 24px; display: block; stroke: currentColor; fill: none; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
        .schedule-tab-icon { width: 24px; height: 24px; display: block; stroke: currentColor; fill: none; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
        .schedule-tab-icon .grid-dot { fill: currentColor; stroke: none; opacity: .8; }
        .tab-icon-wrap { position: relative; display: inline-flex; }
        .tab-label-wrap { display: inline-flex; align-items: center; justify-content: center; gap: 4px; line-height: 1; }
        .tab-label-badge { min-width: 16px; height: 16px; border-radius: 999px; background: #ef244e; color: #fff; display: inline-flex; align-items: center; justify-content: center; padding: 0 4px; font-size: 10px; line-height: 1; font-weight: 950; box-sizing: border-box; }
        .modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.42); display: flex; justify-content: center; align-items: flex-end; padding: 18px; z-index: 20; overflow-y: auto; }
        .modal-panel { width: 100%; max-width: 430px; max-height: calc(100dvh - 36px); overflow-y: auto; overscroll-behavior: contain; background: #fff; border-radius: 22px; padding: 18px; box-shadow: 0 18px 40px rgba(15,23,42,.25); }
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
        .primary-modal-btn:disabled { background: #9aa3af; cursor: not-allowed; }
        .secondary-modal-btn { border: 1px solid #dfe3ea; background: #fff; color: #4b5563; }
        .range-picker-list { display: grid; gap: 10px; }
        .range-option { width: 100%; border: 1px solid #e1e7ef; background: #fff; border-radius: 14px; padding: 12px 13px; text-align: left; cursor: pointer; color: #1f2937; }
        .range-option.selected { border-color: #148bd8; background: #eaf7ff; }
        .range-option span { display: block; font-size: 15px; font-weight: 950; margin-bottom: 4px; }
        .range-option small { color: #6b7280; font-size: 12px; font-weight: 800; }
        .custom-range-box { border: 1px solid #148bd8; background: #eaf7ff; border-radius: 14px; padding: 12px 13px; color: #1f2937; }
        .custom-range-title { font-size: 15px; font-weight: 950; margin-bottom: 4px; }
        .custom-range-subtitle { color: #6b7280; font-size: 12px; font-weight: 800; margin-bottom: 10px; }
        .custom-range-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-bottom: 12px; }
        .custom-range-label { display: grid; gap: 5px; color: #6b7280; font-size: 11px; font-weight: 900; }
        .custom-range-label input { width: 100%; border: 1px solid #cfe1f2; border-radius: 10px; padding: 9px 8px; background: #fff; color: #1f2937; font: inherit; font-size: 12px; box-sizing: border-box; }
        .range-mode-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; background: #eef1f5; border-radius: 999px; padding: 4px; margin-bottom: 14px; }
        .range-mode-tab { border: none; border-radius: 999px; background: transparent; color: #6b7280; padding: 9px 0; font-size: 13px; font-weight: 950; cursor: pointer; }
        .range-mode-tab.active { background: #148bd8; color: #fff; }
        .single-range-card { border: 1px solid #e1e7ef; background: #f8fbff; border-radius: 16px; padding: 14px; margin-bottom: 14px; }
        .checkout-line { display: grid; grid-template-columns: 1fr 92px; gap: 10px; align-items: center; padding: 10px 0; border-bottom: 1px solid #edf0f4; }
        .checkout-line:last-child { border-bottom: none; }
        .checkout-section-total { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #1478c8; font-size: 13px; font-weight: 950; padding: 10px 0 0; }
        .checkout-section-total strong { white-space: nowrap; }
        .checkout-input, .checkout-select, .checkout-note { width: 100%; border: 1px solid #dfe3ea; border-radius: 10px; padding: 9px 10px; font-size: 14px; box-sizing: border-box; background: #fff; color: #1f2937; }
        .checkout-note { min-height: 70px; resize: none; margin-top: 8px; }
        .checkout-section-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
        .service-picker-box { display: grid; gap: 8px; margin: 8px 0 4px; }
        .service-picker-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; }
        .service-add-btn { border: none; background: #1478c8; color: #fff; border-radius: 10px; padding: 10px 12px; font-size: 13px; font-weight: 950; cursor: pointer; white-space: nowrap; }
        .product-picker-toggle { border: 1px solid #148bd8; background: #fff; color: #1478c8; border-radius: 999px; padding: 6px 10px; font-size: 12px; font-weight: 950; cursor: pointer; white-space: nowrap; }
        .product-picker-hint { color: #8b95a3; font-size: 12px; font-weight: 800; line-height: 1.45; margin-bottom: 10px; }
        .product-search { margin-bottom: 8px; }
        .product-category-tabs { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 8px; }
        .product-category-chip { border: 1px solid #dfe3ea; background: #fff; color: #6b7280; border-radius: 999px; padding: 6px 10px; font-size: 11px; font-weight: 900; cursor: pointer; white-space: nowrap; }
        .product-category-chip.active { border-color: #148bd8; background: #eaf7ff; color: #1478c8; }
        .product-list { display: grid; gap: 8px; max-height: 260px; overflow-y: auto; padding-right: 2px; }
        .product-item { border: 1px solid #e1e7ef; border-radius: 12px; background: #fff; overflow: hidden; }
        .product-item.selected { border-color: #148bd8; background: #f1f8ff; }
        .product-pick-row { width: 100%; border: none; background: transparent; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 11px; color: #1f2937; text-align: left; cursor: pointer; font-family: inherit; }
        .product-name { font-size: 13px; font-weight: 950; margin-bottom: 3px; }
        .product-meta { color: #8b95a3; font-size: 11px; font-weight: 800; }
        .product-check { width: 22px; height: 22px; border: 1.5px solid #dfe3ea; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; color: #fff; font-size: 12px; font-weight: 950; flex: 0 0 auto; }
        .product-item.selected .product-check { border-color: #148bd8; background: #148bd8; }
        .product-checkout-lines { margin-top: 10px; border-top: 1px solid #edf0f4; }
        .product-price-line { display: grid; grid-template-columns: 1fr 64px 92px; gap: 8px; align-items: center; padding: 10px 0; border-bottom: 1px solid #edf0f4; }
        .product-quantity-field { display: grid; gap: 3px; }
        .product-quantity-label { color: #8b95a3; font-size: 10px; font-weight: 900; text-align: center; }
        .product-subtotal { display: flex; justify-content: flex-end; color: #1478c8; font-size: 13px; font-weight: 950; white-space: nowrap; padding: 8px 0 2px; }
        .selected-product-summary { margin-top: 8px; padding-top: 8px; border-top: 1px solid #edf0f4; display: grid; gap: 5px; }
        .selected-product-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #4b5563; font-size: 12px; font-weight: 850; }
        .selected-product-row strong { color: #1478c8; font-weight: 950; white-space: nowrap; }
        .product-empty { color: #8b95a3; font-size: 12px; font-weight: 800; padding: 10px; text-align: center; }
        .self-use-lines { margin-top: 10px; border-top: 1px solid #edf0f4; }
        .self-use-summary { margin-top: 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #ef244e; font-size: 14px; font-weight: 950; }
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

function Header({ profile, onOpenSettings }: { profile: DesignerProfile; onOpenSettings: () => void }) {
  return (
    <header className="top-bar">
      <button className="brand-area" onClick={onOpenSettings} aria-label="開啟個人設定">
        <AvatarPreview avatarUrl={profile.avatarUrl} />
        <span className="designer-identity">
          <span className="designer-name">{profile.name}</span>
          <span className="designer-role">{profile.role}</span>
        </span>
      </button>
      <button className="logout-btn">登出</button>
    </header>
  );
}

function SettingsView({ profile, priceItems, priceCategoryOrder, onProfileChange, onAvatarUpload, isSynced, leaveItems, onAddLeave, onBack }: { profile: DesignerProfile; priceItems: BackendDesignerPriceItem[]; priceCategoryOrder: string[]; onProfileChange: (profile: DesignerProfile) => void | Promise<void>; onAvatarUpload?: (file: File) => Promise<string | null>; isSynced: boolean; leaveItems: CalendarRecords<LeaveItem>; onAddLeave: (date: string, item: LeaveItem) => void | Promise<void>; onBack: () => void }) {
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
      {activePanel === "profile" ? <ProfileSettingsPanel profile={profile} priceItems={priceItems} priceCategoryOrder={priceCategoryOrder} onProfileChange={onProfileChange} onAvatarUpload={onAvatarUpload} isSynced={isSynced} /> : <RosterSettingsPanel leaveItems={leaveItems} onAddLeave={onAddLeave} />}
    </>
  );
}

function ProfileSettingsPanel({ profile, priceItems, priceCategoryOrder, onProfileChange, onAvatarUpload, isSynced }: { profile: DesignerProfile; priceItems: BackendDesignerPriceItem[]; priceCategoryOrder: string[]; onProfileChange: (profile: DesignerProfile) => void | Promise<void>; onAvatarUpload?: (file: File) => Promise<string | null>; isSynced: boolean }) {
  const [draft, setDraft] = useState(profile);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  function updateDraft(key: keyof DesignerProfile, value: string) {
    setSaved(false);
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function changeAvatar(file: File | null) {
    if (!file) return;
    if (onAvatarUpload) {
      setUploading(true);
      const publicUrl = await onAvatarUpload(file);
      if (publicUrl) updateDraft("avatarUrl", publicUrl);
      setUploading(false);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateDraft("avatarUrl", String(reader.result || ""));
    };
    reader.readAsDataURL(file);
  }

  async function saveProfile() {
    setSaving(true);
    await onProfileChange(draft);
    setSaving(false);
    setSaved(true);
  }

  return (
    <section className="panel">
      <div className="panel-label">個人資料</div>
      <div className="profile-editor-head">
        <AvatarPreview avatarUrl={draft.avatarUrl} size="large" />
        <label className="avatar-upload-btn">
          {uploading ? "上傳中..." : "變更大頭照"}
          <input type="file" accept="image/*" onChange={(event) => changeAvatar(event.target.files?.[0] || null)} />
        </label>
      </div>
      <div className="profile-grid">
        <ProfileInput label="顯示名稱" value={draft.name} onChange={(value) => updateDraft("name", value)} />
        <ProfileInput label="職稱" value={draft.role} onChange={(value) => updateDraft("role", value)} />
        <ProfileInput label="電話" value={draft.phone} onChange={(value) => updateDraft("phone", value)} />
        <ProfileInput label="專長" value={draft.specialties} onChange={(value) => updateDraft("specialties", value)} />
        <ReadOnlyProfileCard label="加入日期" value={formatProfileDate(draft.joinedDate)} wide />
      </div>
      <DesignerPriceListCard priceItems={priceItems} priceCategoryOrder={priceCategoryOrder} />
      <div className="profile-note">{isSynced ? "目前已連線後台，儲存後會同步顯示在顧客預約端與後台設計師資料。" : "後台尚未連線，請重新整理後再操作。"}</div>
      <button className="full-width-btn" onClick={saveProfile}>{saving ? "同步中..." : saved ? "已更新個人資訊" : "儲存個人資訊"}</button>
    </section>
  );
}

function ReadOnlyProfileCard({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`readonly-profile-card${wide ? " wide" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DesignerPriceListCard({ priceItems, priceCategoryOrder }: { priceItems: BackendDesignerPriceItem[]; priceCategoryOrder: string[] }) {
  const activeItems = sortDesignerPriceItems(priceItems.filter((item) => item.is_active !== false), priceCategoryOrder);
  const groupedItems = activeItems.reduce<Record<string, BackendDesignerPriceItem[]>>((groups, item) => {
    const category = item.category || "其他服務";
    groups[category] = [...(groups[category] || []), item];
    return groups;
  }, {});
  const categories = sortPriceCategories(Object.keys(groupedItems), priceCategoryOrder);

  return (
    <section className="price-list-card">
      <div className="price-list-head">
        <div className="price-list-title">我的價目表</div>
        <span className="readonly-badge">僅供查看</span>
      </div>
      <div className="price-list-subtitle">由後台同步，設計師端僅供查看。</div>
      {categories.length > 0 ? (
        <div className="price-accordion">
          {categories.map((category, index) => (
            <details className="price-category-panel" key={category} open={index === 0}>
              <summary className="price-category-summary">
                <span>{category}</span>
                <span className="price-category-count">{groupedItems[category].length} 項</span>
              </summary>
              <div className="price-list-rows">
                {groupedItems[category].map((item) => (
                  <div className="price-list-row" key={item.id}>
                    <span className="price-name">{item.name}</span>
                    <span className="price-value">{formatPriceRange(item.price_range)}</span>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <div className="price-empty">目前後台尚未設定價目表</div>
      )}
      <div className="price-note">溫馨提醒：染、燙、護髮服務依髮長、髮量及實際需求調整收費。長度超過鎖骨下或特殊髮況，將由設計師現場評估報價。</div>
      <div className="profile-note" style={{ margin: "10px 0 0" }}>價格由後台管理，如需調整請聯繫管理人員。</div>
    </section>
  );
}

function RosterSettingsPanel({ leaveItems, onAddLeave }: { leaveItems: CalendarRecords<LeaveItem>; onAddLeave: (date: string, item: LeaveItem) => void | Promise<void> }) {
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [rosterMonth, setRosterMonth] = useState(() => new Date().toLocaleDateString("en-CA").slice(0, 7));
  const [draft, setDraft] = useState<LeaveDraft>({
    date: new Date().toLocaleDateString("en-CA"),
    type: "整天休假",
    startTime: "13:00",
    endTime: "17:00",
    note: "",
  });
  const [year, month] = rosterMonth.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const rosterCells: (string | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => formatDateKey(year, month, index + 1)),
  ];
  while (rosterCells.length % 7 !== 0) rosterCells.push(null);
  const leaveRows = Object.entries(leaveItems).flatMap(([date, items]) =>
    items.map((item) => ({ date, item }))
  ).sort((a, b) => a.date.localeCompare(b.date));

  async function submitLeave() {
    const isFullDay = draft.type === "整天休假";
    const text = isFullDay ? "整天休假" : `${draft.startTime}-${draft.endTime} 不接客`;
    await onAddLeave(draft.date, { text, tone: isFullDay ? "day-off" : "blocked", designer: "Cherry" });
    setShowLeaveForm(false);
  }

  function changeRosterMonth(offset: number) {
    const next = new Date(year, month - 1 + offset, 1);
    setRosterMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
  }

  function openLeaveForm(date: string) {
    setDraft((prev) => ({ ...prev, date }));
    setShowLeaveForm(true);
  }

  return (
    <section className="panel">
      <div className="panel-label">排班表</div>
      <div className="calendar-header">
        <button className="circle-nav" onClick={() => changeRosterMonth(-1)}>‹</button>
        <div className="month-title">{year}年{month}月</div>
        <button className="circle-nav" onClick={() => changeRosterMonth(1)}>›</button>
      </div>
      <div className="weekday-grid">
        {["日", "一", "二", "三", "四", "五", "六"].map((day) => <div key={day}>{day}</div>)}
      </div>
      <div className="roster-calendar">
        {rosterCells.map((fullDate, index) => {
          if (!fullDate) return <div className="roster-day empty" key={`empty-${index}`} />;
          const date = Number(fullDate.split("-")[2]);
          const items = leaveItems[fullDate] || [];
          const toneClass = items.some((item) => item.tone === "day-off") ? "has-leave" : items.length > 0 ? "has-blocked" : "";
          return (
            <button className={`roster-day ${toneClass}`} key={fullDate} onClick={() => openLeaveForm(fullDate)}>
              <span>{date}</span>
              {items.map((item) => <span className={`leave-chip ${item.tone}`} key={item.text}>{item.text}</span>)}
            </button>
          );
        })}
      </div>
      <div className="leave-list">
        {leaveRows.map(({ date, item }, index) => (
          <div className="leave-row" key={`${date}-${item.text}-${index}`}>
            <strong>{formatScheduleDateLabel(date)}</strong>
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
          <div className="page-subtitle">{formatTodaySubtitle()}</div>
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

function PendingView({ rows, decisions, pendingCount, isManager, pendingScope, onScopeChange, onOpen }: { rows: PendingRow[]; decisions: Record<string, PendingDecision>; pendingCount: number; isManager: boolean; pendingScope: PendingScope; onScopeChange: (scope: PendingScope) => void; onOpen: (row: PendingRow) => void }) {
  return (
    <>
      <h1 className="page-title">待確認</h1>
      <div className="page-subtitle">目前有 {pendingCount} 筆預約待回覆</div>
      {isManager && (
        <div className="pending-scope-tabs" aria-label="待確認範圍">
          <button className={`pending-scope-btn ${pendingScope === "self" ? "active" : ""}`} onClick={() => onScopeChange("self")}>我的待確認</button>
          <button className={`pending-scope-btn ${pendingScope === "team" ? "active" : ""}`} onClick={() => onScopeChange("team")}>全員待確認</button>
        </div>
      )}
      <section className="pending-list">
        {rows.map((row) => {
          const decision = decisions[row.key] || "pending";
          return (
            <div className={`pending-card ${decision !== "pending" ? "is-done" : ""}`} key={`${row.time}-${row.name}`}>
              <div className="row-time">
                <span className="row-date">{row.date}</span>
                {row.time}
              </div>
              <div>
                <div className="row-name">{row.name}</div>
                {row.designer && <div className="pending-designer">設計師：{row.designer}</div>}
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

function CalendarView({ mode, selectedDate, scheduleItems, teamScheduleItemsSource, leaveItems, teamLeaveItemsSource, isManager, designerName, onModeChange, onSelectDate, onAddBooking }: { mode: ScheduleMode; selectedDate: string; scheduleItems: CalendarRecords<ScheduleItem>; teamScheduleItemsSource: CalendarRecords<ScheduleItem>; leaveItems: CalendarRecords<LeaveItem>; teamLeaveItemsSource: CalendarRecords<LeaveItem>; isManager: boolean; designerName: string; onModeChange: (mode: ScheduleMode) => void; onSelectDate: (date: string) => void; onAddBooking: (date: string, time?: string) => void }) {
  const [scope, setScope] = useState<"自己" | "全員">("自己");
  const visibleScheduleItems = scope === "全員" ? mergeCalendarRecords(scheduleItems, teamScheduleItemsSource) : filterCalendarRecords(scheduleItems, designerName);
  const visibleLeaveItems = scope === "全員" ? mergeCalendarRecords(leaveItems, teamLeaveItemsSource) : filterCalendarRecords(leaveItems, designerName);

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
      {isManager && <div className="manager-scope-card">
        <div>
          <div className="manager-scope-title">店長權限</div>
          <div className="manager-scope-subtitle">{scope === "全員" ? "查看全店設計師預約與排休" : "只查看自己的預約與排休"}</div>
        </div>
        <div className="scope-toggle" aria-label="切換排程視角">
          {(["自己", "全員"] as const).map((item) => (
            <button className={scope === item ? "active" : ""} key={item} onClick={() => setScope(item)}>{item}</button>
          ))}
        </div>
      </div>}
      {mode === "月" ? (
        <MonthSchedule selectedDate={selectedDate} scheduleItems={visibleScheduleItems} leaveItems={visibleLeaveItems} showDesigner={scope === "全員"} onSelectDate={onSelectDate} />
      ) : (
        <CompactSchedule mode={mode} selectedDate={selectedDate} scheduleItems={visibleScheduleItems} leaveItems={visibleLeaveItems} showDesigner={scope === "全員"} onSelectDate={onSelectDate} />
      )}
    </>
  );
}

function MonthSchedule({ selectedDate, scheduleItems, leaveItems, showDesigner, onSelectDate }: { selectedDate: string; scheduleItems: CalendarRecords<ScheduleItem>; leaveItems: CalendarRecords<LeaveItem>; showDesigner: boolean; onSelectDate: (date: string) => void }) {
  const [year, month] = selectedDate.split("-").map(Number);
  const selectedDay = Number(selectedDate.split("-")[2]);
  const selectedItems = getCalendarItems(selectedDate, scheduleItems, leaveItems);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <>
      <div className="calendar-header">
        <button className="circle-nav">‹</button>
        <div className="month-title">{year}年{month}月</div>
        <button className="circle-nav">›</button>
      </div>
      <div className="weekday-grid">
        {["日", "一", "二", "三", "四", "五", "六"].map((day) => <div key={day}>{day}</div>)}
      </div>
      <div className="calendar-grid">
        {cells.map((date, index) => {
          if (!date) return <div className="day-cell empty" key={`empty-${index}`} />;
          const fullDate = `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
          const items = getCalendarItems(fullDate, scheduleItems, leaveItems);
          return (
            <div className={`day-cell can-add ${date === selectedDay ? "selected" : ""}`} key={date} onClick={() => onSelectDate(fullDate)}>
              <span className="date-badge">{date}</span>
              {items.map((item) => <span className={`schedule-bar ${item.tone}`} key={item.text}>{item.text}</span>)}
            </div>
          );
        })}
      </div>
      <Legend />
      <SelectedDayPanel selectedDate={selectedDate} items={selectedItems} showDesigner={showDesigner} />
    </>
  );
}

function CompactSchedule({ mode, selectedDate, scheduleItems, leaveItems, showDesigner, onSelectDate }: { mode: Exclude<ScheduleMode, "月">; selectedDate: string; scheduleItems: CalendarRecords<ScheduleItem>; leaveItems: CalendarRecords<LeaveItem>; showDesigner: boolean; onSelectDate: (date: string) => void }) {
  const days = mode === "3日" ? 3 : 7;
  const baseDate = new Date(`${selectedDate}T00:00:00+08:00`);
  const rows = Array.from({ length: days }, (_, index) => {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + index);
    const fullDate = formatDateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
    const items = getCalendarItems(fullDate, scheduleItems, leaveItems).map((item) => item.text);
    return {
      day: formatScheduleDateLabel(fullDate),
      date: fullDate,
      items,
    };
  });

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
            <div className="row-service">{row.items.length > 0 ? row.items.join("、") : "目前沒有預約"}</div>
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
      <SelectedDayPanel selectedDate={selectedDate} items={getCalendarItems(selectedDate, scheduleItems, leaveItems)} showDesigner={showDesigner} />
    </>
  );
}

function SelectedDayPanel({ selectedDate, items, showDesigner }: { selectedDate: string; items: CalendarItem[]; showDesigner: boolean }) {
  return (
    <section className="compact-section">
      <div className="selected-day-title">
        <div className="selected-day-date">{formatScheduleDateLabel(selectedDate)}</div>
      </div>
      {items.length > 0 ? (
        items.map((item) => {
          const [time, ...serviceParts] = item.text.split(" ");
          const isLeave = item.category === "leave";
          const rawDetail = isLeave ? item.text : serviceParts.join(" ");
          const detail = showDesigner && item.designer ? rawDetail.replace(new RegExp(`^${item.designer}\\s*`), "") : rawDetail;
          return (
            <div className={`timeline-row ${isLeave ? "leave-timeline-row" : ""}`} key={`${item.category}-${item.text}-${item.customer || ""}`}>
              <div className="row-time">{isLeave ? "排休" : time}</div>
              <div className="row-service schedule-detail">
                {isLeave ? (
                  <span>{detail}</span>
                ) : (
                  <>
                    <span className="detail-meta">
                      {showDesigner && item.designer ? <span className="detail-name">{item.designer}</span> : null}
                    </span>
                    <strong className="detail-service">
                      {item.customer ? <span className="detail-customer">{item.customer}</span> : null}
                      <span>{detail}</span>
                    </strong>
                  </>
                )}
              </div>
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

function EarningsView({ ranges, detailGroups, customRange, onCustomRangeChange, onOpenSelfUse }: { ranges: Record<EarningsRange, EarningsData>; detailGroups?: IncomeDetailGroupsByRange | null; customRange: IncomeDateRange; onCustomRangeChange: (range: IncomeDateRange) => void; onOpenSelfUse: () => void }) {
  const [activeRange, setActiveRange] = useState<EarningsRange>("本月");
  const [showRangePicker, setShowRangePicker] = useState(false);
  const [showIncomeDetails, setShowIncomeDetails] = useState(false);
  const currentRange = ranges[activeRange];
  const totalPerformance = currentRange.service + currentRange.product;
  const incomeLabel = `${activeRange === "指定日期或區間" ? "查詢" : activeRange}實際收入`;

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
        {(["今日", "本月"] as EarningsRange[]).map((tab) => (
          <button className={`income-segment ${activeRange === tab ? "active" : ""}`} key={tab} onClick={() => {
            setActiveRange(tab);
          }}>{tab}</button>
        ))}
      </div>
      <div className="summary-grid">
        <div className="summary-card"><div className="summary-amount">NT$ {totalPerformance.toLocaleString()}</div><div className="summary-title">總業績</div><div className="summary-sub">服務業績 NT${currentRange.service.toLocaleString()} · 商品銷售 NT${currentRange.product.toLocaleString()}</div></div>
        <div className="summary-card"><div className="summary-amount purple">NT$ {currentRange.salary.toLocaleString()}</div><div className="summary-title purple">{incomeLabel}</div><div className="summary-sub">扣除自領商品與折扣</div></div>
      </div>
      <div className="earnings-action-row">
        <button className="earnings-action-btn primary" onClick={() => setShowIncomeDetails(true)}>查看明細</button>
        <button className="earnings-action-btn" onClick={onOpenSelfUse}>自領材料</button>
        <button className="earnings-action-btn muted" type="button">其他功能</button>
      </div>
      <section className="panel">
        <div className="income-detail-header">
          <div className="panel-label">{currentRange.label}｜總客數：{currentRange.count}</div>
        </div>
        <div className="breakdown-row"><span>服務業績</span><span>NT${currentRange.service.toLocaleString()}</span></div>
        <div className="breakdown-row"><span>商品銷售</span><span>NT${currentRange.product.toLocaleString()}</span></div>
        <div className="breakdown-row deduction-row"><span>自領商品</span><span>-NT${currentRange.selfUse.toLocaleString()}</span></div>
        <div className="breakdown-row deduction-row"><span>折扣金額</span><span>-NT${currentRange.discount.toLocaleString()}</span></div>
        <div className="breakdown-row"><span>{incomeLabel}</span><span>NT${currentRange.salary.toLocaleString()}</span></div>
      </section>
      {showRangePicker && (
        <RangePickerModal
          ranges={ranges}
          customRange={customRange}
          onCustomRangeChange={(range) => {
            onCustomRangeChange(range);
            setActiveRange("指定日期或區間");
            setShowRangePicker(false);
          }}
          onClose={() => setShowRangePicker(false)}
        />
      )}
      {showIncomeDetails && <IncomeDetailsModal range={activeRange} ranges={ranges} detailGroups={detailGroups} onClose={() => setShowIncomeDetails(false)} />}
    </>
  );
}

function IncomeDetailsModal({ range, ranges, detailGroups, onClose }: { range: EarningsRange; ranges: Record<EarningsRange, EarningsData>; detailGroups?: IncomeDetailGroupsByRange | null; onClose: () => void }) {
  const currentRange = ranges[range];
  const fallbackGroups: IncomeDetailGroup[] = [
    { title: "服務明細", rows: [] },
    { title: "商品銷售明細", rows: [] },
    { title: "自領商品明細", rows: [] },
  ];
  const visibleGroups = detailGroups?.[range] || fallbackGroups;

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
          {visibleGroups.map((group) => (
            <section className="income-detail-section" key={group.title}>
              <div className="income-detail-title">{group.title}</div>
              {group.rows.length > 0 ? group.rows.map((row) => (
                <div className="income-detail-row" key={`${group.title}-${row.date || ""}-${row.name}-${row.item}`}>
                  <strong>{row.date || "-"}</strong>
                  <strong>{row.name}</strong>
                  <span>{row.item}</span>
                  <em>{row.amount}</em>
                </div>
              )) : <div className="income-detail-row"><strong>-</strong><strong>-</strong><span>目前沒有明細</span><em>-</em></div>}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function SelfUseMaterialModal({ products, complete, isSynced, onComplete, onClose }: { products: BackendProduct[]; complete: boolean; isSynced: boolean; onComplete: (items: SelfUseMaterialItem[]) => void | Promise<void>; onClose: () => void }) {
  const [items, setItems] = useState<SelfUseMaterialItem[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("全部");
  const [saving, setSaving] = useState(false);
  const categories = ["全部", ...Array.from(new Set(products.map((product) => product.category || "未分類").filter(Boolean)))];
  const filteredProducts = products.filter((product) => {
    const itemCategory = product.category || "未分類";
    const keyword = search.trim().toLowerCase();
    if (product.is_active === false) return false;
    if (category !== "全部" && itemCategory !== category) return false;
    if (keyword && !`${product.name} ${itemCategory}`.toLowerCase().includes(keyword)) return false;
    return true;
  });
  const total = items.reduce((sum, item) => sum + item.product.unit_price * item.quantity, 0);

  function toggleProduct(product: BackendProduct) {
    const selected = items.find((item) => item.product.id === product.id);
    setItems(selected ? items.filter((item) => item.product.id !== product.id) : [...items, { product, quantity: 1 }]);
  }

  function updateQuantity(productId: number, quantity: number) {
    setItems(items.map((item) => item.product.id === productId ? { ...item, quantity: Math.max(1, quantity) } : item));
  }

  async function submit() {
    setSaving(true);
    await onComplete(items);
    setSaving(false);
  }

  if (complete) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
          <div className="complete-state">
            <div className="complete-icon">✓</div>
            <div className="modal-title">自領材料已同步</div>
            <div className="modal-subtitle">已寫入後台資料庫、同步扣庫存，並列入收入減項。</div>
          </div>
          <div className="amount-preview"><span>本次自領扣款</span><strong>-NT${total.toLocaleString()}</strong></div>
          <button className="full-width-btn" onClick={onClose}>完成</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">自領材料</div>
            <div className="modal-subtitle">從後台商品庫存選取，送出後同步扣庫存並列入收入減項。</div>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <input className="checkout-input product-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜尋材料或商品名稱..." />
        <div className="product-category-tabs">
          {categories.map((item) => (
            <button className={`product-category-chip${category === item ? " active" : ""}`} key={item} onClick={() => setCategory(item)}>
              {item}
            </button>
          ))}
        </div>
        <div className="product-list">
          {filteredProducts.length > 0 ? filteredProducts.map((product) => {
            const selected = items.find((item) => item.product.id === product.id);
            const unitText = product.unit ? ` / ${product.unit}` : "";
            return (
              <div className={`product-item${selected ? " selected" : ""}`} key={product.id}>
                <button className="product-pick-row" onClick={() => toggleProduct(product)}>
                  <span>
                    <span className="product-name">{product.name}</span>
                    <span className="product-meta">{product.category || "未分類"} · NT${product.unit_price.toLocaleString()}{unitText}</span>
                  </span>
                  <span className="product-check">{selected ? "✓" : ""}</span>
                </button>
              </div>
            );
          }) : (
            <div className="product-empty">找不到符合的材料</div>
          )}
        </div>
        {items.length > 0 && (
          <div className="self-use-lines">
            {items.map((item) => (
              <div className="product-price-line" key={item.product.id}>
                <div className="row-service">{item.product.name}</div>
                <label className="product-quantity-field">
                  <span className="product-quantity-label">數量</span>
                  <input className="checkout-input" type="number" min={1} value={item.quantity} onChange={(event) => updateQuantity(item.product.id, Number(event.target.value) || 1)} />
                </label>
                <input className="checkout-input" type="number" value={item.product.unit_price * item.quantity} readOnly />
              </div>
            ))}
            <div className="self-use-summary">
              <span>自領材料扣款</span>
              <strong>-NT${total.toLocaleString()}</strong>
            </div>
          </div>
        )}
        <div className="modal-action-row">
          <button className="secondary-modal-btn" onClick={onClose}>取消</button>
          <button className="primary-modal-btn" disabled={!isSynced || saving || items.length === 0} onClick={submit}>{isSynced ? saving ? "同步中..." : "確認自領" : "等待後台連線"}</button>
        </div>
      </div>
    </div>
  );
}

function RangePickerModal({ ranges, customRange, onCustomRangeChange, onClose }: { ranges: Record<EarningsRange, EarningsData>; customRange: IncomeDateRange; onCustomRangeChange: (range: IncomeDateRange) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(customRange);
  const [monthDraft, setMonthDraft] = useState(customRange.startDate.slice(0, 7));
  const [rangeMode, setRangeMode] = useState<"month" | "date">("month");

  function applyRange() {
    onCustomRangeChange(rangeMode === "month" ? getMonthIncomeDateRange(monthDraft) : normalizeIncomeDateRange(draft));
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">選擇收入區間</div>
            <div className="modal-subtitle">可選擇月份，或指定日期範圍</div>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="range-mode-tabs" aria-label="選擇收入查詢方式">
          <button className={`range-mode-tab ${rangeMode === "month" ? "active" : ""}`} onClick={() => setRangeMode("month")}>選擇月份</button>
          <button className={`range-mode-tab ${rangeMode === "date" ? "active" : ""}`} onClick={() => setRangeMode("date")}>日期區間</button>
        </div>
        <div className="single-range-card">
          {rangeMode === "month" ? (
            <>
            <div className="custom-range-title">月份</div>
            <div className="custom-range-subtitle">選擇整個月份收入</div>
            <div className="booking-field">
              <div className="booking-label">月份</div>
              <input className="checkout-input" type="month" value={monthDraft} onChange={(event) => setMonthDraft(event.target.value)} />
            </div>
            </>
          ) : (
            <>
            <div className="custom-range-title">指定日期或區間</div>
            <div className="custom-range-subtitle">{ranges["指定日期或區間"].period}</div>
            <div className="custom-range-grid">
              <label className="custom-range-label">
                開始日期
                <input type="date" value={draft.startDate} onChange={(event) => setDraft((prev) => ({ ...prev, startDate: event.target.value }))} />
              </label>
              <label className="custom-range-label">
                結束日期
                <input type="date" value={draft.endDate} onChange={(event) => setDraft((prev) => ({ ...prev, endDate: event.target.value }))} />
              </label>
            </div>
            </>
          )}
        </div>
        <button className="full-width-btn" onClick={applyRange}>套用</button>
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

function PendingConfirmModal({ row, decision, onDecide, onClose }: { row: PendingRow; decision: PendingDecision; onDecide: (row: PendingRow, decision: PendingDecision) => void | Promise<void>; onClose: () => void }) {
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
          {row.designer && <DetailCard label="設計師" value={row.designer} />}
          <DetailCard label="電話" value={row.phone} />
          <DetailCard label="服務項目" value={row.service} />
          <DetailCard label="顧客備註" value={row.detail} />
          <DetailCard label="翻譯中文" value={row.detail.includes("Please") ? "請讓顏色呈現自然棕色。" : "不需翻譯"} />
        </div>
        {decision === "pending" ? (
          <div className="modal-action-row">
            <button className="secondary-modal-btn" onClick={async () => { await onDecide(row, "declined"); onClose(); }}>婉拒預約</button>
            <button className="primary-modal-btn" onClick={async () => { await onDecide(row, "accepted"); onClose(); }}>接受預約</button>
          </div>
        ) : (
          <div className={`decision-note ${decision}`}>{decision === "accepted" ? "此預約已接受" : "此預約已婉拒"}</div>
        )}
      </div>
    </div>
  );
}

function CheckoutModal({ row, serviceOptions, products, complete, isSynced, onComplete, onClose }: { row: Appointment; serviceOptions: CheckoutServiceOption[]; products: BackendProduct[]; complete: boolean; isSynced: boolean; onComplete: (draft: CheckoutDraft, total: number) => void | Promise<void>; onClose: () => void }) {
  const matchedMainService = findCheckoutServiceOption(row.service, serviceOptions);
  const [draft, setDraft] = useState<CheckoutDraft>({
    primaryServiceName: matchedMainService?.name || row.service,
    serviceAmount: matchedMainService?.amount || 0,
    serviceDiscount: 0,
    extraServiceItems: [],
    productItems: [],
    paymentMethod: "現金",
    note: "",
  });
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [selectedServiceKey, setSelectedServiceKey] = useState(serviceOptions[0]?.key || "");
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productCategory, setProductCategory] = useState("全部");
  const productCategories = ["全部", ...Array.from(new Set(products.map((product) => product.category || "未分類").filter(Boolean)))];
  const filteredProducts = products.filter((product) => {
    const category = product.category || "未分類";
    const keyword = productSearch.trim().toLowerCase();
    if (productCategory !== "全部" && category !== productCategory) return false;
    if (keyword && !`${product.name} ${category}`.toLowerCase().includes(keyword)) return false;
    return product.is_active !== false;
  });
  const productSubtotal = draft.productItems.reduce((sum, item) => sum + Math.max(0, item.linePrice - item.discount), 0);
  const serviceGross = draft.serviceAmount + draft.extraServiceItems.reduce((sum, item) => sum + item.amount, 0);
  const serviceSubtotal = Math.max(0, serviceGross - draft.serviceDiscount);
  const total = serviceSubtotal + productSubtotal;

  function addServiceItem() {
    const selectedService = serviceOptions.find((service) => service.key === selectedServiceKey) || serviceOptions[0];
    if (!selectedService) {
      alert("後台尚未設定可加入的服務價目。");
      return;
    }
    const name = selectedService?.name || "其他服務";
    setDraft({
      ...draft,
      extraServiceItems: [...draft.extraServiceItems, { name, amount: selectedService?.amount || 0 }],
    });
    setShowServicePicker(false);
  }

  function updateExtraService(index: number, value: number) {
    setDraft({
      ...draft,
      extraServiceItems: draft.extraServiceItems.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        return { ...item, amount: Math.max(0, value) };
      }),
    });
  }

  function toggleProduct(product: BackendProduct) {
    const exists = draft.productItems.find((item) => item.product.id === product.id);
    setDraft({
      ...draft,
      productItems: exists
        ? draft.productItems.filter((item) => item.product.id !== product.id)
        : [...draft.productItems, { product, quantity: 1, linePrice: product.unit_price, discount: 0 }],
    });
    setShowProductPicker(false);
  }

  function updateProductQuantity(productId: number, value: number) {
    setDraft({
      ...draft,
      productItems: draft.productItems.map((item) => {
        if (item.product.id !== productId) return item;
        const quantity = Math.max(1, value);
        const linePrice = item.product.unit_price * quantity;
        return { ...item, quantity, linePrice, discount: Math.min(item.discount, linePrice) };
      }),
    });
  }

  function updateProductPrice(productId: number, value: number) {
    setDraft({
      ...draft,
      productItems: draft.productItems.map((item) => {
        if (item.product.id !== productId) return item;
        const linePrice = Math.max(0, value);
        return { ...item, linePrice, discount: Math.min(item.discount, linePrice) };
      }),
    });
  }

  function updateProductDiscount(productId: number, value: number) {
    setDraft({
      ...draft,
      productItems: draft.productItems.map((item) => {
        if (item.product.id !== productId) return item;
        const originalTotal = item.linePrice;
        return { ...item, discount: Math.min(Math.max(0, value), originalTotal) };
      }),
    });
  }

  if (complete) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
          <div className="complete-state">
            <div className="complete-icon">✓</div>
            <div className="modal-title">結帳已同步完成</div>
            <div className="modal-subtitle">{row.name} 的交易已寫入後台，今日與收入會同步更新。</div>
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
          <div className="checkout-section-head">
            <div className="panel-label">服務項目</div>
            <button className="product-picker-toggle" onClick={() => setShowServicePicker(!showServicePicker)}>
              {showServicePicker ? "收起服務" : "選取服務"}
            </button>
          </div>
          {showServicePicker && (
            <div className="service-picker-box">
              <div className="service-picker-row">
                <select className="checkout-select" value={selectedServiceKey} onChange={(event) => setSelectedServiceKey(event.target.value)}>
                  {serviceOptions.map((service) => <option key={service.key} value={service.key}>{service.name}｜{service.priceLabel}</option>)}
                  {serviceOptions.length === 0 && <option>後台尚未設定服務價目</option>}
                </select>
                <button className="service-add-btn" onClick={addServiceItem}>加入</button>
              </div>
            </div>
          )}
          <CheckoutNumber label={draft.primaryServiceName} value={draft.serviceAmount} onChange={(value) => setDraft({ ...draft, serviceAmount: value })} />
          {draft.extraServiceItems.map((item, index) => (
            <div key={`${item.name}-${index}`}>
              <CheckoutNumber label={item.name} value={item.amount} onChange={(value) => updateExtraService(index, value)} />
            </div>
          ))}
          <CheckoutNumber label="服務折扣" value={draft.serviceDiscount} onChange={(value) => setDraft({ ...draft, serviceDiscount: Math.min(Math.max(0, value), serviceGross) })} />
          <div className="checkout-section-total">
            <span>服務項目小計</span>
            <strong>NT${serviceSubtotal.toLocaleString()}</strong>
          </div>
        </section>
        <section className="panel">
          <div className="checkout-section-head">
            <div className="panel-label">客人購買商品</div>
            <button className="product-picker-toggle" onClick={() => setShowProductPicker(!showProductPicker)}>
              {showProductPicker ? "收起商品" : "選取商品"}
            </button>
          </div>
          <div className="product-picker-hint">商品品項由後台同步，可打字搜尋，也可用分類快速找。</div>
          {showProductPicker && (
            <>
              <input className="checkout-input product-search" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="搜尋商品名稱或分類..." />
              <div className="product-category-tabs">
                {productCategories.map((category) => (
                  <button className={`product-category-chip${productCategory === category ? " active" : ""}`} key={category} onClick={() => setProductCategory(category)}>
                    {category}
                  </button>
                ))}
              </div>
              <div className="product-list">
                {filteredProducts.length > 0 ? filteredProducts.map((product) => {
                  const selected = draft.productItems.find((item) => item.product.id === product.id);
                  const unitText = product.unit ? ` / ${product.unit}` : "";
                  return (
                    <div className={`product-item${selected ? " selected" : ""}`} key={product.id}>
                      <button className="product-pick-row" onClick={() => toggleProduct(product)}>
                        <span>
                          <span className="product-name">{product.name}</span>
                          <span className="product-meta">{product.category || "未分類"} · NT${product.unit_price.toLocaleString()}{unitText}</span>
                        </span>
                        <span className="product-check">{selected ? "✓" : ""}</span>
                      </button>
                    </div>
                  );
                }) : (
                  <div className="product-empty">找不到符合的商品</div>
                )}
              </div>
            </>
          )}
          {draft.productItems.length > 0 && (
            <div className="product-checkout-lines">
              {draft.productItems.map((item) => (
                <div key={item.product.id}>
                  <CheckoutProductNumber label={item.product.name} quantity={item.quantity} price={item.linePrice} onQuantityChange={(value) => updateProductQuantity(item.product.id, value)} onPriceChange={(value) => updateProductPrice(item.product.id, value)} />
                  <CheckoutNumber label="商品折扣" value={item.discount} onChange={(value) => updateProductDiscount(item.product.id, value)} />
                </div>
              ))}
              <div className="selected-product-summary">
                <div className="selected-product-row">
                  <span>商品實收小計</span>
                  <strong>+NT${productSubtotal.toLocaleString()}</strong>
                </div>
              </div>
            </div>
          )}
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
          <button className="primary-modal-btn" disabled={!isSynced} onClick={() => onComplete(draft, total)}>{isSynced ? "建立並同步交易" : "等待後台連線"}</button>
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

function CheckoutProductNumber({ label, quantity, price, onQuantityChange, onPriceChange }: { label: string; quantity: number; price: number; onQuantityChange: (value: number) => void; onPriceChange: (value: number) => void }) {
  return (
    <div className="product-price-line">
      <div className="row-service">{label}</div>
      <label className="product-quantity-field">
        <span className="product-quantity-label">數量</span>
        <input className="checkout-input" type="number" min={1} value={quantity} onChange={(event) => onQuantityChange(Number(event.target.value) || 1)} />
      </label>
      <input className="checkout-input" type="number" value={price} onChange={(event) => onPriceChange(Number(event.target.value) || 0)} />
    </div>
  );
}

function AddBookingModal({ draft, complete, designerOptions, serviceOptions, customerRecords, isSynced, onChange, onComplete, onClose }: { draft: BookingDraft; complete: boolean; designerOptions: string[]; serviceOptions: string[]; customerRecords: CustomerRecord[]; isSynced: boolean; onChange: (draft: BookingDraft) => void; onComplete: () => void; onClose: () => void }) {
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
      service: customer.lastService || draft.service,
      note: customer.note,
    });
  }

  if (complete) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
          <div className="complete-state">
            <div className="complete-icon">✓</div>
            <div className="modal-title">預約已同步建立</div>
            <div className="modal-subtitle">已寫入後台預約資料，排程與後台會同步更新。</div>
          </div>
          <div className="detail-grid">
            <DetailCard label="客人" value={draft.name || "未填姓名"} />
            <DetailCard label="日期時間" value={`${draft.date} ${draft.time}`} />
            <DetailCard label="設計師" value={draft.designer} />
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
            <div className="modal-subtitle">店長可指定要安排給哪位設計師</div>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="booking-field">
          <div className="booking-label">安排設計師</div>
          <select className="checkout-select" value={draft.designer} onChange={(event) => onChange({ ...draft, designer: event.target.value })}>
            {designerOptions.map((designer) => <option key={designer}>{designer}</option>)}
          </select>
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
            {serviceOptions.map((item) => <option key={item}>{item}</option>)}
            {serviceOptions.length === 0 && <option>後台尚未設定服務項目</option>}
          </select>
        </div>
        <div className="booking-field">
          <div className="booking-label">備註</div>
          <textarea className="checkout-note" value={draft.note} onChange={(event) => onChange({ ...draft, note: event.target.value })} placeholder="特殊需求、現場安排、顧客偏好..." />
        </div>
        <div className="modal-action-row">
          <button className="secondary-modal-btn" onClick={onClose}>取消</button>
          <button className="primary-modal-btn" disabled={!isSynced || serviceOptions.length === 0} onClick={onComplete}>{isSynced ? "建立並同步預約" : "等待後台連線"}</button>
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

function createBookingDraft(date = new Date().toLocaleDateString("en-CA"), time = "10:00", designer = "Cherry", service = "剪髮（含髮浴）"): BookingDraft {
  return {
    date,
    time,
    designer,
    name: "",
    phone: "",
    service,
    note: "",
  };
}

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getDesignerLabel(designer: BackendDesigner) {
  return designer.display_name || designer.name;
}

async function resolveDesignerSession(): Promise<DesignerSession | null> {
  const sessionText = window.sessionStorage.getItem("designerSession");
  if (sessionText) {
    try {
      return JSON.parse(sessionText) as DesignerSession;
    } catch {
      window.sessionStorage.removeItem("designerSession");
    }
  }

  const { data, error } = await supabase
    .from("designers")
    .select("id, name, nickname, is_manager")
    .eq("is_active", true)
    .order("sort_order", { nullsFirst: false })
    .order("id")
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id,
    name: data.name,
    nickname: data.nickname || "設計師",
    is_manager: data.is_manager || false,
  };
}

function findDesignerByLabel(designers: BackendDesigner[], label: string) {
  return designers.find((designer) => [designer.display_name, designer.name, designer.nickname].filter(Boolean).includes(label));
}

function mapBookingsToCalendar(bookings: BackendBooking[], services: BackendService[], designers: BackendDesigner[]): CalendarRecords<ScheduleItem> {
  return bookings.reduce<CalendarRecords<ScheduleItem>>((records, booking) => {
    const designer = designers.find((item) => item.id === booking.designer_id);
    const designerName = booking.designers?.display_name || booking.designers?.name || (designer ? getDesignerLabel(designer) : "未指定");
    const serviceName = getServiceNamesFromBackend(booking.service_ids || [], services, booking.note);
    const text = `${booking.booking_time} ${designerName} ${serviceName}`;
    records[booking.booking_date] = [...(records[booking.booking_date] || []), {
      text,
      tone: getServiceTone(serviceName),
      designer: designerName,
      customer: booking.customer_name || "訪客",
    }].sort((a, b) => a.text.localeCompare(b.text));
    return records;
  }, {});
}

function mapLeavesToCalendar(offDays: BackendOffDay[], offSlots: BackendOffSlot[], designers: BackendDesigner[]): CalendarRecords<LeaveItem> {
  const records: CalendarRecords<LeaveItem> = {};
  offDays.forEach((item) => {
    const designer = designers.find((target) => target.id === item.designer_id);
    const designerName = designer ? getDesignerLabel(designer) : "設計師";
    records[item.off_date] = [...(records[item.off_date] || []), { text: `${designerName} 整天休假`, tone: "day-off", designer: designerName }];
  });
  const slotsByDesignerDate = offSlots.reduce<Record<string, BackendOffSlot[]>>((groups, item) => {
    const key = `${item.designer_id}-${item.slot_date}`;
    groups[key] = [...(groups[key] || []), item];
    return groups;
  }, {});
  Object.entries(slotsByDesignerDate).forEach(([, slots]) => {
    const first = slots[0];
    const designer = designers.find((target) => target.id === first.designer_id);
    const designerName = designer ? getDesignerLabel(designer) : "設計師";
    const sortedSlots = slots.map((item) => item.slot_time).sort();
    const label = sortedSlots.length > 1 ? `${sortedSlots[0]}-${sortedSlots[sortedSlots.length - 1]} 不接客` : `${sortedSlots[0]} 不接客`;
    records[first.slot_date] = [...(records[first.slot_date] || []), { text: `${designerName} ${label}`, tone: "blocked", designer: designerName }];
  });
  return records;
}

function mapBookingsToTodayRows(bookings: BackendBooking[], transactions: BackendTransaction[], services: BackendService[], designerId?: number): Appointment[] {
  const today = new Date().toLocaleDateString("en-CA");
  const paidBookingIds = new Set(transactions.map((transaction) => transaction.booking_id).filter(Boolean));
  return bookings
    .filter((booking) => booking.booking_date === today)
    .filter((booking) => !designerId || booking.designer_id === designerId)
    .filter((booking) => booking.status !== "pending" && booking.status !== "cancelled")
    .map((booking) => {
      const isDone = booking.status === "completed" || paidBookingIds.has(booking.id);
      const isProgress = !isDone && isTimeStarted(booking.booking_time);
      return {
        id: booking.id,
        time: booking.booking_time,
        name: booking.customer_name || "訪客",
        phone: booking.customer_phone || "未填電話",
        service: getServiceNamesFromBackend(booking.service_ids || [], services, booking.note),
        status: isDone ? "已完成" : isProgress ? "服務中" : "即將到來",
        tone: isDone ? "done" : isProgress ? "progress" : "upcoming",
        action: isProgress ? "結帳" : "查看",
        note: booking.note || "未填備註",
        image: "尚未上傳參考圖片",
      } satisfies Appointment;
    })
    .sort((a, b) => a.time.localeCompare(b.time));
}

function mapBookingsToPendingRows(bookings: BackendBooking[], services: BackendService[], showDesigner = false): PendingRow[] {
  return bookings
    .filter((booking) => booking.status === "pending")
    .map((booking) => {
      const designerName = booking.designers?.display_name || booking.designers?.name || booking.designers?.nickname || "未指定設計師";
      return {
        key: String(booking.id),
        id: booking.id,
        date: formatScheduleDateLabel(booking.booking_date),
        time: booking.booking_time,
        name: booking.customer_name || "訪客",
        phone: booking.customer_phone || "未填電話",
        service: getServiceNamesFromBackend(booking.service_ids || [], services, booking.note),
        detail: booking.note || "未填備註",
        designer: showDesigner ? designerName : undefined,
      };
    })
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

function buildEarningsRanges(transactions: BackendTransaction[], productUsage: BackendProductUsage[], customRange: IncomeDateRange): Record<EarningsRange, EarningsData> {
  return {
    今日: summarizeEarningsRange("今日", transactions, productUsage, customRange),
    本月: summarizeEarningsRange("本月", transactions, productUsage, customRange),
    指定日期或區間: summarizeEarningsRange("指定日期或區間", transactions, productUsage, customRange),
  };
}

function buildIncomeDetailGroups(transactions: BackendTransaction[], productUsage: BackendProductUsage[], customRange: IncomeDateRange): IncomeDetailGroupsByRange {
  return {
    今日: buildIncomeDetailGroupsForRange("今日", transactions, productUsage, customRange),
    本月: buildIncomeDetailGroupsForRange("本月", transactions, productUsage, customRange),
    指定日期或區間: buildIncomeDetailGroupsForRange("指定日期或區間", transactions, productUsage, customRange),
  };
}

function summarizeEarningsRange(range: EarningsRange, transactions: BackendTransaction[], productUsage: BackendProductUsage[], customRange: IncomeDateRange): EarningsData {
  const rangeTransactions = transactions.filter((transaction) => isDateInEarningsRange(transaction.created_at, range, customRange));
  const rangeProductUsage = productUsage.filter((usage) => isDateInEarningsRange(usage.used_at, range, customRange));
  const service = rangeTransactions.reduce((total, transaction) => total + getServiceGross(transaction), 0);
  const product = rangeTransactions.reduce((total, transaction) => total + getProductSaleTotal(transaction.note || ""), 0);
  const serviceDiscount = rangeTransactions.reduce((total, transaction) => total + getServiceDiscount(transaction), 0);
  const productDiscount = rangeTransactions.reduce((total, transaction) => total + getProductDiscountTotal(transaction.note || ""), 0);
  const selfUse = rangeProductUsage.reduce((total, usage) => total + Number(usage.total_cost || 0), 0);
  const discount = serviceDiscount + productDiscount;
  return {
    period: getEarningsPeriodLabel(range, customRange),
    service,
    product,
    selfUse,
    discount,
    salary: Math.max(0, service + product - selfUse - discount),
    count: rangeTransactions.length,
    label: `${range === "指定日期或區間" ? "查詢" : range}收入`,
  };
}

function buildIncomeDetailGroupsForRange(range: EarningsRange, transactions: BackendTransaction[], productUsage: BackendProductUsage[], customRange: IncomeDateRange): IncomeDetailGroup[] {
  const rangeTransactions = transactions.filter((transaction) => isDateInEarningsRange(transaction.created_at, range, customRange));
  const rangeProductUsage = productUsage.filter((usage) => isDateInEarningsRange(usage.used_at, range, customRange));
  const serviceRows = rangeTransactions.flatMap((transaction) =>
    (transaction.service_items || []).map((service) => ({
      date: formatIncomeDetailDate(transaction.created_at),
      name: transaction.customer_name || "訪客",
      item: service.name,
      amount: formatCurrency(Number(service.original_amount || service.amount || 0)),
    }))
  );
  const productRows = rangeTransactions.flatMap((transaction) =>
    extractProductSaleRows(transaction.note || "", transaction.customer_name || "訪客", formatIncomeDetailDate(transaction.created_at))
  );
  const selfUseRows = rangeProductUsage.map((usage) => ({
    date: formatIncomeDetailDate(usage.used_at),
    name: "自領",
    item: `${usage.product_name} x${usage.quantity || 1}`,
    amount: formatCurrency(Number(usage.total_cost || 0)),
  }));

  return [
    { title: "服務明細", rows: serviceRows },
    { title: "商品銷售明細", rows: productRows },
    { title: "自領商品明細", rows: selfUseRows },
  ];
}

function getServiceNamesFromNote(note?: string | null) {
  const matched = (note || "").match(/預約服務項目：([^\n]+)/);
  return matched?.[1]?.trim() || "";
}

function getServiceNamesFromBackend(ids: number[], services: BackendService[], note?: string | null) {
  const noteServiceNames = getServiceNamesFromNote(note);
  if (noteServiceNames) return noteServiceNames;
  if (!ids.length) return "預約";
  return ids.map((id) => services.find((service) => service.id === id)?.name).filter(Boolean).join("、") || "預約";
}

function getBlockedSlots(text: string) {
  const matched = text.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
  if (!matched) return [];
  const startHour = Number(matched[1].slice(0, 2));
  const endHour = Number(matched[2].slice(0, 2));
  return Array.from({ length: Math.max(endHour - startHour, 1) }, (_, index) => `${String(startHour + index).padStart(2, "0")}:00`);
}

function formatScheduleDateLabel(date: string) {
  const parsedDate = new Date(`${date}T00:00:00+08:00`);
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][parsedDate.getDay()];
  return `${parsedDate.getMonth() + 1}/${parsedDate.getDate()}（${weekday}）`;
}

function formatTodaySubtitle() {
  const today = new Date();
  const weekday = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][today.getDay()];
  return `${today.getMonth() + 1}月${today.getDate()}日 ${weekday}`;
}

function isTimeStarted(time: string) {
  const today = new Date();
  const [hour, minute] = time.split(":").map(Number);
  return today.getHours() > hour || (today.getHours() === hour && today.getMinutes() >= minute);
}

function getEarningsPeriodLabel(range: EarningsRange, customRange: IncomeDateRange) {
  const today = new Date();
  if (range === "今日") return `${today.getMonth() + 1}月${today.getDate()}日`;
  if (range === "本月") return `${today.getMonth() + 1}月1日－${today.getMonth() + 1}月${new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()}日`;
  return `${formatIncomeDateLabel(customRange.startDate)}－${formatIncomeDateLabel(customRange.endDate)}`;
}

function isDateInEarningsRange(dateText: string, range: EarningsRange, customRange: IncomeDateRange) {
  const targetDate = new Date(dateText);
  const today = new Date();
  if (Number.isNaN(targetDate.getTime())) return false;
  if (range === "今日") return targetDate.toLocaleDateString("en-CA") === today.toLocaleDateString("en-CA");
  if (range === "本月") return targetDate.getFullYear() === today.getFullYear() && targetDate.getMonth() === today.getMonth();
  const start = new Date(`${customRange.startDate}T00:00:00`);
  start.setHours(0, 0, 0, 0);
  const end = new Date(`${customRange.endDate}T23:59:59`);
  end.setHours(23, 59, 59, 999);
  return targetDate >= start && targetDate <= end;
}

function getDefaultIncomeDateRange(): IncomeDateRange {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 6);
  return {
    startDate: start.toLocaleDateString("en-CA"),
    endDate: today.toLocaleDateString("en-CA"),
  };
}

function normalizeIncomeDateRange(range: IncomeDateRange): IncomeDateRange {
  const fallback = getDefaultIncomeDateRange();
  const startDate = range.startDate || fallback.startDate;
  const endDate = range.endDate || fallback.endDate;
  if (startDate > endDate) return { startDate: endDate, endDate: startDate };
  return { startDate, endDate };
}

function getMonthIncomeDateRange(monthText: string): IncomeDateRange {
  const fallback = getDefaultIncomeDateRange();
  if (!monthText) return fallback;
  const [year, month] = monthText.split("-").map(Number);
  if (!year || !month) return fallback;
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toLocaleDateString("en-CA");
  return { startDate, endDate };
}

function withCustomIncomeRange(ranges: Record<EarningsRange, EarningsData>, customRange: IncomeDateRange): Record<EarningsRange, EarningsData> {
  return {
    ...ranges,
    指定日期或區間: {
      ...ranges["指定日期或區間"],
      period: getEarningsPeriodLabel("指定日期或區間", customRange),
    },
  };
}

function formatIncomeDateLabel(date: string) {
  const parsedDate = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return date;
  return `${parsedDate.getMonth() + 1}月${parsedDate.getDate()}日`;
}

function formatProfileDate(date: string) {
  if (!date) return "尚未設定";
  return date.replace(/-/g, "/");
}

function buildCheckoutServiceOptions(priceItems: BackendDesignerPriceItem[], categoryOrder: string[]): CheckoutServiceOption[] {
  const activePriceItems = sortDesignerPriceItems(priceItems.filter((item) => item.is_active !== false), categoryOrder);
  if (activePriceItems.length > 0) {
    return activePriceItems.map((item) => ({
      key: `price-${item.id}`,
      name: item.name,
      category: item.category || "其他服務",
      priceLabel: formatPriceRange(item.price_range),
      amount: getPriceRangeAmount(item.price_range),
    }));
  }
  return [];
}

function distributeServiceDiscount(draft: CheckoutDraft): BackendServiceItem[] {
  let remainingDiscount = Math.min(
    draft.serviceDiscount,
    draft.serviceAmount + draft.extraServiceItems.reduce((sum, item) => sum + item.amount, 0)
  );
  return [
    { name: draft.primaryServiceName, amount: draft.serviceAmount },
    ...draft.extraServiceItems,
  ].map((item) => {
    const discount = Math.min(remainingDiscount, item.amount);
    remainingDiscount -= discount;
    return {
      name: item.name,
      amount: Math.max(0, item.amount - discount),
      original_amount: item.amount,
      discount,
    };
  });
}

function findCheckoutServiceOption(serviceName: string, options: CheckoutServiceOption[]) {
  const normalizedServiceName = normalizeServiceName(serviceName);
  const size = getServiceSize(serviceName);
  const category = getServiceCategory(serviceName);
  return options.find((option) => normalizeServiceName(option.name) === normalizedServiceName)
    || options.find((option) => normalizeServiceName(option.name).includes(normalizedServiceName) || normalizedServiceName.includes(normalizeServiceName(option.name)))
    || options.find((option) => option.category === category && (!size || getServiceSize(option.name) === size))
    || options.find((option) => option.category === category);
}

function getPriceRangeAmount(priceRange: string) {
  const match = priceRange.replace(/,/g, "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function normalizeServiceName(name: string) {
  return name.toLowerCase().replace(/[()\uFF08\uFF09｜|、＋+\s]/g, "");
}

function getServiceSize(name: string) {
  const match = name.match(/\b(XL|S|M|L)\b|[（(](XL|S|M|L)[）)]|[｜|](XL|S|M|L)\b/i);
  return (match?.[1] || match?.[2] || match?.[3] || "").toUpperCase();
}

function getServiceCategory(name: string) {
  if (name.includes("染")) return "染髮";
  if (name.includes("燙")) return "燙髮";
  if (name.includes("護")) return "護髮";
  if (name.includes("頭皮")) return "頭皮養護";
  if (name.includes("剪")) return "剪髮";
  return "其他服務";
}

function formatPriceRange(priceRange: string) {
  if (!priceRange) return "未設定";
  const normalizedPrice = priceRange.trim();
  if (normalizedPrice.includes("NT$")) return normalizedPrice;
  return normalizedPrice.replace(/\$/g, "NT$");
}

function designerCategoryOrderKey(designerId: number) {
  return `designer_price_category_order_${designerId}`;
}

function readCategoryOrder(value?: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function priceCategoryText(category: string) {
  return category.replace(/[^\p{Script=Han}A-Za-z]/gu, "").toLowerCase();
}

function priceCategoryOrderIndex(category: string, order: string[]) {
  const target = priceCategoryText(category);
  const index = order.findIndex((item) => {
    const ordered = priceCategoryText(item);
    return ordered.includes(target) || target.includes(ordered) || ordered.slice(0, 2) === target.slice(0, 2);
  });
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function sortDesignerPriceItems<T extends BackendDesignerPriceItem>(items: T[], categoryOrder: string[]) {
  return [...items].sort((a, b) => priceCategoryOrderIndex(a.category, categoryOrder) - priceCategoryOrderIndex(b.category, categoryOrder) || (a.sort_order || a.id) - (b.sort_order || b.id));
}

function sortPriceCategories(categories: string[], categoryOrder: string[] = []) {
  const order = categoryOrder.length > 0 ? categoryOrder : ["剪髮", "頭皮養護", "護髮", "染髮", "燙髮"];
  return [...categories].sort((a, b) => {
    const aIndex = categoryOrder.length > 0 ? priceCategoryOrderIndex(a, order) : order.indexOf(a);
    const bIndex = categoryOrder.length > 0 ? priceCategoryOrderIndex(b, order) : order.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b, "zh-Hant");
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
}

function getServiceGross(transaction: BackendTransaction) {
  return (transaction.service_items || []).reduce((total, service) => total + Number(service.original_amount || service.amount || 0), 0);
}

function getServiceDiscount(transaction: BackendTransaction) {
  return (transaction.service_items || []).reduce((total, service) => total + Number(service.discount || 0), 0);
}

function getProductSaleTotal(note: string) {
  return extractProductSaleRows(note, "").reduce((total, row) => total + parseCurrency(row.amount), 0);
}

function getProductDiscountTotal(note: string) {
  const productSection = note.split("客人購買商品：")[1] || "";
  const matches = [...productSection.matchAll(/折扣NT\$?([\d,]+)/g)];
  return matches.reduce((total, match) => total + Number(match[1].replace(/,/g, "")), 0);
}

function extractProductSaleRows(note: string, customerName: string, date?: string): IncomeDetailRow[] {
  const productSection = note.split("客人購買商品：")[1];
  if (!productSection) return [];
  return productSection
    .split("、")
    .map((item) => {
      const amountMatch = item.match(/小計NT\$?([\d,]+)/);
      const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : 0;
      const itemName = item.replace(/，?小計NT\$?[\d,]+.*/, "").trim();
      return { date, name: customerName, item: itemName || "商品銷售", amount: formatCurrency(amount) };
    })
    .filter((row) => parseCurrency(row.amount) > 0);
}

function formatIncomeDetailDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.replace(/^\d{4}-0?/, "").replace("-", "/");
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatCurrency(amount: number) {
  return `NT$${Math.max(0, amount).toLocaleString()}`;
}

function parseCurrency(text: string) {
  return Number(text.replace(/[^\d]/g, "")) || 0;
}

function getCalendarItems(date: string, scheduleItems: CalendarRecords<ScheduleItem>, leaveItems: CalendarRecords<LeaveItem>): CalendarItem[] {
  const leaveRows = (leaveItems[date] || []).map((item) => ({
    text: item.text,
    tone: item.tone,
    designer: item.designer,
    category: "leave" as const,
  }));
  const bookingRows = (scheduleItems[date] || []).map((item) => ({
    ...item,
    category: "booking" as const,
  }));

  return [...leaveRows, ...bookingRows];
}

function mergeCalendarRecords<T>(primary: CalendarRecords<T>, secondary: CalendarRecords<T>): CalendarRecords<T> {
  const merged: CalendarRecords<T> = { ...primary };
  Object.entries(secondary).forEach(([date, items]) => {
    merged[date] = [...(merged[date] || []), ...items];
  });
  return merged;
}

function filterCalendarRecords<T extends { designer?: string }>(records: CalendarRecords<T>, designer: string): CalendarRecords<T> {
  return Object.fromEntries(
    Object.entries(records)
      .map(([date, items]) => [date, items.filter((item) => (item.designer || "Cherry") === designer)])
      .filter(([, items]) => (items as T[]).length > 0)
  ) as CalendarRecords<T>;
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

function AvatarPreview({ avatarUrl, size = "default" }: { avatarUrl: string; size?: "default" | "large" }) {
  return (
    <div className={`logo ${avatarUrl ? "has-avatar" : ""} ${size === "large" ? "large-avatar" : ""}`}>
      {avatarUrl ? <img src={avatarUrl} alt="設計師大頭照" /> : "BC"}
    </div>
  );
}

function ProfileInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="profile-input-card">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function BottomTabs({ activeTab, pendingCount, onChange }: { activeTab: TabKey; pendingCount: number; onChange: (tab: TabKey) => void }) {
  return (
    <nav className="bottom-tabs">
      {tabs.map((tab) => (
        <button className={`tab-btn ${activeTab === tab.key ? "active" : ""}`} key={tab.key} onClick={() => onChange(tab.key)}>
          <span className="tab-icon-wrap">
            <span className="tab-icon">
              {tab.key === "today" ? <TodayTabIcon /> : tab.key === "pending" ? <PendingTabIcon /> : tab.key === "calendar" ? <ScheduleTabIcon /> : tab.icon}
            </span>
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

function TodayTabIcon() {
  return (
    <svg className="today-tab-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5.5" width="16" height="15" rx="2.5" />
      <path d="M8 3.5v4" />
      <path d="M16 3.5v4" />
      <path d="M4 10h16" />
      <text x="12" y="17" textAnchor="middle">02</text>
    </svg>
  );
}

function PendingTabIcon() {
  return (
    <svg className="pending-tab-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3.4 2" />
    </svg>
  );
}

function ScheduleTabIcon() {
  return (
    <svg className="schedule-tab-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="14" height="14" rx="2.2" />
      <path d="M7 3v4" />
      <path d="M14 3v4" />
      <path d="M3.5 9h14" />
      <rect className="grid-dot" x="6" y="11.2" width="2.4" height="2.4" rx=".4" />
      <rect className="grid-dot" x="10" y="11.2" width="2.4" height="2.4" rx=".4" />
      <rect className="grid-dot" x="6" y="15" width="2.4" height="2.4" rx=".4" />
      <path d="M13.8 17.9a5 5 0 0 0 6.3-5.9" />
      <path d="M20.4 12l.2 3.1-3-.5" />
      <path d="M19.2 18.4a5 5 0 0 1-6.2-5.8" />
      <path d="M12.7 12.6l-.2 3.1 3-.6" />
    </svg>
  );
}
