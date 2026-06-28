import React, { useEffect, useMemo, useState } from "react";
import { UsersAPI } from "../api/userAPI.js";
import { NotificationsAPI } from "../api/notificationAPI.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import { SYSTEM_ROLES } from "../utils/roleAccess.js";

const ROLE_OPTIONS = SYSTEM_ROLES;
const TYPE_OPTIONS = ["INFO", "SUCCESS", "WARNING", "ERROR"];
const CATEGORY_OPTIONS = ["SYSTEM", "PAYMENT", "DECLARATION", "INSPECTION", "CLEARANCE", "DOCUMENT", "REMINDER"];
const CHANNEL_OPTIONS = ["IN_APP", "EMAIL", "SMS"];

export default function NotificationsAdmin() {
  const { lang } = useLanguage();
  const t = lang === "am" ? AM : EN;
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");
  const [err, setErr] = useState("");

  const [f, setF] = useState({
    title: "",
    message: "",
    type: "INFO",
    category: "SYSTEM",
    reference_id: "",
    target_mode: "roles",
    roles: ["Importer"],
    user_ids: [],
    channels: ["IN_APP"],
  });

  useEffect(() => {
    const run = async () => {
      setLoadingUsers(true);
      try {
        const list = await UsersAPI.list();
        setUsers(Array.isArray(list) ? list : []);
      } catch {
        setUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    };
    run();
  }, []);

  const filteredUsers = useMemo(() => {
    if (f.target_mode !== "users") return [];
    return users;
  }, [users, f.target_mode]);

  const setField = (name, value) => setF((prev) => ({ ...prev, [name]: value }));

  const toggleRole = (role) => {
    setF((prev) => {
      const has = prev.roles.includes(role);
      return { ...prev, roles: has ? prev.roles.filter((r) => r !== role) : [...prev.roles, role] };
    });
  };

  const toggleChannel = (ch) => {
    setF((prev) => {
      const has = prev.channels.includes(ch);
      const next = has ? prev.channels.filter((c) => c !== ch) : [...prev.channels, ch];
      return { ...prev, channels: next.length ? next : ["IN_APP"] };
    });
  };

  const toggleUser = (id) => {
    setF((prev) => {
      const has = prev.user_ids.includes(id);
      return { ...prev, user_ids: has ? prev.user_ids.filter((u) => u !== id) : [...prev.user_ids, id] };
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setResult("");
    if (!f.title.trim() || !f.message.trim()) {
      setErr(t.titleMessageRequired);
      return;
    }
    if (f.target_mode === "roles" && f.roles.length === 0) {
      setErr(t.pickRole);
      return;
    }
    if (f.target_mode === "users" && f.user_ids.length === 0) {
      setErr(t.pickUser);
      return;
    }
    setSending(true);
    try {
      const payload = {
        title: f.title.trim(),
        message: f.message.trim(),
        type: f.type,
        category: f.category,
        reference_id: f.reference_id.trim() || null,
        channels: f.channels,
        roles: f.target_mode === "roles" ? f.roles : [],
        user_ids: f.target_mode === "users" ? f.user_ids : [],
      };
      const resp = await NotificationsAPI.create(payload);
      setResult(t.sentCount.replace("{count}", resp?.count ?? 0));
    } catch (ex) {
      setErr(ex.message || t.failedSend);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card" style={{ padding: 14, display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0 }}>{t.pageTitle}</h2>
      <div style={{ color: "#6b7280", fontSize: 13 }}>
        {t.subtitle}
      </div>
      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <input
          placeholder={t.title}
          value={f.title}
          onChange={(e) => setField("title", e.target.value)}
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        />
        <textarea
          placeholder={t.message}
          value={f.message}
          onChange={(e) => setField("message", e.target.value)}
          rows={4}
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8, resize: "vertical" }}
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
          <select value={f.type} onChange={(e) => setField("type", e.target.value)} style={{ padding: 10, borderRadius: 8 }}>
            {TYPE_OPTIONS.map((x) => <option key={x} value={x}>{t.typeLabel(x)}</option>)}
          </select>
          <select value={f.category} onChange={(e) => setField("category", e.target.value)} style={{ padding: 10, borderRadius: 8 }}>
            {CATEGORY_OPTIONS.map((x) => <option key={x} value={x}>{t.categoryLabel(x)}</option>)}
          </select>
          <input
            placeholder={t.referenceId}
            value={f.reference_id}
            onChange={(e) => setField("reference_id", e.target.value)}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <label><input type="radio" checked={f.target_mode === "roles"} onChange={() => setField("target_mode", "roles")} /> {t.byRole}</label>
          <label><input type="radio" checked={f.target_mode === "users"} onChange={() => setField("target_mode", "users")} /> {t.specificUsers}</label>
        </div>

        {f.target_mode === "roles" && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {ROLE_OPTIONS.map((r) => (
              <label key={r}><input type="checkbox" checked={f.roles.includes(r)} onChange={() => toggleRole(r)} /> {t.roleLabel(r)}</label>
            ))}
          </div>
        )}

        {f.target_mode === "users" && (
          <div className="card" style={{ padding: 10, maxHeight: 180, overflow: "auto" }}>
            {loadingUsers && <div style={{ color: "#6b7280" }}>{t.loadingUsers}</div>}
            {!loadingUsers && filteredUsers.length === 0 && <div style={{ color: "#6b7280" }}>{t.noUsers}</div>}
            {!loadingUsers && filteredUsers.map((u) => (
              <label key={u.user_id} style={{ display: "block", padding: "4px 0" }}>
                <input type="checkbox" checked={f.user_ids.includes(u.user_id)} onChange={() => toggleUser(u.user_id)} />{" "}
                {u.full_name} ({u.role_name}) - {u.email}
              </label>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {CHANNEL_OPTIONS.map((c) => (
            <label key={c}><input type="checkbox" checked={f.channels.includes(c)} onChange={() => toggleChannel(c)} /> {t.channelLabel(c)}</label>
          ))}
        </div>

        {err && <div style={{ color: "#b00020" }}>{err}</div>}
        {result && <div style={{ color: "#16a34a" }}>{result}</div>}
        <button type="submit" disabled={sending} style={{ width: 180 }}>
          {sending ? t.sending : t.sendNotification}
        </button>
      </form>
    </div>
  );
}

const EN = {
  pageTitle: "Notifications Admin",
  subtitle: "Send manual smart notifications by role or specific users.",
  title: "Title",
  message: "Message",
  referenceId: "Reference ID (optional UUID)",
  byRole: "By Role",
  specificUsers: "Specific Users",
  loadingUsers: "Loading users...",
  noUsers: "No users.",
  sending: "Sending...",
  sendNotification: "Send Notification",
  titleMessageRequired: "Title and message are required.",
  pickRole: "Pick at least one role.",
  pickUser: "Pick at least one user.",
  sentCount: "Sent {count} notifications.",
  failedSend: "Failed to send notification.",
  roleLabel: (v) => ({
    Importer: "Importer",
    "Customs Officer": "Customs Officer",
    "Finance Officer": "Finance Officer",
    Admin: "Admin",
  }[v] || v),
  typeLabel: (v) => ({
    INFO: "Info",
    SUCCESS: "Success",
    WARNING: "Warning",
    ERROR: "Error",
  }[v] || v),
  categoryLabel: (v) => ({
    SYSTEM: "System",
    PAYMENT: "Payment",
    DECLARATION: "Declaration",
    INSPECTION: "Inspection",
    CLEARANCE: "Clearance",
    DOCUMENT: "Document",
    REMINDER: "Reminder",
  }[v] || v),
  channelLabel: (v) => ({
    IN_APP: "In App",
    EMAIL: "Email",
    SMS: "SMS",
  }[v] || v),
};

const AM = {
  pageTitle: "የማሳወቂያ አስተዳደር",
  subtitle: "በሚና ወይም በተመረጡ ተጠቃሚዎች ማሳወቂያ ይላኩ።",
  title: "ርዕስ",
  message: "መልዕክት",
  referenceId: "የማጣቀሻ መለያ (አማራጭ UUID)",
  byRole: "በሚና",
  specificUsers: "ተመረጡ ተጠቃሚዎች",
  loadingUsers: "ተጠቃሚዎች በመጫን ላይ...",
  noUsers: "ተጠቃሚዎች የሉም።",
  sending: "በመላክ ላይ...",
  sendNotification: "ማሳወቂያ ላክ",
  titleMessageRequired: "ርዕስ እና መልዕክት ያስፈልጋሉ።",
  pickRole: "ቢያንስ አንድ ሚና ይምረጡ።",
  pickUser: "ቢያንስ አንድ ተጠቃሚ ይምረጡ።",
  sentCount: "{count} ማሳወቂያዎች ተልከዋል።",
  failedSend: "ማሳወቂያ መላክ አልተሳካም።",
  roleLabel: (v) => ({
    Importer: "አስመጪ",
    "Customs Officer": "የጉምሩክ መኮንን",
    "Finance Officer": "የፋይናንስ መኮንን",
    Admin: "አስተዳዳሪ",
  }[v] || v),
  typeLabel: (v) => ({
    INFO: "መረጃ",
    SUCCESS: "ስኬት",
    WARNING: "ማስጠንቀቂያ",
    ERROR: "ስህተት",
  }[v] || v),
  categoryLabel: (v) => ({
    SYSTEM: "ስርዓት",
    PAYMENT: "ክፍያ",
    DECLARATION: "መግለጫ",
    INSPECTION: "ምርመራ",
    CLEARANCE: "ክሊራንስ",
    DOCUMENT: "ሰነድ",
    REMINDER: "ማስታወሻ",
  }[v] || v),
  channelLabel: (v) => ({
    IN_APP: "በመተግበሪያ",
    EMAIL: "ኢሜይል",
    SMS: "ኤስኤምኤስ",
  }[v] || v),
};


