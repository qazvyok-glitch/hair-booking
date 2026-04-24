"use client";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

type Designer = {
  id: number;
  name: string;
  nickname: string;
  initials: string;
  style: string;
  ig: string;
  bg_color: string;
  text_color: string;
  work_hours: string[];
};

type ServiceCategory = {
  id: number;
  name: string;
  label: string;
  color: string;
  text_color: string;
  items: Service[];
};

type Service = {
  id: number;
  name: string;
  duration: string;
  note: string;
};

type PriceItem = {
  id: number;
  category: string;
  name: string;
  price_range: string;
};

type OffDay = { designer_id: number; off_date: string };
type OffSlot = { designer_id: number; slot_date: string; slot_time: string };

const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
const fontSizes = [{ label: "小", value: 0.85 }, { label: "中", value: 1 }, { label: "大", value: 1.15 }];

function buildCalendar(year: number, month: number) {
  return {
    firstDay: new Date(year, month - 1, 1).getDay(),
    daysInMonth: new Date(year, month, 0).getDate(),
  };
}
function pad(n: number) { return n < 10 ? "0" + n : "" + n; }

function IgIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f09433" />
          <stop offset="50%" stopColor="#dc2743" />
          <stop offset="100%" stopColor="#bc1888" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#ig-grad)" />
      <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.8" fill="none" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="white" />
    </svg>
  );
}

function PriceSheet({ onClose, dark, fs, priceData }: { onClose: () => void; dark: boolean; fs: number; priceData: PriceItem[] }) {
  const bg = dark ? "#2A2A2A" : "#fff";
  const text = dark ? "#F0EFEA" : "#2C2C2A";
  const categories = [...new Set(priceData.map(p => p.category))];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 390, background: bg, borderRadius: "20px 20px 0 0", maxHeight: "85vh", overflowY: "auto", padding: "20px 16px 32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: fs * 16, fontWeight: 600, color: text }}>價目表</div>
            <div style={{ fontSize: fs * 11, color: "#888780", marginTop: 2 }}>染、燙、護髮依髮長及髮量收費</div>
          </div>
          <button onClick={onClose} style={{ background: dark ? "#3A3A3A" : "#F1EFE8", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer", color: text }}>✕</button>
        </div>
        <div style={{ background: "#FAEEDA", border: "0.5px solid #FAC775", borderRadius: 10, padding: "8px 12px", marginBottom: 14, fontSize: fs * 11, color: "#633806" }}>
          S 耳上 ／ M 下巴上 ／ L 胸上 ／ XL 胸下<br />
          長度超過肚臍以下，由設計師現場諮詢報價。
        </div>
        {categories.map((cat) => (
          <div key={cat} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: fs * 14, fontWeight: 600, borderBottom: "1px solid " + (dark ? "#3A3A3A" : "#D3D1C7"), paddingBottom: 6, marginBottom: 8, color: text }}>{cat}</div>
            {priceData.filter(p => p.category === cat).map((item) => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "0.5px solid " + (dark ? "#333" : "#F1EFE8") }}>
                <div style={{ fontSize: fs * 12, color: text, flex: 1 }}>{item.name}</div>
                <div style={{ fontSize: fs * 12, color: "#7B6FD4", fontWeight: 500, marginLeft: 8 }}>{item.price_range}</div>
              </div>
            ))}
          </div>
        ))}
        <div style={{ textAlign: "center", fontSize: fs * 11, color: "#888780" }}>消費滿 $2000 以上，歡迎使用 LINE PAY</div>
      </div>
    </div>
  );
}

