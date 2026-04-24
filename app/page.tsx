"use client";
import { useState } from "react";

const designers = [
  { id: 1, initials: "C", name: "Cherry", nickname: "扁頭救星", style: "日系、剪髮、染髮、燙髮", ig: "bingcherry_cherry", bg: "#EEEDFE", color: "#3C3489" },
  { id: 2, initials: "M", name: "Mira", nickname: "米拉夫人", style: "日系、剪髮、染髮、燙髮", ig: "miramira_lee", bg: "#E1F5EE", color: "#085041" },
  { id: 3, initials: "J", name: "Joey", nickname: "", style: "日系、剪髮、染髮、燙髮", ig: "wang7723", bg: "#FAEEDA", color: "#633806" },
  { id: 4, initials: "A", name: "Alisa", nickname: "", style: "日系、男士剪髮、染髮、燙髮", ig: "wan__yu94", bg: "#E6F1FB", color: "#0C447C" },
  { id: 5, initials: "P", name: "Peggy", nickname: "", style: "日系、剪髮、染髮、燙髮", ig: "peggyhair.tainan", bg: "#F4C0D1", color: "#72243E" },
];

const serviceCategories = [
  { id: "cut", label: "✂ 剪髮", color: "#E1F5EE", textColor: "#085041",
    items: [
      { id: 1, name: "剪髮（含髮浴）", duration: "60 分鐘" },
      { id: 2, name: "單剪髮（不含髮浴）", duration: "45 分鐘" },
    ],
  },
  { id: "perm", label: "〜 燙髮", color: "#EEEDFE", textColor: "#3C3489",
    items: [
      { id: 3, name: "質感燙＋剪髮", duration: "150 分鐘" },
      { id: 4, name: "瀏海設計燙（不含洗）", duration: "60 分鐘" },
    ],
  },
  { id: "color", label: "◎ 染髮", color: "#FAEEDA", textColor: "#633806",
    items: [
      { id: 5, name: "設計染（單色）", duration: "120 分鐘" },
      { id: 6, name: "補染髮根（2cm內）", duration: "90 分鐘" },
    ],
  },
  { id: "treatment", label: "♡ 護髮", color: "#FCF0F8", textColor: "#72243E",
    items: [
      { id: 7, name: "HHN深層結構護髮", duration: "90 分鐘" },
      { id: 8, name: "快速護髮", duration: "60 分鐘" },
    ],
  },
  { id: "shampoo", label: "✿ 髮浴", color: "#E6F1FB", textColor: "#0C447C",
    items: [
      { id: 9, name: "精油髮浴", duration: "45 分鐘" },
      { id: 10, name: "深層淨化髮浴（含基本造型）", duration: "60 分鐘" },
      { id: 11, name: "高階頭皮深呼吸", duration: "75 分鐘" },
    ],
  },
];

const priceData = [
  { category: "燙髮 PERMANENT", items: [
    { name: "質感燙＋剪髮", range: "$2600 / $3000 / $3800 / $4200" },
    { name: "瀏海設計燙（不含洗）", range: "$800up – $1500" },
  ]},
  { category: "染髮 COLOR", items: [
    { name: "設計染（單色）", range: "$2200 / $2500 / $3000 / $3300" },
    { name: "補染髮根（2cm內）", range: "$1700（含洗髮及基礎頭皮隔離）" },
  ]},
  { category: "護髮 TREATMENT", items: [
    { name: "HHN深層結構護髮", range: "$1700 / $1900 / $2300 / $2600" },
    { name: "快速護髮", range: "$500 / $800 / $1100" },
  ]},
  { category: "髮浴 SHAMPOO", items: [
    { name: "精油髮浴", range: "$400 ＋ 造型 $100up" },
    { name: "深層淨化髮浴（含基本造型）", range: "$1000" },
    { name: "高階頭皮深呼吸", range: "$1700" },
  ]},
  { category: "剪髮 HAIR CUT", items: [
    { name: "剪髮（含髮浴）", range: "$800 / 孩童$500（國小以下）" },
    { name: "單剪髮（不含髮浴）", range: "$650 / 孩童$450" },
  ]},
];

// ── 設計師休假 & 不接客時段設定（之後會從後台控制）──
const designerSchedule: Record<number, { offDays: string[]; offSlots: Record<string, string[]> }> = {
  1: { // Cherry
    offDays: ["2025-04-26", "2025-04-30"],
    offSlots: { "2025-04-22": ["10:00", "11:00"], "2025-04-24": ["16:00", "17:00"] },
  },
  2: { // Mira
    offDays: ["2025-04-25"],
    offSlots: { "2025-04-23": ["13:00", "14:00"] },
  },
  3: { offDays: ["2025-04-27"], offSlots: {} },
  4: { offDays: ["2025-04-26"], offSlots: {} },
  5: { offDays: ["2025-04-28", "2025-04-29"], offSlots: {} },
};

const allTimeSlots = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
// 12:00 固定午休
const lunchBreak = ["12:00"];

const weekDays = ["日", "一", "二", "三", "四", "五", "六"];

