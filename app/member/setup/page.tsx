"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function MemberSetup() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push("/member/login"); return; }
      setUser(session.user);
      setName(session.user.user_metadata?.full_name || "");

      const { data } = await supabase.from("customers").select("*").eq("id", session.user.id).single();
      if (data) {
        if (data.name) setName(data.name);
        if (data.phone) setPhone(data.phone);
        if (data.name && data.phone) {
          router.push("/booking/step/1");
          return;
        }
      }
      setLoading(false);
    });
  }, [router]);

  async function handleSave() {
    if (!name || !phone) { alert("請填寫姓名與手機號碼"); return; }
    setSaving(true);
    const { data: existing } = await supabase
      .from("customers")
      .select("customer_no")
      .eq("id", user.id)
      .single();

    await supabase.from("customers").upsert({
      id: user.id,
      name,
      phone,
      email: user.email,
      customer_no: existing?.customer_no || undefined,
    });
    await supabase.auth.updateUser({ data: { full_name: name, phone } });
    router.push("/booking/step/1");
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#1A1A1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#fff", fontSize: 14 }}>載入中...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#1A1A1A", display: "flex", justifyContent: "center", alignItems: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 360, border: "1.5px solid #fff", borderRadius: 20, padding: "36px 24px" }}>

        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <img src="/logo.png" alt="logo" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", display: "block", margin: "0 auto 14px" }} />
          <div style={{ fontSize: 18, fontWeight: 600, color: "#fff" }}>完善個人資料</div>
          <div style={{ fontSize: 12, color: "#888780", marginTop: 4 }}>方便我們與您聯絡預約事宜</div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#888780", marginBottom: 6 }}>姓名</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="王小明" style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #444", fontSize: 14, outline: "none", background: "#2A2A2A", color: "#fff", boxSizing: "border-box" }} />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: "#888780", marginBottom: 6 }}>手機號碼</div>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0912-345-678" type="tel" style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #444", fontSize: 14, outline: "none", background: "#2A2A2A", color: "#fff", boxSizing: "border-box" }} />
        </div>

        <button onClick={handleSave} disabled={saving} style={{ width: "100%", padding: "13px 0", background: saving ? "#444" : "#534AB7", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: saving ? "default" : "pointer" }}>
          {saving ? "儲存中..." : "開始預約 →"}
        </button>
      </div>
    </div>
  );
}
