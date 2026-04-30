"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import BottomNav from "../components/BottomNav";

type DesignerSession = { id: number; name: string; nickname: string };
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

export default function DesignerAccount() {
  const router = useRouter();
  const [designer, setDesigner] = useState<DesignerSession | null>(null);
  const [profile, setProfile] = useState<Designer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nickname: "", style: "", ig: "" });
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const session = sessionStorage.getItem("designerSession");
    if (!session) { router.push("/designer/login"); return; }
    const d = JSON.parse(session);
    setDesigner(d);

    supabase.from("designers").select("*").eq("id", d.id).single().then(({ data }) => {
      if (data) {
        setProfile(data);
        setForm({ nickname: data.nickname || "", style: data.style || "", ig: data.ig || "" });
        if (data.avatar_url) setAvatarUrl(data.avatar_url);
      }
      setLoading(false);
    });
  }, [router]);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !designer) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `designer-${designer.id}.${ext}`;
    const { error } = await supabase.storage.from("designer-avatars").upload(path, file, { upsert: true });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("designer-avatars").getPublicUrl(path);
      setAvatarUrl(publicUrl);
      await supabase.from("designers").update({ avatar_url: publicUrl }).eq("id", designer.id);
    }
    setUploading(false);
  }

  async function handleSave() {
    if (!designer) return;
    setSaving(true);
    await supabase.from("designers").update({
      nickname: form.nickname,
      style: form.style,
      ig: form.ig,
    }).eq("id", designer.id);
    setSaving(false);
    alert("資料已更新！");
  }

  function logout() {
    sessionStorage.removeItem("designerSession");
    router.push("/designer/login");
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#534AB7", fontSize: 14 }}>載入中...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", paddingBottom: 70 }}>
      <div style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>個人資料</div>
        <button onClick={logout} style={{ background: "#333", color: "#888780", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>登出</button>
      </div>

      <div style={{ padding: 16 }}>
        {/* 頭像區 */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, marginBottom: 12, border: "0.5px solid #D3D1C7", textAlign: "center" }}>
          <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto 10px" }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: 80, height: 80, borderRadius: "50%", background: profile?.bg_color || "#EEEDFE", color: profile?.text_color || "#534AB7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700 }}>
                {profile?.initials || "?"}
              </div>
            )}
            <label style={{ position: "absolute", bottom: 0, right: 0, width: 26, height: 26, background: "#534AB7", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "2px solid #fff" }}>
              <span style={{ fontSize: 13, color: "#fff" }}>✎</span>
              <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: "none" }} />
            </label>
          </div>
          {uploading && <div style={{ fontSize: 11, color: "#888780", marginBottom: 4 }}>上傳中...</div>}
          <div style={{ fontSize: 18, fontWeight: 700, color: "#2C2C2A" }}>{profile?.name}</div>
          {profile?.nickname && <div style={{ fontSize: 12, color: "#7B6FD4", marginTop: 2 }}>{profile.nickname}</div>}
        </div>

        {/* 編輯表單 */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, border: "0.5px solid #D3D1C7" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A", marginBottom: 14 }}>更新資料</div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>暱稱</div>
            <input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder="例：扁頭救星" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>專長風格</div>
            <input value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value })} placeholder="例：日系、剪髮、染髮" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>Instagram 帳號</div>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #D3D1C7", borderRadius: 8, overflow: "hidden" }}>
              <span style={{ padding: "9px 10px", background: "#F1EFE8", fontSize: 13, color: "#888780", borderRight: "1px solid #D3D1C7" }}>@</span>
              <input value={form.ig} onChange={(e) => setForm({ ...form, ig: e.target.value })} placeholder="your_ig_account" style={{ flex: 1, padding: "9px 12px", border: "none", fontSize: 13, outline: "none" }} />
            </div>
            {form.ig && (
              <a href={"https://www.instagram.com/" + form.ig} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#7B6FD4", marginTop: 4, display: "block" }}>
                查看 IG 作品集 ↗
              </a>
            )}
          </div>

          <button onClick={handleSave} disabled={saving} style={{ width: "100%", padding: "12px 0", background: saving ? "#D3D1C7" : "#534AB7", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: saving ? "default" : "pointer" }}>
            {saving ? "儲存中..." : "儲存更新"}
          </button>
        </div>

        {/* 帳號資訊 */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 16, border: "0.5px solid #D3D1C7" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A", marginBottom: 10 }}>帳號資訊</div>
          <div style={{ fontSize: 12, color: "#5F5E5A", marginBottom: 6 }}>帳號：{designer?.name?.toLowerCase()}</div>
          <div style={{ fontSize: 11, color: "#888780" }}>如需修改密碼請聯絡管理員</div>
        </div>
      </div>

      <BottomNav current="account" />
    </div>
  );
}
