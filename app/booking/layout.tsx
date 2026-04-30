"use client";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSettingsStore, fontSizes } from "../../store/settingsStore";

const steps = [
  { label: "電話", path: "/booking",        exact: true },
  { label: "設計師", path: "/booking/step/1" },
  { label: "服務",   path: "/booking/step/2" },
  { label: "時間",   path: "/booking/step/3" },
  { label: "確認",   path: "/booking/step/4" },
];

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const currentStep = (() => {
    for (let i = steps.length - 1; i >= 0; i--) {
      const s = steps[i];
      if (s.exact ? pathname === s.path : pathname.startsWith(s.path)) return i + 1;
    }
    return 0;
  })();

  const isSuccess = pathname.includes("/booking/success");
  const { dark, fsIndex, setDark, setFsIndex } = useSettingsStore();
  const [showSettings, setShowSettings] = useState(false);
  const fs = fontSizes[fsIndex].value;

  const bg      = dark ? "#1A1A1A" : "#f0e9e0";
  const cardBg  = dark ? "#2A2A2A" : "#fdfaf7";
  const cardBorder = dark ? "#3A3A3A" : "#e5dbd0";
  const textMain = dark ? "#F0EFEA" : "#1a1a1a";
  const textSub  = dark ? "#888780" : "#4a4a4a";
  const accent   = "#7a1f1f";
  const accentPale = dark ? "#2C2020" : "#f2e8e6";

  return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", justifyContent: "center" }}>

      {/* 設定面板 */}
      {showSettings && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 390, background: cardBg, borderRadius: "20px 20px 0 0", padding: "20px 16px 32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: fs * 16, fontWeight: 600, color: textMain }}>顯示設定</div>
              <button onClick={() => setShowSettings(false)} style={{ background: dark ? "#3A3A3A" : "#f0e9e0", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer", color: textMain }}>✕</button>
            </div>
            <div style={{ fontSize: fs * 12, color: textSub, marginBottom: 8 }}>色彩模式</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {[{ label: "☀ 亮色", val: false }, { label: "☾ 深色", val: true }].map((m) => (
                <div key={m.label} onClick={() => setDark(m.val)} style={{ flex: 1, textAlign: "center", padding: "10px 0", borderRadius: 10, border: `1.5px solid ${dark === m.val ? accent : cardBorder}`, background: dark === m.val ? accentPale : cardBg, cursor: "pointer", fontSize: fs * 13, color: dark === m.val ? accent : textSub, fontWeight: dark === m.val ? 500 : 400 }}>
                  {m.label}
                </div>
              ))}
            </div>
            <div style={{ fontSize: fs * 12, color: textSub, marginBottom: 8 }}>字體大小</div>
            <div style={{ display: "flex", gap: 8 }}>
              {fontSizes.map((f, i) => (
                <div key={f.label} onClick={() => setFsIndex(i)} style={{ flex: 1, textAlign: "center", padding: "10px 0", borderRadius: 10, border: `1.5px solid ${fsIndex === i ? accent : cardBorder}`, background: fsIndex === i ? accentPale : cardBg, cursor: "pointer", fontSize: f.value * 14, color: fsIndex === i ? accent : textSub, fontWeight: fsIndex === i ? 500 : 400 }}>
                  {f.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ width: "100%", maxWidth: 390, background: cardBg, display: "flex", flexDirection: "column", minHeight: "100vh", border: `0.5px solid ${cardBorder}` }}>

        {/* 頂部標題 */}
        <div style={{ padding: "14px 16px", borderBottom: `0.5px solid ${cardBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: fs * 16, fontWeight: 500, color: textMain }}>Bing Cherry Hair Salon</span>
          <button onClick={() => setShowSettings(true)} style={{ background: dark ? "#333" : "#f0e9e0", border: "none", borderRadius: 20, width: 32, height: 32, fontSize: 15, cursor: "pointer", color: dark ? "#F0EFEA" : "#4a4a4a" }}>⚙</button>
        </div>

        {/* 進度條 */}
        {!isSuccess && currentStep > 0 && (
          <div style={{ padding: "14px 16px 10px", borderBottom: `0.5px solid ${cardBorder}` }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              {steps.map((step, i) => {
                const num = i + 1;
                const done = num < currentStep;
                const active = num === currentStep;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: done ? "#5a8a4a" : active ? accent : (dark ? "#333" : "#f0e9e0"),
                        color: done || active ? "#fff" : (dark ? "#555" : "#c4b8b0"),
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700,
                        border: `1.5px solid ${done ? "#5a8a4a" : active ? accent : cardBorder}`,
                        transition: "all 0.3s",
                      }}>
                        {done ? "✓" : num}
                      </div>
                      <span style={{ fontSize: fs * 10, color: active ? accent : done ? "#5a8a4a" : (dark ? "#555" : "#c4b8b0"), fontWeight: active ? 700 : 400, whiteSpace: "nowrap" }}>
                        {step.label}
                      </span>
                    </div>
                    {i < steps.length - 1 && (
                      <div style={{ flex: 1, height: 2, marginBottom: 14, marginLeft: 4, marginRight: 4, background: done ? "#5a8a4a" : cardBorder, transition: "background 0.3s" }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 頁面內容 */}
        <div style={{ flex: 1, overflowY: "auto", background: cardBg }}>
          {children}
        </div>
      </div>
    </div>
  );
}
