import React from "react";

export default function FormField({ label, type = "text", name, value, onChange, placeholder, ...rest }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13 }}>{label}</span>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          padding: "10px 12px",
          border: "1px solid #ccc",
          borderRadius: 6,
          background: "#fff",
          color: "#000",
        }}
        {...rest}
      />
    </label>
  );
}