export default function Home() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [dark, setDark] = useState(false);
  const [fsIndex, setFsIndex] = useState(1);
  const [showPrice, setShowPrice] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedDesigner, setSelectedDesigner] = useState<Designer | null>(null);
  const [selectedServices, setSelectedServices] = useState<number[]>([]);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [priceData, setPriceData] = useState<PriceItem[]>([]);
  const [offDays, setOffDays] = useState<OffDay[]>([]);
  const [offSlots, setOffSlots] = useState<OffSlot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const [{ data: des }, { data: cats }, { data: svcs }, { data: prices }, { data: offD }, { data: offS }] = await Promise.all([
        supabase.from("designers").select("*").eq("is_active", true).order("id"),
        supabase.from("service_categories").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("services").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("price_items").select("*").order("sort_order"),
        supabase.from("designer_off_days").select("*"),
        supabase.from("designer_off_slots").select("*"),
      ]);
      if (des) { setDesigners(des); if (des.length > 0) setSelectedDesigner(des[0]); }
      if (cats && svcs) {
        setCategories(cats.map((c: ServiceCategory) => ({
          ...c,
          items: svcs.filter((s: Service & { category_id: number }) => s.category_id === c.id),
        })));
      }
      if (prices) setPriceData(prices);
      if (offD) setOffDays(offD);
      if (offS) setOffSlots(offS);
      setLoading(false);
    }
    fetchData();
  }, []);

  const fs = fontSizes[fsIndex].value;
  const { firstDay, daysInMonth } = buildCalendar(year, month);

  function isOffDay(dateStr: string) {
    if (!selectedDesigner) return false;
    return offDays.some(d => d.designer_id === selectedDesigner.id && d.off_date === dateStr);
  }
  function isOffSlot(dateStr: string, time: string) {
    if (!selectedDesigner) return false;
    return offSlots.some(s => s.designer_id === selectedDesigner.id && s.slot_date === dateStr && s.slot_time === time);
  }
  function toggleService(id: number) {
    setSelectedServices(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  }
  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1);
    setSelectedDate(null); setSelectedTime(null);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1);
    setSelectedDate(null); setSelectedTime(null);
  }

  const allSelectedItems = categories.flatMap(c => c.items.filter(i => selectedServices.includes(i.id)));
  const calendarCells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  const bg = dark ? "#1A1A1A" : "#F1EFE8";
  const cardBg = dark ? "#2A2A2A" : "#fff";
  const cardBorder = dark ? "#3A3A3A" : "#D3D1C7";
  const textMain = dark ? "#F0EFEA" : "#2C2C2A";
  const textSub = dark ? "#888780" : "#5F5E5A";
  const inputBg = dark ? "#222" : "#F1EFE8";
  const summaryBg = dark ? "#2C2840" : "#EEEDFE";
  const summaryBorder = dark ? "#4A4580" : "#AFA9EC";
  const summaryText = dark ? "#C8C4F8" : "#3C3489";

  if (loading) return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#534AB7", fontSize: 14 }}>載入中...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", justifyContent: "center", padding: "24px 16px 0" }}>
      {showPrice && <PriceSheet onClose={() => setShowPrice(false)} dark={dark} fs={fs} priceData={priceData} />}

      {showSettings && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 390, background: cardBg, borderRadius: "20px 20px 0 0", padding: "20px 16px 32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: fs * 16, fontWeight: 600, color: textMain }}>顯示設定</div>
              <button onClick={() => setShowSettings(false)} style={{ background: dark ? "#3A3A3A" : "#F1EFE8", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer", color: textMain }}>✕</button>
            </div>
            <div style={{ fontSize: fs * 12, color: textSub, marginBottom: 8 }}>色彩模式</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {[{ label: "☀ 亮色", val: false }, { label: "☾ 深色", val: true }].map((m) => (
                <div key={m.label} onClick={() => setDark(m.val)} style={{ flex: 1, textAlign: "center", padding: "10px 0", borderRadius: 10, border: `1.5px solid ${dark === m.val ? "#534AB7" : cardBorder}`, background: dark === m.val ? (dark ? "#2C2840" : "#EEEDFE") : cardBg, cursor: "pointer", fontSize: fs * 13, color: dark === m.val ? "#534AB7" : textSub, fontWeight: dark === m.val ? 500 : 400 }}>
                  {m.label}
                </div>
              ))}
            </div>
            <div style={{ fontSize: fs * 12, color: textSub, marginBottom: 8 }}>字體大小</div>
            <div style={{ display: "flex", gap: 8 }}>
              {fontSizes.map((f, i) => (
                <div key={f.label} onClick={() => setFsIndex(i)} style={{ flex: 1, textAlign: "center", padding: "10px 0", borderRadius: 10, border: `1.5px solid ${fsIndex === i ? "#534AB7" : cardBorder}`, background: fsIndex === i ? (dark ? "#2C2840" : "#EEEDFE") : cardBg, cursor: "pointer", fontSize: f.value * 14, color: fsIndex === i ? "#534AB7" : textSub, fontWeight: fsIndex === i ? 500 : 400 }}>
                  {f.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ width: "100%", maxWidth: 390, background: cardBg, borderRadius: "20px 20px 0 0", overflow: "hidden", border: "1px solid " + cardBorder, borderBottom: "none", paddingBottom: 80 }}>
        <div style={{ background: cardBg, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "0.5px solid " + cardBorder }}>
          <span style={{ fontSize: fs * 16, fontWeight: 500, color: textMain }}>Bing Cherry Hair Salon</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setShowSettings(true)} style={{ background: dark ? "#333" : "#F1EFE8", border: "none", borderRadius: 20, width: 32, height: 32, fontSize: 15, cursor: "pointer", color: dark ? "#F0EFEA" : "#5F5E5A" }}>⚙</button>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#CECBF6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: fs * 11, fontWeight: 500, color: "#3C3489" }}>王小</div>
          </div>
        </div>

        <div style={{ padding: 16 }}>
          <input placeholder="搜尋服務、設計師、風格..." style={{ width: "100%", background: inputBg, border: "none", borderRadius: 10, padding: "9px 14px", fontSize: fs * 13, color: textSub, marginBottom: 12, outline: "none" }} />

          <div style={{ fontSize: fs * 11, color: textSub, marginBottom: 7 }}>選擇設計師</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
            {designers.map((d) => (
              <div key={d.id} onClick={() => { setSelectedDesigner(d); setSelectedDate(null); setSelectedTime(null); }} style={{ flexShrink: 0, width: 100, background: selectedDesigner?.id === d.id ? (dark ? "#2C2840" : "#EEEDFE") : cardBg, border: `0.5px solid ${selectedDesigner?.id === d.id ? "#534AB7" : cardBorder}`, borderRadius: 12, padding: "10px 6px", textAlign: "center", cursor: "pointer" }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: d.bg_color, color: d.text_color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 500, margin: "0 auto 6px" }}>{d.initials}</div>
                <div style={{ fontSize: fs * 12, fontWeight: 500, color: textMain }}>{d.name}</div>
                {d.nickname ? <div style={{ fontSize: fs * 10, color: "#7B6FD4", margin: "2px 0" }}>{d.nickname}</div> : null}
                <div style={{ fontSize: fs * 10, color: textSub, margin: "2px 0", lineHeight: 1.4 }}>{d.style}</div>
                <a href={"https://www.instagram.com/" + d.ig} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: 3, marginTop: 5, textDecoration: "none" }}>
                  <IgIcon />
                  <span style={{ fontSize: fs * 10, color: textSub }}>作品集</span>
                </a>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: fs * 11, color: textSub }}>
              選擇服務
              {selectedServices.length > 0 && <span style={{ marginLeft: 6, background: "#534AB7", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: fs * 10 }}>{selectedServices.length}</span>}
            </div>
            <button onClick={() => setShowPrice(true)} style={{ fontSize: fs * 11, color: "#7B6FD4", background: dark ? "#2C2840" : "#EEEDFE", border: "none", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>查看價目表 →</button>
          </div>

          {categories.map((cat) => {
            const pickedCount = cat.items.filter(i => selectedServices.includes(i.id)).length;
            const isOpen = openCategory === cat.name;
            return (
              <div key={cat.id} style={{ width: "100%", marginBottom: 4 }}>
                <div onClick={() => setOpenCategory(isOpen ? null : cat.name)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: pickedCount > 0 ? (dark ? "#2C2840" : cat.color) : cardBg, border: `0.5px solid ${pickedCount > 0 ? cat.text_color + "40" : cardBorder}`, borderRadius: isOpen ? "10px 10px 0 0" : 10, cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: fs * 13, fontWeight: 500, color: textMain }}>{cat.label}</span>
                    {pickedCount > 0 && <span style={{ fontSize: fs * 10, background: cat.text_color, color: "#fff", borderRadius: 10, padding: "1px 7px" }}>{pickedCount} 項</span>}
                  </div>
                  <span style={{ fontSize: fs * 11, color: textSub }}>{isOpen ? "▲" : "▼"}</span>
                </div>
                {isOpen && (
                  <div style={{ border: "0.5px solid " + cardBorder, borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
                    {cat.items.map((item) => {
                      const picked = selectedServices.includes(item.id);
                      return (
                        <div key={item.id} onClick={() => toggleService(item.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: picked ? (dark ? "#2C2840" : cat.color) : cardBg, borderTop: "0.5px solid " + (dark ? "#333" : "#F1EFE8"), cursor: "pointer" }}>
                          <div>
                            <div style={{ fontSize: fs * 12, fontWeight: picked ? 500 : 400, color: textMain }}>{item.name}</div>
                            <div style={{ fontSize: fs * 10, color: textSub, marginTop: 2 }}>{item.duration}{item.note ? "・" + item.note : ""}</div>
                          </div>
                          <div style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${picked ? cat.text_color : cardBorder}`, background: picked ? cat.text_color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {picked && <span style={{ color: "#fff", fontSize: 12 }}>✓</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <button onClick={prevMonth} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#7B6FD4", padding: "0 8px" }}>‹</button>
              <span style={{ fontSize: fs * 14, fontWeight: 500, color: textMain }}>{year} 年 {month} 月</span>
              <button onClick={nextMonth} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#7B6FD4", padding: "0 8px" }}>›</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, marginBottom: 4 }}>
              {weekDays.map(d => <div key={d} style={{ textAlign: "center", fontSize: fs * 10, color: textSub, padding: "2px 0" }}>{d}</div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, marginBottom: 12 }}>
              {calendarCells.map((day, idx) => {
                if (!day) return <div key={idx} />;
                const dateStr = `${year}-${pad(month)}-${pad(day)}`;
                const isPast = new Date(dateStr) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const isOff = isOffDay(dateStr);
                const isSelected = selectedDate === dateStr;
                const isSunday = new Date(dateStr).getDay() === 0;
                const disabled = isPast || isOff;
                const isToday = dateStr === `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
                return (
                  <div key={idx} onClick={() => { if (!disabled) { setSelectedDate(dateStr); setSelectedTime(null); } }} style={{ textAlign: "center", padding: "6px 0", borderRadius: 8, fontSize: fs * 12, cursor: disabled ? "default" : "pointer", background: isSelected ? "#534AB7" : isOff ? (dark ? "#222" : "#F1EFE8") : isToday ? (dark ? "#2C2840" : "#EEEDFE") : cardBg, color: isSelected ? "#fff" : disabled ? (dark ? "#444" : "#C8C6BE") : isSunday ? "#E24B4A" : textMain, border: `0.5px solid ${isSelected ? "#534AB7" : isToday ? "#AFA9EC" : cardBorder}`, fontWeight: isToday ? 600 : 400 }}>
                    {day}
                    {isOff && !isPast && <div style={{ fontSize: fs * 7, color: dark ? "#555" : "#B4B2A9", lineHeight: 1 }}>休</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {selectedDate && selectedDesigner && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: fs * 11, color: textSub, marginBottom: 7 }}>選擇時段 — {selectedDate.replace(/-/g, "/")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                {(selectedDesigner.work_hours || []).map((t) => {
                  const off = isOffSlot(selectedDate, t);
                  const picked = selectedTime === t;
                  return (
                    <div key={t} onClick={() => { if (!off) setSelectedTime(t); }} style={{ background: off ? (dark ? "#222" : "#F1EFE8") : picked ? "#534AB7" : cardBg, border: `0.5px solid ${picked ? "#534AB7" : cardBorder}`, borderRadius: 8, padding: "7px 0", textAlign: "center", fontSize: fs * 12, color: off ? (dark ? "#444" : "#C8C6BE") : picked ? "#fff" : textMain, cursor: off ? "default" : "pointer" }}>
                      {t}
                      {off && <div style={{ fontSize: fs * 8, color: dark ? "#555" : "#C8C6BE" }}>✕</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ background: summaryBg, border: "0.5px solid " + summaryBorder, borderRadius: 10, padding: "12px 14px", marginBottom: 12, fontSize: fs * 12, color: summaryText, lineHeight: 2 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>設計師</span><span>{selectedDesigner?.name}{selectedDesigner?.nickname ? "（" + selectedDesigner.nickname + "）" : ""}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0 }}>服務</span>
              <span style={{ textAlign: "right", color: allSelectedItems.length > 0 ? summaryText : (dark ? "#4A4580" : "#AFA9EC") }}>{allSelectedItems.length > 0 ? allSelectedItems.map(i => i.name).join("、") : "尚未選擇"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>日期</span>
              <span style={{ color: selectedDate ? summaryText : (dark ? "#4A4580" : "#AFA9EC") }}>{selectedDate ? selectedDate.replace(/-/g, "/") : "尚未選擇"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>時段</span>
              <span style={{ color: selectedTime ? summaryText : (dark ? "#4A4580" : "#AFA9EC") }}>{selectedTime || "尚未選擇"}</span>
            </div>
            <hr style={{ border: "none", borderTop: "0.5px solid " + summaryBorder, margin: "6px 0" }} />
            <div style={{ fontSize: fs * 11, color: dark ? "#6B67A8" : "#888780", textAlign: "center" }}>實際價格由設計師現場確認</div>
          </div>

          <button
            onClick={async () => {
              if (!selectedDesigner || selectedServices.length === 0 || !selectedDate || !selectedTime) {
                alert("請完整填寫所有選項"); return;
              }
              const { error } = await supabase.from("bookings").insert({
                designer_id: selectedDesigner.id,
                service_ids: selectedServices,
                booking_date: selectedDate,
                booking_time: selectedTime,
              });
              if (error) { alert("預約失敗，請再試一次"); return; }
              alert("預約已送出！我們會盡快與您確認。");
              setSelectedServices([]); setSelectedDate(null); setSelectedTime(null);
            }}
            style={{ width: "100%", background: (selectedServices.length > 0 && selectedDate && selectedTime) ? "#534AB7" : (dark ? "#333" : "#B4B2A9"), color: "#fff", border: "none", borderRadius: 10, padding: 12, fontSize: fs * 14, fontWeight: 500, cursor: "pointer", marginBottom: 16 }}
          >
            確認預約
          </button>
        </div>
      </div>

      {/* 底部導覽列 */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 390, background: cardBg, borderTop: "0.5px solid " + cardBorder, display: "flex", zIndex: 50 }}>
        <a href="/" style={{ flex: 1, padding: "10px 0", textAlign: "center", textDecoration: "none" }}>
          <div style={{ fontSize: 20 }}>✂</div>
          <div style={{ fontSize: 10, color: "#534AB7", marginTop: 2 }}>預約</div>
        </a>
        <a href="/about" style={{ flex: 1, padding: "10px 0", textAlign: "center", textDecoration: "none" }}>
          <div style={{ fontSize: 20 }}>🍒</div>
          <div style={{ fontSize: 10, color: textSub, marginTop: 2 }}>關於我們</div>
        </a>
      </div>

    </div>
  );
}