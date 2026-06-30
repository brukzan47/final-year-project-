import React from "react";
import { Eye, EyeOff, ArrowRight } from "lucide-react";

export default function LoginCard({
  emailRef,
  passwordRef,
  remember,
  showPassword,
  error,
  loading,
  service,
  checkedAtLabel,
  onRememberChange,
  onTogglePassword,
  onSubmit,
  onForgotPassword,
  onCreateAccount,
  onContactSupport,
  onRetryService,
  titleLabel,
  signInPromptLabel,
  primaryLabel,
  emailLabel,
  passwordLabel,
  rememberLabel,
  forgotLabel,
  createAccountLabel,
  contactSupportLabel,
  showLabel,
  hideLabel,
  signingInLabel,
  checkingLabel,
  onlineLabel,
  offlineLabel,
  retryLabel,
}) {
  return (
    <section className="login-card">
      <form className="login-card__form" onSubmit={onSubmit}>
        <label className="login-field">
          <span>{emailLabel}</span>
          <input
            className="login-input"
            type="email"
            ref={emailRef}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>

        <label className="login-field">
          <span>{passwordLabel}</span>
          <div className="login-password">
            <div className="login-password__field">
            <input
              className="login-input"
              type={showPassword ? "text" : "password"}
              ref={passwordRef}
              placeholder="Password"
              autoComplete="current-password"
              required
            />
              <button
                type="button"
                className="login-password__toggle"
                onPointerDown={(event) => {
                  event.preventDefault();
                  onTogglePassword();
                }}
                onMouseDown={(event) => event.preventDefault()}
                onTouchStart={(event) => event.preventDefault()}
                aria-label={showPassword ? hideLabel : showLabel}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
          </div>
        </label>

        <div className="login-row">
          <label className="login-remember">
            <input type="checkbox" checked={remember} onChange={(e) => onRememberChange(e.target.checked)} />
            <span>{rememberLabel}</span>
          </label>
          <button type="button" className="login-link" onClick={onForgotPassword}>
            {forgotLabel}
          </button>
        </div>

        {error ? <div className="login-error" role="alert">{error}</div> : null}

        <button type="submit" className={`login-primary ${loading ? "is-loading" : ""}`} disabled={loading}>
          <span>{loading ? signingInLabel : primaryLabel}</span>
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
