"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { useBookingStore } from "../../../store/bookingStore";
import { useLanguageStore } from "../../../store/languageStore";

type Booking = {
  id: number;
  customer_name: string;
  customer_phone: string;
  booking_date: string;
  booking_time: string;
  service_ids: number[];
  note: string | null;
  status: string | null;
  reference_image_url?: string | null;
  created_at?: string;
  designers?: { id?: number; name?: string; display_name?: string; nickname?: string } | null;
};

type Service = { id: number; name: string };

const serviceNameEn: Record<string, string> = {
  "精油髮浴洗": "Essential Oil Hair Bath",
  "接髮": "Hair Extensions",
  "造型": "Styling",
  "增色洗": "Color Refresh Shampoo",
  "剪髮（含髮浴）": "Haircut with Hair Bath",
  "剪髮（含髮浴）孩童": "Kids Haircut with Hair Bath",
  "單剪髮（不含髮浴）": "Haircut Only",
  "單剪髮（不含髮浴）孩童": "Kids Haircut Only",
  "修瀏海": "Bang Trim",
  "質感燙＋剪髮": "Texture Perm + Haircut",
  "熱/溫塑＋結構剪髮": "Digital / Thermal Perm + Haircut",
  "瀏海設計燙": "Bang Perm",
  "瀏海設計燙（不含洗）": "Bang Perm (shampoo not included)",
  "髮根燙（2cm內）": "Root Perm (within 2 cm)",
  "設計染（單色）": "Single Color",
  "補染髮根（2cm內）": "Root Touch-up (within 2 cm)",
  "HHN深層結構護髮": "HHN Deep Structural Treatment",
  "快速護髮": "Express Treatment",
  "深層護髮（自產）": "Deep Treatment",
  "髮質淨化": "Hair Detox",
  "高階頭皮深呼吸": "Advanced Scalp Therapy",
  "頭皮隔離": "Scalp Protection",
  "深層淨化髮浴（含基本吹乾）": "Deep Cleansing Hair Bath with Basic Blow-dry",
  "深層淨化髮浴（含基本造型）": "Deep Cleansing Hair Bath with Basic Styling",
};

const statusText = {
  zh: { pending: "待確認", confirmed: "已確認", cancelled: "已取消" },
  en: { pending: "Pending", confirmed: "Confirmed", cancelled: "Cancelled" },
};

const DESIGNER_EN_NAMES: Record<string, string> = {
  林亮瑩: "Cherry",
  亮瑩: "Cherry",
};

function hasEnglishName(value?: string) {
  return !!value && /[A-Za-z]/.test(value);
}

function baseServiceName(name: string) {
  return name.replace(/\s*[\(（][SMLX]+[\)）]$/, "").trim();
}

function serviceSize(name: string) {
  return name.match(/[\(（]([SMLX]+)[\)）]$/)?.[1] || "";
}

function displayServiceName(name: string, isEnglish: boolean) {
  if (!isEnglish) return name;
  const base = baseServiceName(name);
  const size = serviceSize(name);
  const translated = serviceNameEn[base] || base;
  return size ? `${translated} (${size})` : translated;
}

function statusStyle(status?: string | null) {
  if (status === "confirmed") return { background: "#E1F5EE", color: "#085041" };
  if (status === "cancelled") return { background: "#FCEBEB", color: "#A32D2D" };
  return { background: "#FAEEDA", color: "#633806" };
}

