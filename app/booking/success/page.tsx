"use client";
import { useRouter } from "next/navigation";

export default function BookingSuccess() {
  const router = useRouter();

  return (
    <div style={{ padding: "40px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🌸</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#2C2C2A", marginBottom: 8 }}>
        預約成功！
      </div>
      <div style={{ fontSize: 14, color: "#888780", marginBottom: 4 }}>
        我們會盡快與您確認預約時間
      </div>
      <div style={{ fontSize: 12, color: "#888780", marginBottom: 32 }}>
        請留意手機簡訊通知
      </div>

      <div style={{
        background: "#1A1A1A", borderRadius: 16, padding: 20,
        marginBottom: 24, textAlign: "left",
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#C8A45A", marginBottom: 8 }}>
          📸 請截圖保留預約資訊
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.8 }}>
          建議截圖保存此畫面作為備份
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: "rgba(200,164,90,0.8)", marginBottom: 4 }}>
            iOS：側邊鍵 + 音量上鍵
          </div>
          <div style={{ fontSize: 11, color: "rgba(200,164,90,0.8)" }}>
            Android：電源鍵 + 音量下鍵
          </div>
        </div>
      </div>

      <button
        onClick={() => router.push("/")}
        style={{
          width: "100%", padding: "14px 0",
          background: "#534AB7", color: "#fff",
          border: "none", borderRadius: 12,
          fontSize: 15, fontWeight: 600, cursor: "pointer",
        }}
      >
        回到首頁
      </button>
    </div>
  );
}