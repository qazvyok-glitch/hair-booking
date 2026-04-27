"use client";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F1EFE8",
      display: "flex",
      justifyContent: "center",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 390,
        background: "#1A1A1A",
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 28px",
        gap: 24,
      }}>

        {/* Logo */}
        <div style={{
          width: 100, height: 100, borderRadius: "50%",
          overflow: "hidden", border: "2px solid rgba(255,255,255,0.15)",
        }}>
          <img src="/logo.png" alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>

        {/* 品牌名稱 */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#fff", letterSpacing: "0.04em" }}>
            Bing Cherry
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 6, letterSpacing: "0.14em" }}>
            HAIR SALON · 台南
          </div>
        </div>

        {/* 標語 */}
        <div style={{
          background: "rgba(255,255,255,0.06)",
          borderRadius: 14,
          padding: "16px 24px",
          textAlign: "center",
          width: "100%",
        }}>
          <div style={{ fontSize: 15, color: "rgba(255,255,255,0.75)", lineHeight: 1.8 }}>
            專屬於你的造型體驗
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
            由專業設計師為您量身打造
          </div>
        </div>

        {/* 立即預約按鈕 */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
          <button
            onClick={() => router.push("/booking/step/1")}
            style={{
              width: "100%",
              padding: "16px 0",
              background: "#534AB7",
              color: "#fff",
              border: "none",
              borderRadius: 14,
              fontSize: 18,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "0.04em",
            }}
          >
            立即預約
          </button>

          <button
            onClick={() => router.push("/about")}
            style={{
              width: "100%",
              padding: "14px 0",
              background: "transparent",
              color: "rgba(255,255,255,0.5)",
              border: "1.5px solid rgba(255,255,255,0.15)",
              borderRadius: 14,
              fontSize: 18,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            關於我們
          </button>
        </div>

      </div>
    </div>
  );
}