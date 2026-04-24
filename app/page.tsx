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

function IgIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f09433" />
          <stop offset="25%" stopColor="#e6683c" />
          <stop offset="50%" stopColor="#dc2743" />
          <stop offset="75%" stopColor="#cc2366" />
          <stop offset="100%" stopColor="#bc1888" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#ig-grad)" />
      <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.8" fill="none" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="white" />
    </svg>
  );
}

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
          <span style={{ fontSize: 16, fontWeight: 500 }}>Bing Cherry Hair Salon</span>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#CECBF6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 500, color: "#3C3489" }}>王小</div>
        </div>
        <div style={{ padding: 16 }}>
          <input placeholder="搜尋服務、設計師、風格..." style={{ width: "100%", background: "#F1EFE8", border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 13, color: "#888780", marginBottom: 12, outline: "none" }} />
          <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto" }}>
            {["全部", "剪髮", "染髮", "燙髮", "護髮"].map((f) => (
              <div key={f} style={{ flexShrink: 0, fontSize: 11, padding: "5px 12px", borderRadius: 20, border: "0.5px solid #D3D1C7", background: "#fff", color: "#5F5E5A", cursor: "pointer" }}>{f}</div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#888780", marginBottom: 7 }}>選擇設計師</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
            {designers.map((d) => (
              <div key={d.id} onClick={() => setSelectedDesigner(d)} style={{ flexShrink: 0, width: 100, background: selectedDesigner.id === d.id ? "#EEEDFE" : "#fff", border: `0.5px solid ${selectedDesigner.id === d.id ? "#534AB7" : "#D3D1C7"}`, borderRadius: 12, padding: "10px 6px", textAlign: "center", cursor: "pointer" }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: d.bg, color: d.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 500, margin: "0 auto 6px" }}>{d.initials}</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#2C2C2A" }}>{d.name}</div>
                {d.nickname ? <div style={{ fontSize: 10, color: "#534AB7", margin: "2px 0" }}>{d.nickname}</div> : null}
                <div style={{ fontSize: 10, color: "#5F5E5A", margin: "2px 0", lineHeight: 1.4 }}>{d.style}</div>
                <a href={"https://www.instagram.com/" + d.ig} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: 3, marginTop: 5, textDecoration: "none" }}>
                  <IgIcon />
                  <span style={{ fontSize: 10, color: "#888780" }}>作品集</span>
                </a>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#888780", marginBottom: 7 }}>選擇服務</div>
          {services.map((s) => (
            <div key={s.id} onClick={() => setSelectedService(s)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: selectedService.id === s.id ? "#EEEDFE" : "#fff", border: `0.5px solid ${selectedService.id === s.id ? "#534AB7" : "#D3D1C7"}`, borderRadius: 10, marginBottom: 6, cursor: "pointer" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                <div style={{ fontSize: 11, color: "#5F5E5A", marginTop: 2 }}>{s.duration}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#534AB7" }}>${s.price.toLocaleString()}</div>
            </div>
          ))}
          <div style={{ fontSize: 11, color: "#888780", margin: "10px 0 7px" }}>選擇日期</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto" }}>
            {dates.map((d) => (
              <div key={d.value} onClick={() => !d.closed && setSelectedDate(d.value)} style={{ flexShrink: 0, textAlign: "center", padding: "7px 11px", borderRadius: 10, border: `0.5px solid ${selectedDate === d.value ? "#534AB7" : "#D3D1C7"}`, background: selectedDate === d.value ? "#534AB7" : "#fff", cursor: d.closed ? "default" : "pointer", fontSize: 11, color: d.closed ? "#E24B4A" : selectedDate === d.value ? "#fff" : "#5F5E5A", whiteSpace: "pre-line", lineHeight: 1.5 }}>{d.label}</div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#888780", marginBottom: 7 }}>選擇時段</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 14 }}>
            {timeSlots.map((t) => (
              <div key={t.time} onClick={() => t.available && setSelectedTime(t.time)} style={{ background: !t.available ? "#F1EFE8" : selectedTime === t.time ? "#534AB7" : "#fff", border: `0.5px solid ${selectedTime === t.time ? "#534AB7" : "#D3D1C7"}`, borderRadius: 8, padding: "7px 0", textAlign: "center", fontSize: 12, color: !t.available ? "#B4B2A9" : selectedTime === t.time ? "#fff" : "#5F5E5A", cursor: t.available ? "pointer" : "default" }}>{t.time}</div>
            ))}
          </div>
          <div style={{ background: "#EEEDFE", border: "0.5px solid #AFA9EC", borderRadius: 10, padding: "12px 14px", marginBottom: 12, fontSize: 12, color: "#3C3489", lineHeight: 2 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>設計師</span><span>{selectedDesigner.name}{selectedDesigner.nickname ? "（" + selectedDesigner.nickname + "）" : ""}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>服務</span><span>{selectedService.name}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>時間</span><span>{selectedDate}　{selectedTime}</span></div>
            <hr style={{ border: "none", borderTop: "0.5px solid #AFA9EC", margin: "6px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 500 }}><span>合計</span><span>${total.toLocaleString()}</span></div>
          </div>
          <button onClick={() => alert("預約已送出！")} style={{ width: "100%", background: "#534AB7", color: "#fff", border: "none", borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>確認預約</button>
        </div>
      </div>
    </div>
  );
}