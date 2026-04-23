"use client";
import { useState } from "react";

const designers = [
  { id: 1, initials: "C", name: "Cherry", nickname: "扁頭救星", style: "日系、剪髮、染髮、燙髮", ig: "bingcherry_cherry", bg: "#EEEDFE", color: "#3C3489" },
  { id: 2, initials: "M", name: "Mira", nickname: "米拉夫人", style: "日系、剪髮、染髮、燙髮", ig: "miramira_lee", bg: "#E1F5EE", color: "#085041" },
  { id: 3, initials: "J", name: "Joey", nickname: "", style: "日系、剪髮、染髮、燙髮", ig: "wang7723", bg: "#FAEEDA", color: "#633806" },
  { id: 4, initials: "A", name: "Alisa", nickname: "", style: "日系、男士剪髮、染髮、燙髮", ig: "wan__yu94", bg: "#E6F1FB", color: "#0C447C" },
  { id: 5, initials: "P", name: "Peggy", nickname: "", style: "日系、剪髮、染髮、燙髮", ig: "peggyhair.tainan", bg: "#F4C0D1", color: "#72243E" },
];

const services = [
  { id: 1, name: "剪髮", duration: "45 分鐘", price: 500 },
  { id: 2, name: "染髮（全頭）", duration: "120 分鐘", price: 2200 },
  { id: 3, name: "燙髮", duration: "150 分鐘", price: 2800 },
  { id: 4, name: "護髮療程", duration: "60 分鐘", price: 1200 },
];

const dates = [
  { label: "22日\n週二", value: "04/22", closed: false },
  { label: "23日\n週三", value: "04/23", closed: false },
  { label: "24日\n週四", value: "04/24", closed: false },
  { label: "25日\n週五", value: "04/25", closed: false },
  { label: "26日\n休息", value: "04/26", closed: true },
  { label: "27日\n週日", value: "04/27", closed: false },
];

const timeSlots = [
  { time: "10:00", available: false },
  { time: "11:00", available: true },
  { time: "12:00", available: false },
  { time: "13:00", available: true },
  { time: "14:00", available: true },
  { time: "15:00", available: true },
  { time: "16:00", available: false },
  { time: "17:00", available: true },
];

export default function Home() {
  const [selectedDesigner, setSelectedDesigner] = useState(designers[0]);
  const [selectedService, setSelectedService] = useState(services[1]);
  const [selectedDate, setSelectedDate] = useState("04/23");
  const [selectedTime, setSelectedTime] = useState("14:00");

  const total = selectedService.price;

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 390, background: "#fff", borderRadius: 20, overflow: "hidden", border: "1px solid #D3D1C7" }}>

        <div style={{ background: "#fff", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "0.5px solid #D3D1C7" }}>
          <span style={{ fontSize: 16, fontWeight: 500 }}>預約掛號</span>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#CECBF6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 500, color: "#3C3489" }}>王小</div>
        </div>

        <div style={{ padding: 16 }}>
          <input placeholder="搜尋服務、設計師、風格..." style={{ width: "100%", background: "#F1EFE8", border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 13, color: "#888780", marginBottom: 12, outline: "none"