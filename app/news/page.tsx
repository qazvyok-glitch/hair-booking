"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Announcement = {
  id: number;
  title: string;
  content: string;
  image_url: string;
  type: string;
  created_at: string;
};

const typeLabels: Record<string, string> = {
  general: "公告", promotion: "優惠活動", new_product: "新商品", event: "活動"
};
const typeColors: Record<string, { bg: string; color: string }> = {
  general: { bg: "#EEEDFE", color: "#534AB7" },
  promotion: { bg: "#FCEBEB", color: "#A32D2D" },
  new_product: { bg: "#E1F5EE", color: "#085041" },
  event: { bg: "#FAEEDA", color: "#BA7517" },
};

export default function NewsPage() {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Announcement | null>(null);

  useEffect(() => {
    supabase.from("announcements").select("*").eq("is_active", true).in("target", ["all", "customer"]).order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setAnnouncements(data);
      setLoading(false);
    });
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", paddingBottom: 80 }}>
      {/* 頂部 */}
      <div style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", padding: 0 }}>←</button>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>最新消息</div>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
          <div style={{ color: "#534AB7", fontSize: 14 }}>載入中...</div>
        </div>
      ) : announcements.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#888780" }}>目前沒有最新消息</div>
      ) : (
        <div style={{ padding: 16 }}>
          {announcements.map(a => (
            <div key={a.id} onClick={() => setSelected(a)} style={{ background: "#fff", borderRadius: 14, marginBottom: 12, border: "0.5px solid #D3D1C7", overflow: "hidden", cursor: "pointer" }}>
              {a.image_url && (
                <img src={a.image_url} alt={a.title} style={{ width: "100%", maxHeight: 200, objectFit: "cover" }} />
              )}
              <div style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 10, background: (typeColors[a.type]||typeColors.general).bg, color: (typeColors[a.type]||typeColors.general).color, borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>
                    {typeLabels[a.type]||"公告"}
                  </span>
                  <span style={{ fontSize: 10, color: "#888780" }}>{a.created_at?.slice(0,10).replace(/-/g,"/")}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#2C2C2A", marginBottom: 4 }}>{a.title}</div>
                {a.content && <div style={{ fontSize: 12, color: "#888780", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{a.content}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 詳情 Modal */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: "20px 20px 0 0", maxHeight: "85vh", overflowY: "auto" }}>
            {selected.image_url && (
              <img src={selected.image_url} alt={selected.title} style={{ width: "100%", maxHeight: 250, objectFit: "cover", borderRadius: "20px 20px 0 0" }} />
            )}
            <div style={{ padding: "16px 16px 40px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, background: (typeColors[selected.type]||typeColors.general).bg, color: (typeColors[selected.type]||typeColors.general).color, borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>
                      {typeLabels[selected.type]||"公告"}
                    </span>
                    <span style={{ fontSize: 10, color: "#888780" }}>{selected.created_at?.slice(0,10).replace(/-/g,"/")}</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#2C2C2A" }}>{selected.title}</div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: "#F1EFE8", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer", flexShrink: 0, marginLeft: 8 }}>x</button>
              </div>
              {selected.content && (
                <div style={{ fontSize: 13, color: "#5F5E5A", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{selected.content}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 底部導覽 */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 390, background: "#fff", borderTop: "0.5px solid #D3D1C7", display: "flex", zIndex: 50 }}>
        {[
          { icon: "🏠", label: "首頁", path: "/" },
          { icon: "✂️", label: "預約", path: "/booking/step/1" },
          { icon: "📢", label: "消息", path: "/news", active: true },
          { icon: "👤", label: "會員", path: "/member/profile" },
          { icon: "ℹ️", label: "關於", path: "/about" },
        ].map(item => (
          <button key={item.path} onClick={() => router.push(item.path)} style={{ flex: 1, padding: "10px 0", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span style={{ fontSize: 10, color: item.active ? "#534AB7" : "#888780", fontWeight: item.active ? 600 : 400 }}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
