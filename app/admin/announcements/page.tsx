"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminBottomNav from "../components/BottomNav";

type Announcement = {
  id: number;
  title: string;
  content: string;
  image_url: string;
  type: string;
  is_active: boolean;
  target: string;
  created_at: string;
};

export default function AdminAnnouncements() {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", content: "", image_url: "", type: "general", target: "all", is_active: true,
  });
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const session = sessionStorage.getItem("adminSession");
    if (!session) { router.push("/admin/login"); return; }
    fetchData();
  }, [router]);

  async function fetchData() {
    const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
    if (data) setAnnouncements(data);
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setForm({ title: "", content: "", image_url: "", type: "general", target: "all", is_active: true });
    setShowForm(true);
  }

  function openEdit(a: Announcement) {
    setEditing(a);
    setForm({ title: a.title, content: a.content||"", image_url: a.image_url||"", type: a.type||"general", target: a.target||"all", is_active: a.is_active });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.title) { alert("請填寫標題"); return; }
    setSaving(true);
    if (editing) {
      await supabase.from("announcements").update({ ...form, updated_at: new Date().toISOString() }).eq("id", editing.id);
      setAnnouncements(announcements.map(a => a.id === editing.id ? { ...a, ...form } : a));
    } else {
      const { data } = await supabase.from("announcements").insert(form).select().single();
      if (data) setAnnouncements([data, ...announcements]);
    }
    setSaving(false);
    setShowForm(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("確定刪除這則公告？")) return;
    await supabase.from("announcements").delete().eq("id", id);
    setAnnouncements(announcements.filter(a => a.id !== id));
  }

  async function toggleActive(a: Announcement) {
    await supabase.from("announcements").update({ is_active: !a.is_active }).eq("id", a.id);
    setAnnouncements(announcements.map(x => x.id === a.id ? { ...x, is_active: !a.is_active } : x));
  }

  function copyText(a: Announcement) {
    const text = `【${a.title}】\n\n${a.content}\n\n#BingCherryHairSalon`;
    navigator.clipboard.writeText(text);
    setCopiedId(a.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function shareIG(a: Announcement) {
    const text = encodeURIComponent(`【${a.title}】\n\n${a.content}`);
    window.open("https://www.instagram.com/", "_blank");
  }

  function shareLine(a: Announcement) {
    const text = encodeURIComponent(`【${a.title}】\n\n${a.content}\n\n#BingCherryHairSalon`);
    window.open(`https://social-plugins.line.me/lineit/share?url=https://bingcherryhair.com&text=${text}`, "_blank");
  }

  const typeLabels: Record<string, string> = {
    general: "一般公告", promotion: "優惠活動", new_product: "新商品", event: "活動"
  };
  const targetLabels: Record<string, string> = {
    all: "全部", designer: "設計師", customer: "顧客"
  };
  const typeColors: Record<string, string> = {
    general: "#534AB7", promotion: "#A32D2D", new_product: "#1D9E75", event: "#BA7517"
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#534AB7", fontSize: 14 }}>載入中...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", paddingBottom: 70, paddingLeft: isDesktop ? 220 : 0 }}>
      <div style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>公告管理</div>
        <button onClick={openNew} style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>+ 新增公告</button>
      </div>

      <div style={{ padding: 16 }}>
        {announcements.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#888780" }}>尚無公告</div>
        )}
        {announcements.map(a => (
          <div key={a.id} style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, border: "0.5px solid #D3D1C7", opacity: a.is_active ? 1 : 0.6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, background: typeColors[a.type]||"#534AB7", color: "#fff", borderRadius: 6, padding: "2px 8px" }}>{typeLabels[a.type]||a.type}</span>
                  <span style={{ fontSize: 10, background: "#F1EFE8", color: "#888780", borderRadius: 6, padding: "2px 8px" }}>對象：{targetLabels[a.target]||a.target}</span>
                  <span style={{ fontSize: 10, background: a.is_active ? "#E1F5EE" : "#FCEBEB", color: a.is_active ? "#085041" : "#A32D2D", borderRadius: 6, padding: "2px 8px" }}>{a.is_active ? "顯示中" : "已隱藏"}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#2C2C2A" }}>{a.title}</div>
                {a.content && <div style={{ fontSize: 12, color: "#5F5E5A", marginTop: 4, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{a.content}</div>}
                <div style={{ fontSize: 11, color: "#888780", marginTop: 6 }}>{a.created_at?.slice(0,10).replace(/-/g,"/")}</div>
              </div>
            </div>

            {/* 社群分享 */}
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              <button onClick={() => copyText(a)} style={{ padding: "5px 10px", background: copiedId === a.id ? "#E1F5EE" : "#F1EFE8", color: copiedId === a.id ? "#085041" : "#5F5E5A", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
                {copiedId === a.id ? "✓ 已複製" : "📋 複製文字"}
              </button>
              <button onClick={() => shareLine(a)} style={{ padding: "5px 10px", background: "#07B53B", color: "#fff", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>LINE 分享</button>
              <button onClick={() => shareIG(a)} style={{ padding: "5px 10px", background: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)", color: "#fff", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>IG 開啟</button>
              <button onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=https://bingcherryhair.com`, "_blank")} style={{ padding: "5px 10px", background: "#1877F2", color: "#fff", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>FB 分享</button>
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => openEdit(a)} style={{ padding: "5px 10px", background: "#EEEDFE", color: "#534AB7", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>編輯</button>
              <button onClick={() => toggleActive(a)} style={{ padding: "5px 10px", background: a.is_active ? "#FCEBEB" : "#E1F5EE", color: a.is_active ? "#A32D2D" : "#085041", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>{a.is_active ? "隱藏" : "顯示"}</button>
              <button onClick={() => handleDelete(a.id)} style={{ padding: "5px 10px", background: "#FCEBEB", color: "#A32D2D", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>刪除</button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px 16px 32px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{editing ? "編輯公告" : "新增公告"}</div>
              <button onClick={() => setShowForm(false)} style={{ background: "#F1EFE8", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer" }}>x</button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>標題 *</div>
              <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="公告標題" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>內容</div>
              <textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} placeholder="公告內容..." rows={5} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>類型</div>
                <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none" }}>
                  <option value="general">一般公告</option>
                  <option value="promotion">優惠活動</option>
                  <option value="new_product">新商品</option>
                  <option value="event">活動</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>顯示對象</div>
                <select value={form.target} onChange={e => setForm({...form, target: e.target.value})} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none" }}>
                  <option value="all">全部</option>
                  <option value="designer">設計師</option>
                  <option value="customer">顧客</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>圖片連結（選填）</div>
              <input value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})} placeholder="https://..." style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>

            <button onClick={handleSave} disabled={saving} style={{ width: "100%", padding: "12px 0", background: saving ? "#D3D1C7" : "#534AB7", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: saving ? "default" : "pointer" }}>
              {saving ? "儲存中..." : "儲存公告"}
            </button>
          </div>
        </div>
      )}

      <AdminBottomNav current="announcements" />
    </div>
  );
}
