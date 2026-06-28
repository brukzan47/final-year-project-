import React, { useEffect, useMemo, useState } from "react";
import FormField from "../components/FormField.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Modal from "../components/Modal.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { UsersAPI } from "../api/userAPI.js";
import { useAuth } from "../context/AuthContext.jsx";
import { SYSTEM_ROLES } from "../utils/roleAccess.js";

const ALL_ROLE_OPTIONS = SYSTEM_ROLES;
const IMPORTER_ROLE_OPTIONS = ["Importer"];

export default function Users() {
  const { role: actorRole } = useAuth();
  const isAdmin = actorRole === "Admin" || actorRole === "Super Admin";
  const isOfficer = actorRole === "Customs Officer";
  const createRoleOptions = isAdmin ? ALL_ROLE_OPTIONS : IMPORTER_ROLE_OPTIONS;
  const assignRoleOptions = isAdmin ? ALL_ROLE_OPTIONS : [];
  const { lang } = useLanguage();
  const tx = lang === "am" ? AM : EN;
  const [f, set] = useState({ full_name: "", email: "", password: "", role: "Importer" });
  const [items, setItems] = useState([]);
  const [auditItems, setAuditItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterMode, setFilterMode] = useState("all");
  const [assigningId, setAssigningId] = useState("");
  const [statusBusyId, setStatusBusyId] = useState("");
  const [resetBusyId, setResetBusyId] = useState("");
  const [assignRoleByUserId, setAssignRoleByUserId] = useState({});
  const [assignNoteByUserId, setAssignNoteByUserId] = useState({});
  const [resetPasswordByUserId, setResetPasswordByUserId] = useState({});
  const [createdPopup, setCreatedPopup] = useState(null);
  const [userDetailPopup, setUserDetailPopup] = useState(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [importerRecordPopup, setImporterRecordPopup] = useState(null);
  const [importerRecordLoading, setImporterRecordLoading] = useState(false);

  const on = (e) => set({ ...f, [e.target.name]: e.target.value });

  const load = async () => {
    setError("");
    try {
      const users = await UsersAPI.list({ missing_role: filterMode === "missing" ? "true" : "false" });
      const list = Array.isArray(users) ? users : [];
      setItems(list);
      const map = {};
      for (const u of list) {
        map[u.user_id] = u.role_name || "Importer";
      }
      setAssignRoleByUserId(map);

      if (isAdmin) {
        const auditRes = await UsersAPI.roleAudit({ limit: 20 });
        setAuditItems(Array.isArray(auditRes?.items) ? auditRes.items : []);
      } else {
        setAuditItems([]);
      }
    } catch (e) {
      setError(e.message || tx.failedLoadUsers);
    }
  };

  useEffect(() => {
    load();
  }, [filterMode, isAdmin]);

  useEffect(() => {
    if (isOfficer) {
      set((prev) => ({ ...prev, role: "Importer" }));
    }
  }, [isOfficer]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!f.full_name || !f.email || !f.password || !f.role) {
      setError(tx.allFieldsRequired);
      return;
    }
    setLoading(true);
    try {
      const created = await UsersAPI.create(f);
      if ((isAdmin || isOfficer) && f.role === "Importer") {
        setCreatedPopup({
          full_name: created?.full_name || f.full_name,
          email: created?.email || f.email,
          role: f.role,
          suggestNextEO: false,
        });
      }
      set({ full_name: "", email: "", password: "", role: f.role });
      await load();
    } catch (e) {
      setError(e.message || tx.failedCreateUser);
    } finally {
      setLoading(false);
    }
  };

  const missingCount = useMemo(
    () => items.filter((u) => !String(u.role_name || "").trim()).length,
    [items]
  );

  const assignRole = async (user) => {
    const role = assignRoleByUserId[user.user_id];
    const note = String(assignNoteByUserId[user.user_id] || "").trim();
    if (!role) {
      setError(tx.selectRoleBeforeAssign);
      return;
    }
    setError("");
    setAssigningId(user.user_id);
    try {
      await UsersAPI.updateRole(user.user_id, role, note);
      await load();
      setAssignNoteByUserId((prev) => ({ ...prev, [user.user_id]: "" }));
    } catch (e) {
      setError(e.message || tx.failedAssignRole);
    } finally {
      setAssigningId("");
    }
  };

  const toggleStatus = async (user) => {
    const nextStatus = user.status === "active" ? "inactive" : "active";
    setError("");
    setStatusBusyId(user.user_id);
    try {
      await UsersAPI.updateStatus(user.user_id, nextStatus);
      await load();
    } catch (e) {
      setError(e.message || tx.failedStatusUpdate);
    } finally {
      setStatusBusyId("");
    }
  };

  const resetPassword = async (user) => {
    const newPassword = String(resetPasswordByUserId[user.user_id] || "");
    if (newPassword.length < 8) {
      setError(tx.passwordMin8);
      return;
    }
    setError("");
    setResetBusyId(user.user_id);
    try {
      await UsersAPI.resetPassword(user.user_id, newPassword);
      setResetPasswordByUserId((prev) => ({ ...prev, [user.user_id]: "" }));
      await load();
    } catch (e) {
      setError(e.message || tx.failedResetPassword);
    } finally {
      setResetBusyId("");
    }
  };

  const openUserDetails = async (user) => {
    if (!isAdmin) return;
    setError("");
    setUserDetailLoading(true);
    try {
      const details = await UsersAPI.getById(user.user_id);
      setUserDetailPopup(details);
    } catch (e) {
      setError(e.message || tx.failedLoadUserDetails);
    } finally {
      setUserDetailLoading(false);
    }
  };

  const openImporterRecord = async (user) => {
    setError("");
    setImporterRecordLoading(true);
    try {
      const data = await UsersAPI.getImporterRecord(user.user_id);
      setImporterRecordPopup(data);
    } catch (e) {
      setError(e.message || tx.failedLoadImporterRecord);
    } finally {
      setImporterRecordLoading(false);
    }
  };

  return (
    <div className="users-page-shell">
      <div className="users-page-panel">
        <div className="users-page-section users-page-section--summary">
          <div className="users-page-section-head">
            <div>
              <div className="users-page-kicker">{tx.aboutUser}</div>
              <h2 className="users-page-title">{tx.aboutUser}</h2>
            </div>
            <div className="users-page-chips">
              {[tx.totalUsers, tx.activeUsers, tx.inactiveUsers, tx.missingRoleInList].map((chip) => (
                <span key={chip} className="users-page-chip">{chip}</span>
              ))}
            </div>
          </div>
          <div className="users-page-copy">{tx.aboutUserText}</div>
          <div className="users-page-stats">
            <span>{tx.totalUsers}: {items.length}</span>
            <span>{tx.activeUsers}: {items.filter((u) => u.status === "active").length}</span>
            <span>{tx.inactiveUsers}: {items.filter((u) => u.status !== "active").length}</span>
            <span>{tx.missingRoleInList}: {missingCount}</span>
          </div>
        </div>

        <Modal open={!!createdPopup} title={tx.popupTitle} onClose={() => setCreatedPopup(null)}>
        {createdPopup && (
          <div style={{ display: "grid", gap: 10 }}>
            <div>{tx.popupBody}</div>
            <div><strong>{tx.fullName}:</strong> {createdPopup.full_name}</div>
            <div><strong>{tx.email}:</strong> {createdPopup.email}</div>
            <div><strong>{tx.role}:</strong> {createdPopup.role}</div>
            <div style={{ color: "#475569" }}>{tx.popupHint}</div>
            <div>
              <button type="button" onClick={() => setCreatedPopup(null)} style={{ padding: "8px 12px" }}>
                {tx.close}
              </button>
            </div>
          </div>
        )}
        </Modal>
        <Modal open={!!userDetailPopup || userDetailLoading} title={tx.userDetails} onClose={() => { setUserDetailPopup(null); setUserDetailLoading(false); }}>
        {userDetailLoading ? (
          <div>{tx.loadingUserDetails}</div>
        ) : userDetailPopup ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div><strong>{tx.fullName}:</strong> {userDetailPopup.full_name || "-"}</div>
            <div><strong>{tx.email}:</strong> {userDetailPopup.email || "-"}</div>
            <div><strong>{tx.role}:</strong> {userDetailPopup.role_name || tx.missing}</div>
            <div><strong>{tx.status}:</strong> {userDetailPopup.status || "-"}</div>
            <div><strong>{tx.language}:</strong> {userDetailPopup.preferred_language || "en"}</div>
            <div><strong>{tx.mustChangePassword}:</strong> {userDetailPopup.must_change_password ? tx.yes : tx.no}</div>
            <div><strong>{tx.failedAttempts}:</strong> {Number(userDetailPopup.failed_login_attempts || 0)}</div>
            <div><strong>{tx.lockedUntil}:</strong> {userDetailPopup.locked_until ? (new Date(userDetailPopup.locked_until).toLocaleString?.() || userDetailPopup.locked_until) : "-"}</div>
            <div><strong>{tx.created}:</strong> {userDetailPopup.created_at ? (new Date(userDetailPopup.created_at).toLocaleString?.() || userDetailPopup.created_at) : "-"}</div>
          </div>
        ) : null}
        </Modal>
        <Modal open={!!importerRecordPopup || importerRecordLoading} title={tx.importerRecordTitle} onClose={() => { setImporterRecordPopup(null); setImporterRecordLoading(false); }}>
        {importerRecordLoading ? (
          <div>{tx.loadingImporterRecord}</div>
        ) : importerRecordPopup ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div><strong>{tx.fullName}:</strong> {importerRecordPopup?.user?.full_name || "-"}</div>
            <div><strong>{tx.email}:</strong> {importerRecordPopup?.user?.email || "-"}</div>
            <div><strong>{tx.role}:</strong> {importerRecordPopup?.user?.role_name || "-"}</div>
            {importerRecordPopup?.importer_record ? (
              <>
                <div><strong>{tx.companyName}:</strong> {importerRecordPopup.importer_record.company_name || "-"}</div>
                <div><strong>{tx.tinNumber}:</strong> {importerRecordPopup.importer_record.tin_number || "-"}</div>
                <div><strong>{tx.customsRegNo}:</strong> {importerRecordPopup.importer_record.customs_registration_no || "-"}</div>
                <div><strong>{tx.licenseNo}:</strong> {importerRecordPopup.importer_record.import_license_no || "-"}</div>
                <div><strong>{tx.contactPerson}:</strong> {importerRecordPopup.importer_record.contact_person || "-"}</div>
                <div><strong>{tx.contactPhone}:</strong> {importerRecordPopup.importer_record.contact_phone || "-"}</div>
                <div><strong>{tx.sectorType}:</strong> {importerRecordPopup.importer_record.sector_type || "-"}</div>
                <div><strong>{tx.address}:</strong> {importerRecordPopup.importer_record.address || "-"}</div>
              </>
            ) : (
              <div>{tx.noImporterRecord}</div>
            )}
          </div>
        ) : null}
        </Modal>

        <div className="users-page-section users-page-section--create">
          <div className="users-page-section-head users-page-section-head--tight">
            <div>
              <div className="users-page-kicker">{tx.users}</div>
              <h3 className="users-page-subtitle">{tx.createUser}</h3>
            </div>
          </div>
          <form className="users-page-form" onSubmit={submit}>
            <FormField label={tx.fullName} name="full_name" value={f.full_name} onChange={on} placeholder="Abebe Kebede" />
            <FormField label={tx.email} type="email" name="email" value={f.email} onChange={on} placeholder="user@customs.et" />
            <FormField label={tx.password} type="password" name="password" value={f.password} onChange={on} placeholder={tx.min8} />
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13 }}>{tx.role}</span>
              <select name="role" value={f.role} onChange={on} style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}>
                {createRoleOptions.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            {error && <div style={{ color: "#b00020" }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ width: 150 }}>{loading ? tx.creating : tx.createUser}</button>
          </form>
        </div>

        <div className="users-page-toolbar">
        <h3 style={{ margin: 0 }}>{tx.users}</h3>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#6b7280" }}>{tx.filter}</span>
          <select value={filterMode} onChange={(e) => setFilterMode(e.target.value)} style={{ padding: 6, border: "1px solid #ccc", borderRadius: 6 }}>
            <option value="all">{tx.all}</option>
            <option value="missing">{tx.missingRoleOnly}</option>
          </select>
        </label>
        <span style={{ fontSize: 12, color: "#6b7280" }}>{tx.missingRoleInList}: {missingCount}</span>
        </div>

        <div className="users-page-table-wrap">
        <table className="smart-table smart-table--stack" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th>{tx.name}</th><th>{tx.email}</th><th>{tx.role}</th><th>{tx.status}</th><th>{tx.created}</th><th>{isAdmin ? tx.roleAction : tx.actions}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => {
              const missing = !String(u.role_name || "").trim();
              return (
                <tr key={u.user_id} style={missing ? { background: "#fff7ed" } : {}}>
                  <td>
                    {isAdmin ? (
                      <button type="button" onClick={() => openUserDetails(u)} style={{ padding: 0, border: 0, background: "transparent", textDecoration: "underline", cursor: "pointer" }}>
                        {u.full_name}
                      </button>
                    ) : (
                      u.full_name
                    )}
                  </td>
                  <td>{u.email}</td>
                  <td>{u.role_name || tx.missing}</td>
                  <td><StatusBadge status={u.status || "Pending"} /></td>
                  <td>{new Date(u.created_at).toLocaleString?.() || u.created_at}</td>
                  <td>
                    {isAdmin ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <select
                          value={assignRoleByUserId[u.user_id] || "Importer"}
                          onChange={(e) => setAssignRoleByUserId((prev) => ({ ...prev, [u.user_id]: e.target.value }))}
                          style={{ padding: 6, border: "1px solid #ccc", borderRadius: 6 }}
                        >
                          {assignRoleOptions.map((r) => (
                            <option key={r}>{r}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => assignRole(u)}
                          disabled={assigningId === u.user_id}
                          style={{ padding: "6px 10px" }}
                        >
                          {assigningId === u.user_id ? tx.saving : tx.assign}
                        </button>
                        <input
                          type="text"
                          value={assignNoteByUserId[u.user_id] || ""}
                          onChange={(e) => setAssignNoteByUserId((prev) => ({ ...prev, [u.user_id]: e.target.value }))}
                          placeholder={tx.reasonOptional}
                          style={{ padding: 6, border: "1px solid #ccc", borderRadius: 6, minWidth: 180 }}
                        />
                        <button
                          type="button"
                          onClick={() => toggleStatus(u)}
                          disabled={statusBusyId === u.user_id}
                          style={{ padding: "6px 10px" }}
                        >
                          {statusBusyId === u.user_id ? tx.saving : (u.status === "active" ? tx.deactivate : tx.activate)}
                        </button>
                        <input
                          type="password"
                          value={resetPasswordByUserId[u.user_id] || ""}
                          onChange={(e) => setResetPasswordByUserId((prev) => ({ ...prev, [u.user_id]: e.target.value }))}
                          placeholder={tx.newPassword}
                          style={{ padding: 6, border: "1px solid #ccc", borderRadius: 6, minWidth: 150 }}
                        />
                        <button
                          type="button"
                          onClick={() => resetPassword(u)}
                          disabled={resetBusyId === u.user_id}
                          style={{ padding: "6px 10px" }}
                        >
                          {resetBusyId === u.user_id ? tx.saving : tx.resetPassword}
                        </button>
                        <button type="button" onClick={() => openImporterRecord(u)} style={{ padding: "6px 10px" }}>
                          {tx.importerRecordBtn}
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <button type="button" onClick={() => openImporterRecord(u)} style={{ padding: "6px 10px" }}>
                          {tx.importerRecordBtn}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (<tr><td colSpan="6">{tx.noUsers}</td></tr>)}
          </tbody>
        </table>
        </div>

      {isAdmin && (
        <div className="users-page-section users-page-section--audit">
          <h3 className="users-page-subtitle" style={{ margin: 0 }}>{tx.recentRoleChanges}</h3>
          <div className="users-page-table-wrap">
          <table className="smart-table smart-table--stack" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th>{tx.when}</th><th>{tx.user}</th><th>{tx.oldRole}</th><th>{tx.newRole}</th><th>{tx.changedBy}</th><th>{tx.note}</th>
              </tr>
            </thead>
            <tbody>
              {auditItems.map((a) => (
                <tr key={a.audit_id}>
                  <td>{new Date(a.changed_at).toLocaleString?.() || a.changed_at}</td>
                  <td>{a.target_name || a.target_email || a.target_user_id}</td>
                  <td>{a.old_role || "-"}</td>
                  <td>{a.new_role || "-"}</td>
                  <td>{a.actor_name || a.actor_email || a.actor_user_id || tx.system}</td>
                  <td>{a.note || "-"}</td>
                </tr>
              ))}
              {auditItems.length === 0 && (<tr><td colSpan="6">{tx.noRoleChanges}</td></tr>)}
            </tbody>
          </table>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

const EN = {
  aboutUser: "About User",
  aboutUserText: "Manage user accounts, assign roles, activate or deactivate access, and reset passwords for secure customs operations.",
  totalUsers: "Total Users",
  activeUsers: "Active",
  inactiveUsers: "Inactive",
  users: "Users", fullName: "Full Name", email: "Email", password: "Password", min8: "min 8 characters", role: "Role",
  creating: "Creating...", createUser: "Create User", filter: "Filter", all: "All", missingRoleOnly: "Missing role only",
  missingRoleInList: "Missing role in list", name: "Name", status: "Status", created: "Created", roleAction: "Role Action",
  missing: "(Missing)", saving: "Saving...", assign: "Assign", reasonOptional: "Reason (optional)", noUsers: "No users", actions: "Actions",
  popupTitle: "Account Created",
  popupBody: "Importer account is ready for workflow and login.",
  popupHint: "Share this email and password with the user so they can log in.",
  close: "Close",
  recentRoleChanges: "Recent Role Changes", when: "When", user: "User", oldRole: "Old Role", newRole: "New Role",
  changedBy: "Changed By", note: "Note", system: "System", noRoleChanges: "No role changes yet",
  failedLoadUsers: "Failed to load users", allFieldsRequired: "All fields are required", failedCreateUser: "Failed to create user",
  selectRoleBeforeAssign: "Select a role before assigning.", failedAssignRole: "Failed to assign role",
  failedStatusUpdate: "Failed to update status", deactivate: "Deactivate", activate: "Activate",
  newPassword: "New password", resetPassword: "Reset Password", failedResetPassword: "Failed to reset password", passwordMin8: "Password must be at least 8 characters",
  userDetails: "User Details", loadingUserDetails: "Loading user details...", failedLoadUserDetails: "Failed to load user details",
  language: "Language", mustChangePassword: "Must Change Password", failedAttempts: "Failed Login Attempts", lockedUntil: "Locked Until", yes: "Yes", no: "No",
  importerRecordBtn: "EO Record", importerRecordTitle: "Importer EO Record", loadingImporterRecord: "Loading importer record...", failedLoadImporterRecord: "Failed to load importer record",
  noImporterRecord: "No importer EO record for this account.",
  companyName: "Company Name", tinNumber: "TIN Number", customsRegNo: "Customs Registration No", licenseNo: "Import License No", contactPerson: "Contact Person", contactPhone: "Contact Phone", sectorType: "Sector Type", address: "Address",
};

const AM = {
  aboutUser: "About User",
  aboutUserText: "Manage user accounts, assign roles, activate or deactivate access, and reset passwords for secure customs operations.",
  totalUsers: "Total Users",
  activeUsers: "Active",
  inactiveUsers: "Inactive",
  users: "Users", fullName: "Full Name", email: "Email", password: "Password", min8: "min 8 characters", role: "Role",
  creating: "Creating...", createUser: "Create User", filter: "Filter", all: "All", missingRoleOnly: "Missing role only",
  missingRoleInList: "Missing role in list", name: "Name", status: "Status", created: "Created", roleAction: "Role Action",
  missing: "(Missing)", saving: "Saving...", assign: "Assign", reasonOptional: "Reason (optional)", noUsers: "No users", actions: "Actions",
  popupTitle: "Account Created",
  popupBody: "Importer account is ready for workflow and login.",
  popupHint: "Share this email and password with the user so they can log in.",
  close: "Close",
  recentRoleChanges: "Recent Role Changes", when: "When", user: "User", oldRole: "Old Role", newRole: "New Role",
  changedBy: "Changed By", note: "Note", system: "System", noRoleChanges: "No role changes yet",
  failedLoadUsers: "Failed to load users", allFieldsRequired: "All fields are required", failedCreateUser: "Failed to create user",
  selectRoleBeforeAssign: "Select a role before assigning.", failedAssignRole: "Failed to assign role",
  failedStatusUpdate: "Failed to update status", deactivate: "Deactivate", activate: "Activate",
  newPassword: "New password", resetPassword: "Reset Password", failedResetPassword: "Failed to reset password", passwordMin8: "Password must be at least 8 characters",
  userDetails: "User Details", loadingUserDetails: "Loading user details...", failedLoadUserDetails: "Failed to load user details",
  language: "Language", mustChangePassword: "Must Change Password", failedAttempts: "Failed Login Attempts", lockedUntil: "Locked Until", yes: "Yes", no: "No",
  importerRecordBtn: "EO Record", importerRecordTitle: "Importer EO Record", loadingImporterRecord: "Loading importer record...", failedLoadImporterRecord: "Failed to load importer record",
  noImporterRecord: "No importer EO record for this account.",
  companyName: "Company Name", tinNumber: "TIN Number", customsRegNo: "Customs Registration No", licenseNo: "Import License No", contactPerson: "Contact Person", contactPhone: "Contact Phone", sectorType: "Sector Type", address: "Address",
};
