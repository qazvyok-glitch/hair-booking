"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import AdminBottomNav from "../components/BottomNav";

type Member = {
  id: string;
  name: string;
  phone: string;
  email: string;
  customer_no: string;
  created_at: string;
};

type Booking = {
  id: number;
  user_id: string;
  booking_date: string;
  status: string;
};

type CustomerNote = {
  id: number;
  designer_id: number;
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

type Designer = { id: number; name: string };

export default function AdminMembers() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customerNotes, setCustomerNotes] = useState<CustomerNote[]>([]);
  const [customerPhotos, setCustomerPhotos] = useState<CustomerPhoto[]>([]);
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "" });
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState("");

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
    const [{ data: mData }, { data: bData }, { data: nData }, { data: pData }, { data: dData }] = await Promise.all([
      supabase.from("customers").select("*").order("customer_no"),
      supabase.from("bookings").select("id, user_id, booking_date, status"),
      supabase.from("customer_notes").select("*").order("customer_name"),
      supabase.from("customer_photos").select("*").order("taken_at", { ascending: false }),
      supabase.from("designers").select("id, name"),
    ]);
    if (mData) setMembers(mData);
    if (bData) setBookings(bData);
    if (nData) setCustomerNotes(nData);
    if (pData) setCustomerPhotos(pData);
    if (dData) setDesigners(dData);
    setLoading(false);
  }

  const filtered = members.filter(m =>
    (m.name || "").includes(search) ||
    (m.phone || "").includes(search) ||
    (m.email || "").includes(search) ||
    (m.customer_no || "").includes(search)
  );

  function getMemberBookings(userId: string) {
    return bookings.filter(b => b.user_id === userId);
  }

  function getMemberNotes(phone: string) {
    return customerNotes.filter(n => n.customer_phone === phone);
  }

  function getNotePhotos(noteId: number) {
    return customerPhotos.filter(p => p.customer_note_id === noteId);
  }

  function getDesignerName(id: number) {
    return designers.find(d => d.id === id)?.name || "—";
  }

  async function handleSave() {
    if (!selectedMember) return;
    setSaving(true);
    await supabase.from("customers").update({ name: editForm.name, phone: editForm.phone }).eq("id", selectedMember.id);
    setMembers(members.map(m => m.id === selectedMember.id ? { ...m, ...editForm } : m));
    setSelectedMember({ ...selectedMember, ...editForm });
    setSaving(false);
    setShowEdit(false);
  }

  function openMember(m: Member) {
    setSelectedMember(m);
    setEditForm({ name: m.name || "", phone: m.phone || "" });
    setShowEdit(false);
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#534AB7", fontSize: 14 }}>載入中...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F1EFE8", paddingBottom: 70, paddingLeft: isDesktop ? 220 : 0 }}>
      <div style={{ background: "#1A1A1A", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>會員管理</div>
        <div style={{ fontSize: 12, color: "#888780" }}>共 {filtered.length} 位</div>
      </div>

      <div style={{ padding: "12px 16px 0" }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜尋姓名、電話、Email、編號..." style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 12 }} />

        {isDesktop ? (
          <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #D3D1C7", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F1EFE8" }}>
                  {["編號", "姓名", "電話", "Email", "預約次數", "加入日期"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", fontSize: 12, color: "#888780", fontWeight: 600, textAlign: "left", borderBottom: "0.5px solid #D3D1C7" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} onClick={() => openMember(m)} style={{ borderBottom: "0.5px solid #F1EFE8", cursor: "pointer" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontSize: 12, color: "#534AB7", background: "#EEEDFE", borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>{m.customer_no || "—"}</span>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#2C2C2A", fontWeight: 500 }}>{m.name || "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#5F5E5A" }}>{m.phone || "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "#888780" }}>{m.email || "—"}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#2C2C2A" }}>{getMemberBookings(m.id).length} 次</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "#888780" }}>{m.created_at?.slice(0, 10).replace(/-/g, "/")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          filtered.map((m) => {
            const memberBookings = getMemberBookings(m.id);
            return (
              <div key={m.id} onClick={() => openMember(m)} style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 8, border: "0.5px solid #D3D1C7", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: "#534AB7", background: "#EEEDFE", borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>{m.customer_no || "—"}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#2C2C2A" }}>{m.name || "未填寫"}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#888780" }}>{m.phone || "—"}</div>
                    <div style={{ fontSize: 11, color: "#888780" }}>{m.email || "—"}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#534AB7" }}>{memberBookings.length} 次</div>
                    <div style={{ fontSize: 10, color: "#888780" }}>預約紀錄</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#888780", marginTop: 6 }}>加入：{m.created_at?.slice(0, 10).replace(/-/g, "/")}</div>
              </div>
            );
          })
        )}
      </div>

      {/* 會員詳情 Modal */}
      {selectedMember && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: isDesktop ? "center" : "flex-end", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 540, background: "#fff", borderRadius: isDesktop ? 20 : "20px 20px 0 0", padding: "20px 16px 32px", maxHeight: "90vh", overflowY: "auto" }}>
            {/* 標題 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: "#534AB7", background: "#EEEDFE", borderRadius: 8, padding: "3px 10px", fontWeight: 700 }}>{selectedMember.customer_no}</span>
                <span style={{ fontSize: 16, fontWeight: 600, color: "#2C2C2A" }}>{selectedMember.name || "未填寫"}</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setShowEdit(!showEdit)} style={{ background: "#EEEDFE", color: "#534AB7", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>編輯</button>
                <button onClick={() => setSelectedMember(null)} style={{ background: "#F1EFE8", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer" }}>x</button>
              </div>
            </div>

            {/* 編輯表單 */}
            {showEdit && (
              <div style={{ background: "#F1EFE8", borderRadius: 12, padding: 12, marginBottom: 14 }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>姓名</div>
                  <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>電話</div>
                  <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
                <button onClick={handleSave} disabled={saving} style={{ width: "100%", padding: "9px 0", background: saving ? "#D3D1C7" : "#534AB7", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? "default" : "pointer" }}>
                  {saving ? "儲存中..." : "儲存"}
                </button>
              </div>
            )}

            {/* 基本資料 */}
            <div style={{ background: "#F1EFE8", borderRadius: 12, padding: 14, marginBottom: 14 }}>
              {[
                { label: "電話", value: selectedMember.phone || "—" },
                { label: "Email", value: selectedMember.email || "—" },
                { label: "加入日期", value: selectedMember.created_at?.slice(0, 10).replace(/-/g, "/") || "—" },
                { label: "預約次數", value: `${getMemberBookings(selectedMember.id).length} 次` },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: "#888780" }}>{item.label}</span>
                  <span style={{ color: "#2C2C2A" }}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* 設計師備忘 */}
            {getMemberNotes(selectedMember.phone).length > 0 && (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A", marginBottom: 8 }}>設計師備忘</div>
                {getMemberNotes(selectedMember.phone).map(note => {
                  const notePhotos = getNotePhotos(note.id);
                  return (
                    <div key={note.id} style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 10, border: "0.5px solid #D3D1C7" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#534AB7" }}>{getDesignerName(note.designer_id)}</span>
                        {note.last_visit && <span style={{ fontSize: 11, color: "#888780" }}>上次到訪：{note.last_visit.replace(/-/g, "/")}</span>}
                      </div>
                      {note.hair_type && <div style={{ fontSize: 12, color: "#5F5E5A", marginBottom: 3 }}>髮質：{note.hair_type}</div>}
                      {note.preferences && <div style={{ fontSize: 12, color: "#5F5E5A", marginBottom: 3 }}>喜好：{note.preferences}</div>}
                      {note.allergies && <div style={{ fontSize: 12, color: "#A32D2D", marginBottom: 3 }}>過敏：{note.allergies}</div>}
                      {note.notes && <div style={{ fontSize: 11, color: "#888780", background: "#F1EFE8", borderRadius: 6, padding: "4px 8px", marginTop: 4 }}>{note.notes}</div>}

                      {notePhotos.length > 0 && (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ fontSize: 11, color: "#888780", marginBottom: 6 }}>髮型照 ({notePhotos.length})</div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
                            {notePhotos.map(photo => (
                              <div key={photo.id} onClick={() => setLightboxUrl(photo.photo_url)} style={{ aspectRatio: "1", borderRadius: 6, overflow: "hidden", cursor: "pointer", position: "relative" }}>
                                <img src={photo.photo_url} alt="髮型" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.4)", padding: "2px 4px" }}>
                                  <div style={{ fontSize: 8, color: "#fff" }}>{photo.taken_at?.slice(5).replace("-", "/")}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* 預約紀錄 */}
            <div style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A", marginBottom: 8, marginTop: 4 }}>
              預約紀錄（{getMemberBookings(selectedMember.id).length} 筆）
            </div>
            {getMemberBookings(selectedMember.id).length === 0 ? (
              <div style={{ textAlign: "center", padding: "16px 0", color: "#888780", fontSize: 13 }}>尚無預約紀錄</div>
            ) : (
              getMemberBookings(selectedMember.id)
                .sort((a, b) => b.booking_date.localeCompare(a.booking_date))
                .map(b => (
                  <div key={b.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "0.5px solid #F1EFE8" }}>
                    <span style={{ fontSize: 13, color: "#2C2C2A" }}>{b.booking_date.replace(/-/g, "/")}</span>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, background: b.status === "confirmed" ? "#E1F5EE" : b.status === "cancelled" ? "#FCEBEB" : "#FAEEDA", color: b.status === "confirmed" ? "#085041" : b.status === "cancelled" ? "#A32D2D" : "#633806" }}>
                      {b.status === "confirmed" ? "已確認" : b.status === "cancelled" ? "已取消" : "待確認"}
                    </span>
                  </div>
                ))
            )}
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

      <AdminBottomNav current="members" />
    </div>
  );
}
