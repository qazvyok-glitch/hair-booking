"use client";

export default function About() {
  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", justifyContent: "center", padding: "24px 16px 80px" }}>
      <div style={{ width: "100%", maxWidth: 390 }}>

        <div style={{ background: "#fff", borderRadius: "16px 16px 0 0", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "0.5px solid #D3D1C7" }}>
          <a href="/" style={{ fontSize: 18, color: "#534AB7", textDecoration: "none" }}>‹</a>
          <span style={{ fontSize: 16, fontWeight: 500, color: "#2C2C2A" }}>關於我們</span>
        </div>

        <div style={{ background: "#fff", padding: "28px 16px 20px", textAlign: "center", borderBottom: "0.5px solid #D3D1C7" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#EEEDFE", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: 32 }}>🍒</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#2C2C2A", marginBottom: 4 }}>Bing Cherry Hair Salon</div>
          <a href="https://www.bingcherryhairsalon.com/" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#7B6FD4", textDecoration: "none" }}>
            www.bingcherryhairsalon.com ↗
          </a>
        </div>

        <div style={{ background: "#fff", marginTop: 8, borderRadius: 12, overflow: "hidden" }}>
          <a href="https://share.google/vZVvzAYKSszLvLpZC" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderBottom: "0.5px solid #F1EFE8" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#E1F5EE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📍</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "#888780", marginBottom: 2 }}>地址</div>
                <div style={{ fontSize: 13, color: "#2C2C2A", fontWeight: 500 }}>台南市中西區西門路二段10號</div>
                <div style={{ fontSize: 11, color: "#7B6FD4", marginTop: 2 }}>點此開啟 Google Maps ↗</div>
              </div>
            </div>
          </a>

          <a href="tel:0622236608" style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderBottom: "0.5px solid #F1EFE8" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EEEDFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📞</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "#888780", marginBottom: 2 }}>電話</div>
                <div style={{ fontSize: 13, color: "#2C2C2A", fontWeight: 500 }}>06-2223608</div>
                <div style={{ fontSize: 11, color: "#7B6FD4", marginTop: 2 }}>點此撥打電話 ↗</div>
              </div>
            </div>
          </a>

          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px", borderBottom: "0.5px solid #F1EFE8" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#FAEEDA", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🕐</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "#888780", marginBottom: 6 }}>營業時間</div>
              {[
                { day: "週二 ─ 週日", time: "10:00 – 18:00" },
                { day: "週一", time: "公休" },
              ].map((r) => (
                <div key={r.day} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "#5F5E5A" }}>{r.day}</span>
                  <span style={{ fontSize: 12, color: r.time === "公休" ? "#E24B4A" : "#2C2C2A", fontWeight: r.time === "公休" ? 500 : 400 }}>{r.time}</span>
                </div>
              ))}
            </div>
          </div>

          <a href="https://www.bingcherryhairsalon.com/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#E6F1FB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🌐</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "#888780", marginBottom: 2 }}>官方網站</div>
                <div style={{ fontSize: 13, color: "#2C2C2A", fontWeight: 500 }}>bingcherryhairsalon.com</div>
                <div style={{ fontSize: 11, color: "#7B6FD4", marginTop: 2 }}>點此前往官網 ↗</div>
              </div>
            </div>
          </a>
        </div>

        <div style={{ background: "#fff", marginTop: 8, borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#2C2C2A", marginBottom: 10 }}>預約注意事項</div>
          {[
            "本店採預約制，請提前預約",
            "染、燙、護髮價格依髮長及髮量現場報價",
            "消費滿 $2000 以上歡迎使用 LINE PAY",
            "如需取消或更改預約，請提前 24 小時告知",
          ].map((note, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
              <span style={{ color: "#534AB7", fontWeight: 500, flexShrink: 0, fontSize: 12 }}>·</span>
              <span style={{ fontSize: 12, color: "#5F5E5A", lineHeight: 1.6 }}>{note}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}