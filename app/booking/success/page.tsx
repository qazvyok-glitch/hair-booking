"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSettingsStore, fontSizes } from "../../../store/settingsStore";

type BookingInfo = {
  designerName: string;
  designerNickname: string;
  date: string;
  time: string;
};

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M16 2v4M8 2v4M3 10h18"/>
      <circle cx="8" cy="14" r="1" fill="currentColor" stroke="none"/>
      <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none"/>
      <circle cx="16" cy="14" r="1" fill="currentColor" stroke="none"/>
    </svg>
  );
}

export default function BookingSuccess() {
  const router = useRouter();
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const { dark, fsIndex } = useSettingsStore();
  const fs = fontSizes[fsIndex].value;
  const cardBg = dark ? "#2A2A2A" : "#fff";
  const cardBorder = dark ? "#3A3A3A" : "#D3D1C7";
  const textMain = dark ? "#F0EFEA" : "#2C2C2A";
  const textSub = dark ? "#888780" : "#5F5E5A";

  useEffect(() => {
    const saved = sessionStorage.getItem("lastBooking");
    if (saved) setBooking(JSON.parse(saved));
  }, []);

  const designer = booking ? { name: booking.designerName, nickname: booking.designerNickname } : null;
  const date = booking?.date || null;
  const time = booking?.time || null;

  function downloadICS() {
    if (!date || !time) return;
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    const pad = (n: number) => String(n).padStart(2, "0");
    const dtStart = `${year}${pad(month)}${pad(day)}T${pad(hour)}${pad(minute)}00`;
    const endHour = hour + 2;
    const dtEnd = `${year}${pad(month)}${pad(day)}T${pad(endHour)}${pad(minute)}00`;
    const designerName = designer?.name || "設計師";
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Bing Cherry Hair Salon//ZH",
      "BEGIN:VEVENT",
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:Bing Cherry Hair Salon - ${designerName}`,
      `DESCRIPTION:設計師：${designerName}`,
      "LOCATION:台南市中西區西門路二段10號",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bing-cherry-booking.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  function openLineReminder() {
    const designerName = designer?.name || "設計師";
    const msg = encodeURIComponent(
      `📅 Bing Cherry Hair Salon 預約提醒\n設計師：${designerName}\n日期：${date || ""}\n時間：${time || ""}\n地址：台南市中西區西門路二段10號`
    );
    window.open("https://line.me/R/msg/text/?" + msg, "_blank");
  }

  return (
    <div style={{ background: cardBg, minHeight: "100vh" }}>
      <div style={{ width: "100%", maxWidth: 390 }}>

        <div style={{ textAlign: "center", padding: "32px 0 24px" }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>🌸</div>
          <div style={{ fontSize: fs * 22, fontWeight: 700, color: textMain, marginBottom: 6 }}>預約成功！</div>
          <div style={{ fontSize: fs * 13, color: textSub }}>我們會盡快與您確認預約時間</div>
        </div>

        <div style={{ background: cardBg, borderRadius: 16, padding: "20px 16px", marginBottom: 12, border: `0.5px solid ${cardBorder}` }}>
          <div style={{ fontSize: fs * 13, fontWeight: 600, color: textMain, marginBottom: 14 }}>📋 預約資訊</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: textSub }}>設計師</span>
              <span style={{ color: textMain, fontWeight: 500 }}>
                {designer?.name}{designer?.nickname ? ` (${designer.nickname})` : ""}
              </span>
            </div>
            <div style={{ borderTop: `0.5px solid ${cardBorder}` }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: textSub }}>日期</span>
              <span style={{ color: textMain, fontWeight: 500 }}>{date ? date.replace(/-/g, "/") : "—"}</span>
            </div>
            <div style={{ borderTop: `0.5px solid ${cardBorder}` }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: textSub }}>時段</span>
              <span style={{ color: textMain, fontWeight: 500 }}>{time || "—"}</span>
            </div>
            <div style={{ borderTop: `0.5px solid ${cardBorder}` }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: textSub }}>地址</span>
              <span style={{ color: textMain, fontWeight: 500 }}>台南市中西區西門路二段10號</span>
            </div>
          </div>
        </div>

        <div style={{ background: cardBg, borderRadius: 16, padding: "16px", marginBottom: 12, border: `0.5px solid ${cardBorder}` }}>
          <div style={{ fontSize: fs * 13, fontWeight: 600, color: textMain, marginBottom: 12 }}>🔔 設定提醒</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={downloadICS}
              style={{ flex: 1, padding: "12px 0", background: "#EEEDFE", color: "#534AB7", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              <CalendarIcon />
              加入行事曆
            </button>
            <button
              onClick={openLineReminder}
              style={{ flex: 1, padding: "12px 0", background: "#E1F5EE", color: "#06C755", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
            >
              💬 LINE 提醒
            </button>
          </div>
        </div>

        <div style={{ background: "#1A1A1A", borderRadius: 14, padding: "14px 16px", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#C8A45A", marginBottom: 6 }}>📸 截圖保留預約資訊</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.8 }}>
            iOS：側邊鍵 + 音量上鍵<br/>
            Android：電源鍵 + 音量下鍵
          </div>
        </div>

        <button
          onClick={() => router.push("/")}
          style={{ width: "100%", padding: "14px 0", background: "#534AB7", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer" }}
        >
          回到首頁
        </button>

      </div>
    </div>
  );
}
