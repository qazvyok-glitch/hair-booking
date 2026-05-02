"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import BottomNav from "../components/BottomNav";

type DesignerSession = { id: number; name: string; nickname: string };
type CustomerNote = {
  id: number;
  customer_name: string;
  customer_phone: string;
  hair_type: string;
  preferences: string;
  allergies: string;
  notes: string;
  last_visit: string;
};
type CustomerPhoto = {
  id: number;
  customer_note_id: number;
  photo_url: string;
  note: string;
  taken_at: string;
};

export default function DesignerCustomers() {
  const router = useRouter();
  const [designer, setDesigner] = useState<DesignerSession | null>(null);
  const [customers, setCustomers] = useState<CustomerNote[]>([]);
  const [photos, setPhotos] = useState<CustomerPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CustomerNote | null>(null);
  const [form, setForm] = useState({ customer_name: "", customer_phone: "", hair_type: "", preferences: "", allergies: "", notes: "", last_visit: "" });
  const [saving, setSaving] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerNote | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoNote, setPhotoNote] = useState("");
  const [photoTakenAt, setPhotoTakenAt] = useState(() => new Date().toISOString().split("T")[0]);
  const [lightboxUrl, setLightboxUrl] = useState("");

  useEffect(() => {
    const session = sessionStorage.getItem("designerSession");
    if (!session) { router.push("/designer/login"); return; }
    const d = JSON.parse(session);
    setDesigner(d);

    async function checkPermission() {
      const { data } = await supabase.from("designers").select("can_view_members").eq("id", d.id).single();
      if (data && !data.can_view_members) {
        alert("您的帳號目前無法查看會員資料，請聯繫管理員");
        router.push("/designer/dashboard");
        return false;
      }
      return true;
    }

    async function fetchData() {
      const canView = await checkPermission();
      if (!canView) return;
      const [{ data: cData }, { data: pData }] = await Promise.all([
        supabase.from("customer_notes").select("*").eq("designer_id", d.id).order("customer_name"),
        supabase.from("customer_photos").select("*").eq("designer_id", d.id).order("taken_at", { ascending: false }),
      ]);
      if (cData) setCustomers(cData);
      if (pData) setPhotos(pData);
      setLoading(false);
    }
    fetchData();
  }, [router]);

  function openNew() {
    setEditing(null);
    setForm({ customer_name: "", customer_phone: "", hair_type: "", preferences: "", allergies: "", notes: "", last_visit: "" });
    setShowForm(true);
  }

  function openEdit(c: CustomerNote) {
    setEditing(c);
    setForm({ customer_name: c.customer_name, customer_phone: c.customer_phone || "", hair_type: c.hair_type || "", preferences: c.preferences || "", allergies: c.allergies || "", notes: c.notes || "", last_visit: c.last_visit || "" });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.customer_name) { alert("請填寫顧客姓名"); return; }
    setSaving(true);
    if (editing) {
      await supabase.from("customer_notes").update({ ...form, updated_at: new Date().toISOString() }).eq("id", editing.id);
      setCustomers(customers.map(c => c.id === editing.id ? { ...c, ...form } : c));
    } else {
      const { data } = await supabase.from("customer_notes").insert({ ...form, designer_id: designer!.id }).select().single();
      if (data) setCustomers([...customers, data]);
    }
    setSaving(false);
    setShowForm(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("確定刪除這筆顧客紀錄？")) return;
    await supabase.from("customer_notes").delete().eq("id", id);
    setCustomers(customers.filter(c => c.id !== id));
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !designer || !selectedCustomer) return;
    setUploadingPhoto(true);

    // 壓縮圖片
    const canvas = document.createElement("canvas");
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      const maxSize = 1200;
      let w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else { w = Math.round(w * maxSize / h); h = maxSize; }
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(async (blob) => {
        if (!blob) { setUploadingPhoto(false); return; }
        const path = `${designer.id}/${selectedCustomer.id}/${Date.now()}.jpg`;
        const { error } = await supabase.storage.from("customer-photos").upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (!error) {
          const { data: { publicUrl } } = supabase.storage.from("customer-photos").getPublicUrl(path);
          const { data: photoData } = await supabase.from("customer_photos").insert({
            designer_id: designer.id,
            customer_note_id: selectedCustomer.id,
            customer_name: selectedCustomer.customer_name,
            customer_phone: selectedCustomer.customer_phone,
            photo_url: publicUrl,
            note: photoNote,
            taken_at: photoTakenAt,
          }).select().single();
          if (photoData) setPhotos([photoData, ...photos]);
          setPhotoNote("");
        }
        setUploadingPhoto(false);
        URL.revokeObjectURL(url);
      }, "image/jpeg", 0.85);
    };
    img.src = url;
  }

  async function handleDeletePhoto(photoId: number, photoUrl: string) {
    if (!confirm("確定刪除這張照片？")) return;
    const path = photoUrl.split("/customer-photos/")[1];
    await supabase.storage.from("customer-photos").remove([path]);
    await supabase.from("customer_photos").delete().eq("id", photoId);
    setPhotos(photos.filter(p => p.id !== photoId));
  }

  const filtered = customers.filter(c =>
    c.customer_name.includes(search) || (c.customer_phone || "").includes(search)
  );

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#534AB7", fontSize: 14 }}>載入中...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", paddingBottom: 70 }}>
      <div style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>顧客備忘</div>
        <button onClick={openNew} style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>+ 新增</button>
      </div>

      <div style={{ padding: "12px 16px 0" }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜尋顧客姓名或電話..." style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 12 }} />

        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#888780", fontSize: 14 }}>尚無顧客紀錄</div>
        ) : (
          filtered.map((c) => {
            const customerPhotos = photos.filter(p => p.customer_note_id === c.id);
            return (
              <div key={c.id} style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, border: "0.5px solid #D3D1C7" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#2C2C2A" }}>{c.customer_name}</div>
                    {c.customer_phone && <div style={{ fontSize: 12, color: "#888780" }}>{c.customer_phone}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => openEdit(c)} style={{ background: "#EEEDFE", color: "#534AB7", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>編輯</button>
                    <button onClick={() => handleDelete(c.id)} style={{ background: "#FCEBEB", color: "#A32D2D", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>刪除</button>
                  </div>
                </div>

                {c.hair_type && <div style={{ fontSize: 12, color: "#5F5E5A", marginBottom: 2 }}>髮質：{c.hair_type}</div>}
                {c.preferences && <div style={{ fontSize: 12, color: "#5F5E5A", marginBottom: 2 }}>喜好：{c.preferences}</div>}
                {c.allergies && <div style={{ fontSize: 12, color: "#A32D2D", marginBottom: 2 }}>過敏：{c.allergies}</div>}
                {c.notes && <div style={{ fontSize: 11, color: "#888780", background: "#F1EFE8", borderRadius: 6, padding: "4px 8px", marginTop: 4 }}>{c.notes}</div>}
                {c.last_visit && <div style={{ fontSize: 11, color: "#888780", marginTop: 4 }}>上次到訪：{c.last_visit.replace(/-/g, "/")}</div>}

                {/* 髮型照片區 */}
                <div style={{ marginTop: 12, borderTop: "0.5px solid #F1EFE8", paddingTop: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#2C2C2A" }}>髮型完成照 ({customerPhotos.length})</div>
                    <button
                      onClick={() => { setSelectedCustomer(c); setShowPhotoModal(true); setPhotoTakenAt(new Date().toISOString().split("T")[0]); }}
                      style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}
                    >
                      + 新增照片
                    </button>
                  </div>

                  {customerPhotos.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                      {customerPhotos.map(photo => (
                        <div key={photo.id} style={{ position: "relative", aspectRatio: "1", borderRadius: 8, overflow: "hidden", cursor: "pointer" }}>
                          <img
                            src={photo.photo_url}
                            alt="髮型照"
                            onClick={() => setLightboxUrl(photo.photo_url)}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.5)", padding: "3px 6px" }}>
                            <div style={{ fontSize: 9, color: "#fff" }}>{photo.taken_at?.replace(/-/g, "/")}</div>
                            {photo.note && <div style={{ fontSize: 9, color: "#ddd" }}>{photo.note}</div>}
                          </div>
                          <button
                            onClick={() => handleDeletePhoto(photo.id, photo.photo_url)}
                            style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, background: "rgba(163,45,45,0.8)", border: "none", borderRadius: "50%", color: "#fff", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                          >x</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 新增照片 Modal */}
      {showPhotoModal && selectedCustomer && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 390, background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px 16px 32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>新增髮型照 — {selectedCustomer.customer_name}</div>
              <button onClick={() => setShowPhotoModal(false)} style={{ background: "#F1EFE8", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer" }}>x</button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>施作日期</div>
              <input type="date" value={photoTakenAt} onChange={(e) => setPhotoTakenAt(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>備註（選填）</div>
              <input value={photoNote} onChange={(e) => setPhotoNote(e.target.value)} placeholder="染色配方、燙髮時間..." style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>

            <label style={{ display: "block", width: "100%", padding: "14px 0", background: uploadingPhoto ? "#D3D1C7" : "#534AB7", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: uploadingPhoto ? "default" : "pointer", textAlign: "center" }}>
              {uploadingPhoto ? "上傳中..." : "選擇照片上傳"}
              <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} style={{ display: "none" }} disabled={uploadingPhoto} />
            </label>

            <div style={{ fontSize: 11, color: "#888780", textAlign: "center", marginTop: 8 }}>
              照片會自動壓縮，節省儲存空間
            </div>
          </div>
        </div>
      )}

      {/* 燈箱 */}
      {lightboxUrl && (
        <div onClick={() => setLightboxUrl("")} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <img src={lightboxUrl} alt="髮型照" style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 12, objectFit: "contain" }} />
          <button onClick={() => setLightboxUrl("")} style={{ position: "absolute", top: 20, right: 20, background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 36, height: 36, color: "#fff", fontSize: 18, cursor: "pointer" }}>x</button>
        </div>
      )}

      {/* 備忘表單 */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 390, background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px 16px 32px", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{editing ? "編輯顧客" : "新增顧客"}</div>
              <button onClick={() => setShowForm(false)} style={{ background: "#F1EFE8", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer" }}>x</button>
            </div>
            {[
              { key: "customer_name", label: "姓名 *", placeholder: "王小明" },
              { key: "customer_phone", label: "電話", placeholder: "0912-345-678" },
              { key: "hair_type", label: "髮質", placeholder: "細軟、易毛躁..." },
              { key: "preferences", label: "喜好風格", placeholder: "自然系、日系..." },
              { key: "allergies", label: "過敏／注意事項", placeholder: "對XX染劑過敏..." },
              { key: "last_visit", label: "上次到訪", placeholder: "2024-01-01", type: "date" },
            ].map((f) => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>{f.label}</div>
                <input
                  value={(form as any)[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  type={(f as any).type || "text"}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>備忘筆記</div>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="特殊記錄、習慣..." style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", height: 80, resize: "none", boxSizing: "border-box" }} />
            </div>
            <button onClick={handleSave} disabled={saving} style={{ width: "100%", padding: "13px 0", background: saving ? "#D3D1C7" : "#534AB7", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: saving ? "default" : "pointer" }}>
              {saving ? "儲存中..." : "儲存"}
            </button>
          </div>
        </div>
      )}

      <BottomNav current="customers" />
    </div>
  );
}
