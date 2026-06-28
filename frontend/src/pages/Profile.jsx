import React, { useState } from "react";
import FormField from "../components/FormField.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { updateProfile as updateProfileAPI, changePassword as changePasswordAPI } from "../api/authAPI.js";

export default function Profile() {
  const { name, email, preferredLanguage } = useAuth();
  const { t, setLang } = useLanguage();
  const [f, set] = useState({
    full_name: name || "",
    email: email || "",
    preferred_language: preferredLanguage === "am" ? "am" : "en",
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const on = (e) => set({ ...f, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setOk("");
    setLoading(true);
    try {
      const profilePayload = {};
      if (f.full_name && f.full_name !== name) profilePayload.full_name = f.full_name;
      if (f.email && f.email !== email) profilePayload.email = f.email;
      if (f.preferred_language && f.preferred_language !== preferredLanguage) profilePayload.preferred_language = f.preferred_language;
      if (Object.keys(profilePayload).length > 0) {
        const updated = await updateProfileAPI(profilePayload);
        try { localStorage.setItem("auth", JSON.stringify(updated)); } catch {}
        if (profilePayload.preferred_language) setLang(profilePayload.preferred_language);
      }
      if (f.new_password) {
        if (f.new_password !== f.confirm_password) throw new Error(t("passwordMismatch"));
        if (!f.current_password) throw new Error(t("currentPasswordRequired"));
        await changePasswordAPI({
          current_password: f.current_password,
          new_password: f.new_password,
          confirm_password: f.confirm_password,
        });
      }
      setOk(t("savedSuccessfully"));
      set({ ...f, current_password: "", new_password: "", confirm_password: "" });
    } catch (e) {
      setError(e.message || t("saveFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-page-shell">
      <form onSubmit={submit} className="profile-page-form">
        <div className="profile-page-panel">
          <div className="profile-page-heading">
            <div className="profile-page-kicker">{t("profile")}</div>
            <h1>{name || t("fullName")}</h1>
            <p>Update your account details and password in one place.</p>
          </div>

          <div className="profile-page-grid">
            <section className="profile-page-section profile-page-section--flat">
              <h2>Account</h2>
              <FormField label={t("fullName")} name="full_name" value={f.full_name} onChange={on} placeholder="Abebe Kebede" />
              <FormField label={t("email")} type="email" name="email" value={f.email} onChange={on} placeholder="user@customs.et" />
              <label className="profile-page-select">
                <span>{t("language")}</span>
                <select
                  name="preferred_language"
                  value={f.preferred_language}
                  onChange={on}
                >
                  <option value="en">{t("english")}</option>
                  <option value="am">{t("amharic")}</option>
                </select>
              </label>
            </section>

            <section className="profile-page-section profile-page-section--flat">
              <h2>Security</h2>
              <FormField label={t("currentPassword")} type="password" name="current_password" value={f.current_password} onChange={on} placeholder={t("currentPassword")} />
              <FormField label={t("newPassword")} type="password" name="new_password" value={f.new_password} onChange={on} placeholder={t("newPassword")} />
              <FormField label={t("confirmPassword")} type="password" name="confirm_password" value={f.confirm_password} onChange={on} placeholder={t("confirmPassword")} />
            </section>
          </div>

          <div className="profile-page-actions">
            <div className="profile-page-messages">
              {error && <div className="profile-page-error">{error}</div>}
              {ok && <div className="profile-page-success">{ok}</div>}
            </div>
            <button type="submit" disabled={loading} className="profile-page-save">
              {loading ? t("saving") : t("save")}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