function buildCalendar(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  return { firstDay, daysInMonth };
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

function PriceSheet({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 390, background: "#fff", borderRadius: "20px 20px 0 0", maxHeight: "85vh", overflowY: "auto", padding: "20px 16px 32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>價目表</div>
            <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>染、燙、護髮依髮長及髮量收費</div>
          </div>
          <button onClick={onClose} style={{ background: "#F1EFE8", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ background: "#FAEEDA", border: "0.5px solid #FAC775", borderRadius: 10, padding: "8px 12px", marginBottom: 14, fontSize: 11, color: "#633806" }}>
          S 耳上 ／ M 下巴上 ／ L 胸上 ／ XL 胸下<br />
          長度超過肚臍以下，由設計師現場諮詢報價。
        </div>
        {priceData.map((cat) => (
          <div key={cat.category} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 600, borderBottom: "1px solid #D3D1C7", paddingBottom: 6, marginBottom: 8 }}>{cat.category}</div>
            {cat.items.map((item) => (
              <div key={item.name} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "0.5px solid #F1EFE8" }}>
                <div style={{ fontSize: 12, color: "#2C2C2A", flex: 1 }}>{item.name}</div>
                <div style={{ fontSize: 12, color: "#534AB7", fontWeight: 500, marginLeft: 8 }}>{item.range}</div>
              </div>
            ))}
          </div>
        ))}
        <div style={{ textAlign: "center", fontSize: 11, color: "#888780" }}>消費滿 $2000 以上，歡迎使用 LINE PAY</div>
      </div>
    </div>
  );
}