export default function MyBookingsPage() {
  const router = useRouter();
  const { contactValue } = useBookingStore();
  const { language } = useLanguageStore();
  const isEnglish = language === "en";
  const [phone, setPhone] = useState(contactValue || "");
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [draftNotes, setDraftNotes] = useState<Record<number, string>>({});
  const [draftFiles, setDraftFiles] = useState<Record<number, File | null>>({});
  const [draftPreviews, setDraftPreviews] = useState<Record<number, string>>({});

  const isValid = phone.replace(/\D/g, "").length >= 8;

  function serviceNames(ids: number[]) {
    if (!ids || ids.length === 0) return "—";
    return ids
      .map((id) => services.find((service) => service.id === id)?.name || "")
      .filter(Boolean)
      .map((name) => displayServiceName(name, isEnglish))
      .join(isEnglish ? ", " : "、") || "—";
  }

  function designerName(booking: Booking) {
    const designer = booking.designers;
    if (!designer) return "Stylist";
    if (hasEnglishName(designer.name)) return designer.name || "Stylist";
    if (designer.display_name && DESIGNER_EN_NAMES[designer.display_name]) return DESIGNER_EN_NAMES[designer.display_name];
    if (designer.name && DESIGNER_EN_NAMES[designer.name]) return DESIGNER_EN_NAMES[designer.name];
    if (hasEnglishName(designer.display_name)) return designer.display_name || "Stylist";
    return "Stylist";
  }

  async function searchBookings() {
    if (!isValid) {
      alert(isEnglish ? "Please enter a valid phone number." : "請輸入有效的手機號碼");
      return;
    }

    setLoading(true);
    setSearched(true);
    const [{ data: bookingData }, { data: serviceData }] = await Promise.all([
      supabase
        .from("bookings")
        .select("*, designers(id, name, display_name, nickname)")
        .eq("customer_phone", phone)
        .order("booking_date", { ascending: false })
        .order("booking_time", { ascending: false }),
      supabase.from("services").select("id, name"),
    ]);

    const nextBookings = (bookingData || []) as Booking[];
    setBookings(nextBookings);
    setServices((serviceData || []) as Service[]);
    setDraftNotes(Object.fromEntries(nextBookings.map((booking) => [booking.id, booking.note || ""])));
    setDraftFiles({});
    Object.values(draftPreviews).forEach((url) => URL.revokeObjectURL(url));
    setDraftPreviews({});
    setLoading(false);
  }

  function handleFileChange(bookingId: number, file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert(isEnglish ? "Please upload an image file." : "請上傳圖片檔案");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      alert(isEnglish ? "Image size must be under 8 MB." : "圖片大小請勿超過 8MB");
      return;
    }
    if (draftPreviews[bookingId]) URL.revokeObjectURL(draftPreviews[bookingId]);
    setDraftFiles((prev) => ({ ...prev, [bookingId]: file }));
    setDraftPreviews((prev) => ({ ...prev, [bookingId]: URL.createObjectURL(file) }));
  }

  async function uploadReferenceImage(bookingId: number) {
    const file = draftFiles[bookingId];
    if (!file) return null;

    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `booking-references/${bookingId}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("customer-photos").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;

    const { data } = supabase.storage.from("customer-photos").getPublicUrl(path);
    return data.publicUrl;
  }

  async function saveBooking(booking: Booking) {
    if (booking.status !== "pending") return;
    setSavingId(booking.id);

    let imageUrl: string | null = null;
    try {
      imageUrl = await uploadReferenceImage(booking.id);
    } catch {
      alert(isEnglish ? "Image upload failed. Please try again." : "圖片上傳失敗，請再試一次");
      setSavingId(null);
      return;
    }

    const updates: { note: string; reference_image_url?: string } = {
      note: draftNotes[booking.id] || "",
    };
    if (imageUrl) updates.reference_image_url = imageUrl;

    const { error } = await supabase.from("bookings").update(updates).eq("id", booking.id).eq("status", "pending");
    if (error) {
      alert(isEnglish ? "Update failed. Please try again." : "更新失敗，請再試一次");
      setSavingId(null);
      return;
    }

    setBookings((prev) => prev.map((item) => item.id === booking.id ? { ...item, note: updates.note, reference_image_url: imageUrl || item.reference_image_url } : item));
    setDraftFiles((prev) => ({ ...prev, [booking.id]: null }));
    if (draftPreviews[booking.id]) URL.revokeObjectURL(draftPreviews[booking.id]);
    setDraftPreviews((prev) => {
      const next = { ...prev };
      delete next[booking.id];
      return next;
    });
    setSavingId(null);
    alert(isEnglish ? "Booking updated." : "預約資料已更新");
  }

  async function cancelBooking(booking: Booking) {
    if (booking.status !== "pending") return;
    const ok = confirm(isEnglish ? "Cancel this pending booking request?" : "確定要取消這筆待確認預約嗎？");
    if (!ok) return;

    setSavingId(booking.id);
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", booking.id).eq("status", "pending");
    if (error) {
      alert(isEnglish ? "Cancel failed. Please try again." : "取消失敗，請再試一次");
      setSavingId(null);
      return;
    }

    setBookings((prev) => prev.map((item) => item.id === booking.id ? { ...item, status: "cancelled" } : item));
    setSavingId(null);
  }

  return (
    <div style={{ padding: "20px 16px 120px" }}>
      <button
        onClick={() => router.push("/booking")}
        style={{ background: "transparent", border: "none", color: "#7a1f1f", fontSize: 13, fontWeight: 700, padding: "0 0 14px", cursor: "pointer" }}
      >
        {isEnglish ? "⬅︎ Back" : "⬅︎返回"}
      </button>

      <div style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>
        {isEnglish ? "My Bookings" : "查看我的預約"}
      </div>
      <div style={{ fontSize: 12, color: "#9a9188", lineHeight: 1.7, marginBottom: 18 }}>
        {isEnglish ? "Enter your phone number to view your booking requests." : "請輸入預約時使用的電話號碼，查看預約紀錄。"}
      </div>

      <div style={{ background: "#f2e8e6", border: "0.5px solid #d9b8b0", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 12, color: "#7a1f1f", lineHeight: 1.7 }}>
        {isEnglish
          ? "Pending bookings can update notes, reference image, or be cancelled. Confirmed bookings must be changed with the stylist."
          : "待確認預約可修改備註、參考圖片或取消；已確認預約如需更改，請聯繫設計師。"}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#9a9188", marginBottom: 8 }}>{isEnglish ? "Phone Number" : "手機號碼"}</div>
        <input
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") searchBookings(); }}
          placeholder="0912-345-678"
          style={{ width: "100%", padding: "13px 14px", borderRadius: 12, border: "1.5px solid #e5dbd0", background: "#fdfaf7", color: "#1a1a1a", fontSize: 16, outline: "none", boxSizing: "border-box" }}
        />
      </div>

      <button
        onClick={searchBookings}
        disabled={!isValid || loading}
        style={{ width: "100%", padding: "13px 0", background: isValid && !loading ? "#7a1f1f" : "#e5dbd0", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: isValid && !loading ? "pointer" : "default", marginBottom: 18 }}
      >
        {loading ? (isEnglish ? "Searching..." : "查詢中...") : (isEnglish ? "Search Bookings" : "查詢預約")}
      </button>

      {searched && !loading && bookings.length === 0 && (
        <div style={{ textAlign: "center", padding: "28px 0", color: "#9a9188", fontSize: 13 }}>
          {isEnglish ? "No bookings found for this phone number." : "查無此電話號碼的預約紀錄。"}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {bookings.map((booking) => {
          const canEdit = booking.status === "pending";
          const style = statusStyle(booking.status);
          const previewUrl = draftPreviews[booking.id];
          const imageUrl = previewUrl || booking.reference_image_url || "";

          return (
            <div key={booking.id} style={{ background: "#fdfaf7", border: "0.5px solid #e5dbd0", borderRadius: 14, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>{booking.customer_name || (isEnglish ? "Guest" : "訪客")}</div>
                  <div style={{ fontSize: 12, color: "#9a9188", marginTop: 2 }}>{booking.customer_phone}</div>
                </div>
                <span style={{ ...style, height: "fit-content", borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>
                  {statusText[language][(booking.status || "pending") as "pending" | "confirmed" | "cancelled"] || booking.status}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 12, color: "#5f5a55", lineHeight: 1.5, marginBottom: 12 }}>
                <div>{isEnglish ? "Stylist" : "設計師"}：<b style={{ color: "#1a1a1a" }}>{designerName(booking)}</b></div>
                <div>{isEnglish ? "Date / Time" : "日期時間"}：<b style={{ color: "#1a1a1a" }}>{booking.booking_date.replace(/-/g, "/")} {booking.booking_time}</b></div>
                <div>{isEnglish ? "Services" : "服務項目"}：{serviceNames(booking.service_ids || [])}</div>
                {booking.created_at && <div>{isEnglish ? "Created" : "建立時間"}：{booking.created_at.slice(0, 16).replace("T", " ")}</div>}
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: "#9a9188", marginBottom: 6 }}>{isEnglish ? "Notes" : "備註"}</div>
                <textarea
                  value={draftNotes[booking.id] || ""}
                  onChange={(event) => setDraftNotes((prev) => ({ ...prev, [booking.id]: event.target.value }))}
                  disabled={!canEdit}
                  placeholder={isEnglish ? "Special requests..." : "特殊需求..."}
                  style={{ width: "100%", minHeight: 74, resize: "vertical", padding: "10px 12px", borderRadius: 10, border: "1px solid #e5dbd0", background: canEdit ? "#fff" : "#f0e9e0", color: "#1a1a1a", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#9a9188", marginBottom: 6 }}>{isEnglish ? "Reference Image" : "參考圖片"}</div>
                {imageUrl ? (
                  <a href={imageUrl} target="_blank" rel="noreferrer" style={{ display: "block", marginBottom: 8 }}>
                    <img src={imageUrl} alt={isEnglish ? "Reference image" : "參考圖片"} style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 10, border: "0.5px solid #e5dbd0" }} />
                  </a>
                ) : (
                  <div style={{ background: "#f0e9e0", color: "#9a9188", borderRadius: 10, padding: "12px", fontSize: 12, marginBottom: 8 }}>
                    {isEnglish ? "No reference image." : "尚未上傳參考圖片。"}
                  </div>
                )}
                {canEdit && (
                  <label style={{ display: "block", textAlign: "center", padding: "10px 12px", borderRadius: 10, border: "1px dashed #d9b8b0", color: "#7a1f1f", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    {isEnglish ? "Upload / Replace Image" : "上傳 / 更換圖片"}
                    <input type="file" accept="image/*" onChange={(event) => handleFileChange(booking.id, event.target.files?.[0] || null)} style={{ display: "none" }} />
                  </label>
                )}
              </div>

              {!canEdit && (
                <div style={{ background: "#FAEEDA", borderRadius: 10, padding: "10px 12px", color: "#633806", fontSize: 12, lineHeight: 1.6 }}>
                  {booking.status === "confirmed"
                    ? (isEnglish ? "Confirmed bookings cannot be changed here. Please contact your stylist." : "已確認預約不可在此直接修改，請聯繫設計師。")
                    : (isEnglish ? "Cancelled bookings are view-only." : "已取消預約僅供查看。")}
                </div>
              )}

              {canEdit && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => saveBooking(booking)}
                    disabled={savingId === booking.id}
                    style={{ flex: 1, padding: "10px 0", border: "none", borderRadius: 10, background: savingId === booking.id ? "#e5dbd0" : "#7a1f1f", color: "#fff", fontSize: 13, fontWeight: 700, cursor: savingId === booking.id ? "default" : "pointer" }}
                  >
                    {savingId === booking.id ? (isEnglish ? "Saving..." : "儲存中...") : (isEnglish ? "Save Changes" : "儲存修改")}
                  </button>
                  <button
                    onClick={() => cancelBooking(booking)}
                    disabled={savingId === booking.id}
                    style={{ flex: 1, padding: "10px 0", border: "none", borderRadius: 10, background: "#FCEBEB", color: "#A32D2D", fontSize: 13, fontWeight: 700, cursor: savingId === booking.id ? "default" : "pointer" }}
                  >
                    {isEnglish ? "Cancel Request" : "取消預約"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
