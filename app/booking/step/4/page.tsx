"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "../../../../lib/supabase";
import { useBookingStore } from "../../../../store/bookingStore";
import { useLanguageStore } from "../../../../store/languageStore";

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

export default function Step4() {
  const router = useRouter();
  const { designer, serviceIds, date, time, contactValue, customerName, reset } = useBookingStore();
  const { language } = useLanguageStore();
  const [name, setName] = useState(customerName || "");
  const [contact, setContact] = useState(contactValue || "");
  const [note, setNote] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [referenceImageFile, setReferenceImageFile] = useState<File | null>(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const isEnglish = language === "en";

  useEffect(() => {
    if (customerName) setName(customerName);
    if (contactValue) setContact(contactValue);
  }, [customerName, contactValue]);

  useEffect(() => {
    if (serviceIds.length === 0) {
      setServices([]);
      return;
    }

    supabase
      .from("services")
      .select("id, name")
      .in("id", serviceIds)
      .then(({ data }) => {
        if (!data) return;
        setServices(serviceIds.map((id) => data.find((service) => service.id === id)).filter(Boolean) as Service[]);
      });
  }, [serviceIds]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setIsLoggedIn(true);
        const { data } = await supabase
          .from("customers")
          .select("name, phone")
          .eq("id", session.user.id)
          .single();
        if (data) {
          if (data.name && !customerName) setName(data.name);
          if (data.phone && !contactValue) setContact(data.phone);
        }
      }
    });
  }, [customerName, contactValue]);

  function handleReferenceImageChange(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert(isEnglish ? "Please upload an image file." : "請上傳圖片檔案");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      alert(isEnglish ? "Image size must be under 8 MB." : "圖片大小請勿超過 8MB");
      return;
    }
    if (referenceImagePreview) URL.revokeObjectURL(referenceImagePreview);
    setReferenceImageFile(file);
    setReferenceImagePreview(URL.createObjectURL(file));
  }

  function removeReferenceImage() {
    if (referenceImagePreview) URL.revokeObjectURL(referenceImagePreview);
    setReferenceImageFile(null);
    setReferenceImagePreview("");
  }

  async function uploadReferenceImage() {
    if (!referenceImageFile) return null;

    const extension = referenceImageFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeExtension = extension.replace(/[^a-z0-9]/g, "") || "jpg";
    const filePath = `booking-references/${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;
    const { error } = await supabase.storage
      .from("customer-photos")
      .upload(filePath, referenceImageFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw error;

    const { data } = supabase.storage.from("customer-photos").getPublicUrl(filePath);
    return data.publicUrl;
  }

  if (!designer || !date || !time) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <div style={{ color: "#888780", fontSize: 14, marginBottom: 16 }}>{isEnglish ? "Please start your booking from step 1." : "請從第一步開始預約"}</div>
        <button
          onClick={() => router.push("/booking/step/1")}
          style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontSize: 14, cursor: "pointer" }}
        >
          {isEnglish ? "Start Over" : "重新開始"}
        </button>
      </div>
    );
  }

  async function handleSubmit() {
    if (!name || !contact) { alert(isEnglish ? "Please enter your name and phone number" : "請填寫姓名與手機號碼"); return; }
    setSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    let referenceImageUrl: string | null = null;

    try {
      referenceImageUrl = await uploadReferenceImage();
    } catch {
      alert(isEnglish ? "Image upload failed. Please try again." : "圖片上傳失敗，請再試一次");
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from("bookings").insert({
      designer_id: designer!.id === 0 ? null : designer!.id,
      service_ids: serviceIds,
      booking_date: date,
      booking_time: time,
      customer_name: name,
      customer_phone: contact,
      note: note,
      status: "pending",
      reference_image_url: referenceImageUrl,
      user_id: session?.user?.id || null,
    });
    if (error) {
      alert(isEnglish ? "Booking failed. Please try again." : "預約失敗，請再試一次");
      setSubmitting(false);
      return;
    }
    sessionStorage.setItem("lastBooking", JSON.stringify({
      designerName: designer!.name,
      designerNickname: designer!.nickname,
      date,
      time,
    }));
    router.push("/booking/success");
    setTimeout(() => reset(), 1000);
  }

  return (
    <div style={{ padding: "20px 16px 120px" }}>
      <button
        onClick={() => router.push("/booking/step/3")}
        style={{
          background: "transparent",
          border: "none",
          color: "#7a1f1f",
          fontSize: 13,
          fontWeight: 700,
          padding: "0 0 14px",
          cursor: "pointer",
        }}
      >
        {isEnglish ? "⬅︎ Back" : "⬅︎返回"}
      </button>
      <div style={{ fontSize: 20, fontWeight: 600, color: "#2C2C2A", marginBottom: 4 }}>{isEnglish ? "Confirm Booking" : "確認預約"}</div>
      <div style={{ fontSize: 12, color: "#888780", marginBottom: 20 }}>{isEnglish ? "Please review your booking details before submitting." : "請確認資訊後送出"}</div>

      <div style={{
        background: "#FAEEDA", border: "0.5px solid #E3C27A",
        borderRadius: 14, padding: "12px 14px", marginBottom: 16,
        color: "#633806", fontSize: 12, lineHeight: 1.7,
      }}>
        {isEnglish
          ? "This request is not confirmed yet. Your appointment will be finalized after the stylist accepts and replies."
          : "此預約送出後尚未正式成立，需以設計師回覆確認為主；設計師接受後才算完成預約。"}
      </div>

      <div style={{
        background: "#EEEDFE", border: "0.5px solid #AFA9EC",
        borderRadius: 14, padding: "16px", marginBottom: 20,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "0.5px solid #D3D1C7" }}>
          <span style={{ fontSize: 12, color: "#888780" }}>{isEnglish ? "Stylist" : "設計師"}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A" }}>{designer.name}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "0.5px solid #D3D1C7" }}>
          <span style={{ fontSize: 12, color: "#888780" }}>{isEnglish ? "Date" : "日期"}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A" }}>{date?.replace(/-/g, "/")}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "0.5px solid #D3D1C7" }}>
          <span style={{ fontSize: 12, color: "#888780" }}>{isEnglish ? "Time" : "時段"}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A" }}>{time}</span>
        </div>
        <div style={{ padding: "8px 0 2px" }}>
          <div style={{ fontSize: 12, color: "#888780", marginBottom: 6 }}>{isEnglish ? "Selected Services" : "預約服務項目"}</div>
          {services.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {services.map((service) => (
                <div key={service.id} style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A", lineHeight: 1.5 }}>
                  ・{displayServiceName(service.name, isEnglish)}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A" }}>—</div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "#888780", marginBottom: 6 }}>
          {isEnglish ? "Name" : "姓名"}
        </div>
        <input
          value={name}
          onChange={(e) => !isLoggedIn && setName(e.target.value)}
          placeholder={isEnglish ? "Your name" : "王小明"}
          style={{
            width: "100%", padding: "11px 14px", borderRadius: 10,
            border: "1px solid #D3D1C7", fontSize: 14,
            background: "#fff", outline: "none",
          }}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "#888780", marginBottom: 6 }}>
          {isEnglish ? "Phone Number" : "手機號碼"}
        </div>
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="0912-345-678"
          type="tel"
          style={{
            width: "100%", padding: "11px 14px", borderRadius: 10,
            border: "1px solid #D3D1C7", fontSize: 14,
            background: "#fff", outline: "none",
          }}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "#888780", marginBottom: 6 }}>{isEnglish ? "Notes (optional)" : "備註（選填）"}</div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={isEnglish ? "Special requests..." : "特殊需求..."}
          style={{
            width: "100%", padding: "11px 14px", borderRadius: 10,
            border: "1px solid #D3D1C7", fontSize: 14,
            background: "#fff", outline: "none", height: 80, resize: "none",
          }}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "#888780", marginBottom: 6 }}>{isEnglish ? "Reference Image (optional)" : "參考圖片（選填）"}</div>
        <label style={{
          display: "block",
          width: "100%",
          padding: "13px 14px",
          borderRadius: 10,
          border: "1px dashed #D3D1C7",
          background: "#fff",
          color: "#7a1f1f",
          fontSize: 13,
          fontWeight: 600,
          textAlign: "center",
          cursor: "pointer",
          boxSizing: "border-box",
        }}>
          {referenceImageFile ? (isEnglish ? "Change Image" : "更換圖片") : (isEnglish ? "Upload Reference Image" : "上傳參考圖片")}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleReferenceImageChange(e.target.files?.[0] || null)}
            style={{ display: "none" }}
          />
        </label>
        {referenceImagePreview && (
          <div style={{ marginTop: 10 }}>
            <img src={referenceImagePreview} alt={isEnglish ? "Reference preview" : "參考圖片預覽"} style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 12, border: "0.5px solid #D3D1C7" }} />
            <button
              type="button"
              onClick={removeReferenceImage}
              style={{ marginTop: 8, background: "#FCEBEB", color: "#A32D2D", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              {isEnglish ? "Remove Image" : "移除圖片"}
            </button>
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, color: "#888780", textAlign: "center", marginBottom: 8 }}>
        {isEnglish ? "Final price and booking availability will be confirmed by the stylist." : "實際金額與預約是否成立，皆以設計師確認為主。"}
      </div>

      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 390, background: "#fff",
        borderTop: "0.5px solid #D3D1C7", padding: "12px 16px 24px",
        display: "flex", gap: 10,
      }}>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            flex: 1, padding: "13px 0",
            background: submitting ? "#D3D1C7" : "#534AB7",
            color: "#fff", border: "none", borderRadius: 12,
            fontSize: 15, fontWeight: 600,
            cursor: submitting ? "default" : "pointer",
          }}
        >
          {submitting ? (isEnglish ? "Submitting..." : "送出中...") : (isEnglish ? "Send Request" : "送出預約申請")}
        </button>
      </div>
    </div>
  );
}
