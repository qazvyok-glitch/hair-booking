"use client";
import { usePathname, useRouter } from "next/navigation";

const steps = [
  { label: "設計師", path: "/booking/step/1" },
  { label: "服務",   path: "/booking/step/2" },
  { label: "時間",   path: "/booking/step/3" },
  { label: "確認",   path: "/booking/step/4" },
];

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentStep = steps.findIndex((s) => pathname.startsWith(s.path)) + 1;
  const isSuccess = pathname.includes("/booking/success");

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 390, background: "#fff", display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* 頂部標題 */}
        <div style={{ padding: "14px 16px", borderBottom: "0.5px solid #D3D1C7", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 500, color: "#2C2C2A" }}>Bing Cherry Hair Salon</span>
        </div>

        {/* 進度條（成功頁不顯示） */}
        {!isSuccess && currentStep > 0 && (
          <div style={{ padding: "14px 16px 10px", borderBottom: "0.5px solid #D3D1C7" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              {steps.map((step, i) => {
                const num = i + 1;
                const done = num < currentStep;
                const active = num === currentStep;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                    {/* 圓點 + 文字 */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: done ? "#4CAF50" : active ? "#534AB7" : "#F1EFE8",
                        color: done || active ? "#fff" : "#B4B2A9",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700,
                        border: `1.5px solid ${done ? "#4CAF50" : active ? "#534AB7" : "#D3D1C7"}`,
                        transition: "all 0.3s",
                      }}>
                        {done ? "✓" : num}
                      </div>
                      <span style={{
                        fontSize: 10,
                        color: active ? "#534AB7" : done ? "#4CAF50" : "#B4B2A9",
                        fontWeight: active ? 700 : 400,
                        whiteSpace: "nowrap",
                      }}>
                        {step.label}
                      </span>
                    </div>
                    {/* 連接線 */}
                    {i < steps.length - 1 && (
                      <div style={{
                        flex: 1, height: 2, marginBottom: 14, marginLeft: 4, marginRight: 4,
                        background: done ? "#4CAF50" : "#D3D1C7",
                        transition: "background 0.3s",
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 頁面內容 */}
        <div style={{ flex: 1, overflowY: "auto", background: "#fff" }}>
          {children}
        </div>

      </div>
    </div>
  );
}