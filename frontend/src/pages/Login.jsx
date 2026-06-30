import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import BackgroundHero from "../components/BackgroundHero.jsx";
import LoginNavbar from "../components/LoginNavbar.jsx";
import LoginCard from "../components/LoginCard.jsx";
import Modal from "../components/Modal.jsx";
import { forgotPassword, serviceHealth } from "../api/authAPI.js";

const SUPPORT_EMAIL = "customs.support@erca.gov.et";

export default function Login({ onSuccess }) {
  const { login } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStatus, setForgotStatus] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [service, setService] = useState({ state: "checking", checkedAt: null });

  const checkService = useCallback(async () => {
    setService((current) => ({ ...current, state: "checking" }));
    try {
      const result = await serviceHealth();
      setService({
        state: result?.status === "online" ? "online" : "offline",
        checkedAt: result?.checked_at || new Date().toISOString(),
      });
    } catch {
      setService({ state: "offline", checkedAt: new Date().toISOString() });
    }
  }, []);

  useEffect(() => {
    checkService();
    const timer = window.setInterval(checkService, 30000);
    return () => window.clearInterval(timer);
  }, [checkService]);

  useEffect(() => {
    const { body } = document;
    const previous = {
      overflow: body.style.overflow,
    };

    body.style.overflow = "auto";

    return () => {
      body.style.overflow = previous.overflow;
    };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const email = emailRef.current?.value || "";
    const password = passwordRef.current?.value || "";
    try {
      await login(email, password, remember);
      onSuccess?.();
    } catch (err) {
      setError(err.message || t("loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  const openCreateAccount = () => {
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=Customs%20Account%20Creation%20Request`;
  };

  const contactSupport = () => {
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=Customs%20Support%20Request`;
  };

  const checkedAtLabel = service.checkedAt
    ? `${t("lastChecked")}: ${new Date(service.checkedAt).toLocaleTimeString()}`
    : "";

  return (
    <div className="login-page">
      <BackgroundHero />
      <LoginNavbar />

      <main className="login-page__content">
        <LoginCard
          titleLabel={t("welcomeBack")}
          signInPromptLabel={t("signInPrompt")}
          primaryLabel={t("signIn")}
          emailRef={emailRef}
          passwordRef={passwordRef}
          remember={remember}
          showPassword={showPassword}
          error={error}
          loading={loading}
          service={service}
          checkedAtLabel={checkedAtLabel}
          onRememberChange={setRemember}
          onTogglePassword={() => setShowPassword((value) => !value)}
          onSubmit={submit}
          onForgotPassword={() => {
            setForgotEmail(emailRef.current?.value || "");
            setForgotOpen(true);
          }}
          onCreateAccount={openCreateAccount}
          onContactSupport={contactSupport}
          onRetryService={checkService}
          emailLabel={t("email")}
          passwordLabel={t("password")}
          rememberLabel={t("rememberMe")}
          forgotLabel={t("forgotPassword")}
          createAccountLabel="Create Account"
          contactSupportLabel="Need help? Contact Customs Support"
          showLabel={t("show")}
          hideLabel={t("hide")}
          signingInLabel={t("signingIn")}
          checkingLabel={t("checkingService")}
          onlineLabel={t("serviceOnline")}
          offlineLabel={t("serviceOffline")}
          retryLabel={t("retry")}
          authorizedAccessLabel={t("authorizedAccessOnly")}
        />
      </main>

      <Modal open={forgotOpen} title={t("forgotPasswordTitle")} onClose={() => setForgotOpen(false)}>
        <div className="login-forgot">
          <div className="login-forgot__hint">{t("forgotPasswordHint")}</div>
          <input
            className="login-input"
            type="email"
            value={forgotEmail}
            onChange={(e) => setForgotEmail(e.target.value)}
            placeholder="you@example.com"
          />
          {forgotStatus && <div className="login-forgot__status">{forgotStatus}</div>}
          <div className="login-forgot__actions">
            <button type="button" className="login-secondary" onClick={() => setForgotOpen(false)}>
              {t("cancel")}
            </button>
            <button
              type="button"
              className="login-primary"
              onClick={async () => {
                try {
                  if (!forgotEmail) throw new Error(t("emailRequired"));
                  await forgotPassword(forgotEmail);
                  toast?.success(t("resetInstructionsSent"));
                  setForgotStatus(t("resetInstructionsSent"));
                  setTimeout(() => setForgotOpen(false), 900);
                } catch (e) {
                  toast?.error?.(e.message || t("resetFailed"));
                }
              }}
            >
              {t("sendResetLink")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
