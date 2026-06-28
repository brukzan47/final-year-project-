import React from "react";
import loginBackground from "../assets/customs-login-background.png";

export default function BackgroundHero() {
  return (
    <div className="login-hero" aria-hidden="true">
      <div className="login-hero__media" style={{ backgroundImage: `url(${loginBackground})` }} />
      <div className="login-hero__overlay" />
      <div className="login-hero__drift login-hero__drift--one" />
      <div className="login-hero__drift login-hero__drift--two" />
    </div>
  );
}