export default function Home() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedDesigner, setSelectedDesigner] = useState(designers[0]);
  const [selectedServices, setSelectedServices] = useState<number[]>([]);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [showPrice, setShowPrice] = useState(false);

  const { firstDay, daysInMonth } = buildCalendar(year, month);
  const schedule = designerSchedule[selectedDesigner.id];

  function isOffDay(dateStr: string) {
    return schedule.offDays.includes(dateStr);
  }

  function isOffSlot(dateStr: string, time: string) {
    return lunchBreak.includes(time) || (schedule.offSlots[dateStr] || []).includes(time);
  }

  function toggleService(id: number) {
    setSelectedServices((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  }

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
    setSelectedDate(null); setSelectedTime(null);
  }

  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
    setSelectedDate(null); setSelectedTime(null);
  }

  const allSelectedItems = serviceCategories.flatMap((c) => c.items.filter((i) => selectedServices.includes(i.id)));

  const calendarCells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", justifyContent: "center", padding: "24px 16px" }}>
      {showPrice && <PriceSheet onClose={() => setShowPrice(false)} />}
      <div style={{ width: "100%", maxWidth: 390, background: "#fff", borderRadius: 20, overflow: "hidden", border: "1px solid #D3D1C7" }}>
        <div style={{ background: "#fff", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "0.5px solid #D3D1C7" }}>
          <span style={{ fontSize: 16, fontWeight: 500 }}>Bing Cherry Hair Salon</span>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#CECBF6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 500, color: "#3C3489" }}>王小</div>
        </div>

        <div style={{ padding: 16 }}>
          <input placeholder="搜尋服務、設計師、風格..." style={{ width: "100%", background: "#F1EFE8", border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 13, color: "#888780", marginBottom: 12, outline: "none" }} />

          {/* 設計師 */}
          <div style={{ fontSize: 11, color: "#888780", marginBottom: 7 }}>選擇設計師</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
            {designers.map((d) => (
              <div key={d.id} onClick={() => { setSelectedDesigner(d); setSelectedDate(null); setSelectedTime(null); }} style={{ flexShrink: 0, width: 100, background: selectedDesigner.id === d.id ? "#EEEDFE" : "#fff", border: `0.5px solid ${selectedDesigner.id === d.id ? "#534AB7" : "#D3D1C7"}`, borderRadius: 12, padding: "10px 6px", textAlign: "center", cursor: "pointer" }}>
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

          {/* 服務 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: "#888780" }}>
              選擇服務
              {selectedServices.length > 0 && <span style={{ marginLeft: 6, background: "#534AB7", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10 }}>{selectedServices.length}</span>}
            </div>
            <button onClick={() => setShowPrice(true)} style={{ fontSize: 11, color: "#534AB7", background: "#EEEDFE", border: "none", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>查看價目表 →</button>
          </div>
          {serviceCategories.map((cat) => {
            const pickedCount = cat.items.filter((i) => selectedServices.includes(i.id)).length;
            const isOpen = openCategory === cat.id;
            return (
              <div key={cat.id} style={{ width: "100%", marginBottom: 4 }}>
                <div onClick={() => setOpenCategory(isOpen ? null : cat.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: pickedCount > 0 ? cat.color : "#fff", border: `0.5px solid ${pickedCount > 0 ? cat.textColor + "40" : "#D3D1C7"}`, borderRadius: isOpen ? "10px 10px 0 0" : 10, cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#2C2C2A" }}>{cat.label}</span>
                    {pickedCount > 0 && <span style={{ fontSize: 10, background: cat.textColor, color: "#fff", borderRadius: 10, padding: "1px 7px" }}>{pickedCount} 項</span>}
                  </div>
                  <span style={{ fontSize: 11, color: "#888780" }}>{isOpen ? "▲" : "▼"}</span>
                </div>
                {isOpen && (
                  <div style={{ border: "0.5px solid #D3D1C7", borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
                    {cat.items.map((item) => {
                      const picked = selectedServices.includes(item.id);
                      return (
                        <div key={item.id} onClick={() => toggleService(item.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: picked ? cat.color : "#fff", borderTop: "0.5px solid #F1EFE8", cursor: "pointer" }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: picked ? 500 : 400, color: "#2C2C2A" }}>{item.name}</div>
                            <div style={{ fontSize: 10, color: "#888780", marginTop: 2 }}>{item.duration}</div>
                          </div>
                          <div style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${picked ? cat.textColor : "#D3D1C7"}`, background: picked ? cat.textColor : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
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

          {/* 月曆 */}
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <button onClick={prevMonth} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#534AB7", padding: "0 8px" }}>‹</button>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#2C2C2A" }}>{year} 年 {month} 月</span>
              <button onClick={nextMonth} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#534AB7", padding: "0 8px" }}>›</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, marginBottom: 4 }}>
              {weekDays.map((d) => (
                <div key={d} style={{ textAlign: "center", fontSize: 10, color: "#888780", padding: "2px 0" }}>{d}</div>
              ))}
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
                return (
                  <div key={idx} onClick={() => { if (!disabled) { setSelectedDate(dateStr); setSelectedTime(null); } }} style={{ textAlign: "center", padding: "7px 0", borderRadius: 8, fontSize: 12, cursor: disabled ? "default" : "pointer", background: isSelected ? "#534AB7" : isOff ? "#F1EFE8" : "#fff", color: isSelected ? "#fff" : disabled ? "#C8C6BE" : isSunday ? "#E24B4A" : "#2C2C2A", border: `0.5px solid ${isSelected ? "#534AB7" : "#E8E6DF"}`, position: "relative" }}>
                    {day}
                    {isOff && !isPast && <div style={{ fontSize: 7, color: "#B4B2A9", lineHeight: 1 }}>休</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 時段 */}
          {selectedDate && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "#888780", marginBottom: 7 }}>
                選擇時段 — {selectedDate.replace(/-/g, "/")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                {allTimeSlots.map((t) => {
                  const off = isOffSlot(selectedDate, t);
                  const picked = selectedTime === t;
                  return (
                    <div key={t} onClick={() => { if (!off) setSelectedTime(t); }} style={{ background: off ? "#F1EFE8" : picked ? "#534AB7" : "#fff", border: `0.5px solid ${picked ? "#534AB7" : "#D3D1C7"}`, borderRadius: 8, padding: "7px 0", textAlign: "center", fontSize: 12, color: off ? "#C8C6BE" : picked ? "#fff" : "#5F5E5A", cursor: off ? "default" : "pointer" }}>
                      {t}
                      {off && <div style={{ fontSize: 8, color: "#C8C6BE" }}>✕</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 摘要 */}
          <div style={{ background: "#EEEDFE", border: "0.5px solid #AFA9EC", borderRadius: 10, padding: "12px 14px", marginBottom: 12, fontSize: 12, color: "#3C3489", lineHeight: 2 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>設計師</span><span>{selectedDesigner.name}{selectedDesigner.nickname ? "（" + selectedDesigner.nickname + "）" : ""}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0 }}>服務</span>
              <span style={{ textAlign: "right", color: allSelectedItems.length > 0 ? "#3C3489" : "#AFA9EC" }}>{allSelectedItems.length > 0 ? allSelectedItems.map((i) => i.name).join("、") : "尚未選擇"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>日期</span>
              <span style={{ color: selectedDate ? "#3C3489" : "#AFA9EC" }}>{selectedDate ? selectedDate.replace(/-/g, "/") : "尚未選擇"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>時段</span>
              <span style={{ color: selectedTime ? "#3C3489" : "#AFA9EC" }}>{selectedTime || "尚未選擇"}</span>
            </div>
            <hr style={{ border: "none", borderTop: "0.5px solid #AFA9EC", margin: "6px 0" }} />
            <div style={{ fontSize: 11, color: "#888780", textAlign: "center" }}>實際價格由設計師現場確認</div>
          </div>

          <button
            onClick={() => {
              if (selectedServices.length === 0) { alert("請至少選擇一項服務"); return; }
              if (!selectedDate) { alert("請選擇日期"); return; }
              if (!selectedTime) { alert("請選擇時段"); return; }
              alert("預約已送出！");
            }}
            style={{ width: "100%", background: (selectedServices.length > 0 && selectedDate && selectedTime) ? "#534AB7" : "#B4B2A9", color: "#fff", border: "none", borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 500, cursor: "pointer" }}
          >
            確認預約
          </button>
        </div>
      </div>
    </div>
  );
}