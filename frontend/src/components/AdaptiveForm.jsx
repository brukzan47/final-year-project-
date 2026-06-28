import React from "react";

/**
 * AdaptiveForm
 * Schema-driven form renderer for quick form scaffolding.
 *
 * Props:
 * - fields: [
 *     { name, label, type?, placeholder?, options?, required?, helper?, rows?, span? }
 *     type: text | number | date | select | textarea | email | password
 *     options: [{ value, label }]
 *     span: 1 or 2 (controls grid span)
 *   ]
 * - values: object map of field values
 * - onChange: (name, value) => void
 * - onSubmit: (event) => void
 * - submitLabel: string
 * - disabled: boolean
 * - loading: boolean
 *
 * Layout: responsive auto-fit grid; spans respected.
 */
export default function AdaptiveForm({
  fields = [],
  values = {},
  onChange,
  onSubmit,
  submitLabel = "Save",
  disabled,
  loading,
  className = "adaptive-form",
}) {
  const handleChange = (name) => (e) => {
    onChange && onChange(name, e.target.value);
  };

  const renderField = (f, idx) => {
    const span = f.span === 2 ? "minmax(220px, 1fr) / span 2" : undefined;
    const common = {
      name: f.name,
      value: values[f.name] ?? "",
      onChange: handleChange(f.name),
      placeholder: f.placeholder,
      required: f.required,
      disabled,
      style: {
        padding: 10,
        border: "1px solid #ccc",
        borderRadius: 6,
        background: "#fff",
        color: "#000",
      },
    };
    let control = null;
    if (f.type === "select") {
      control = (
        <select {...common}>
          <option value="">{f.placeholder || "Select..."}</option>
          {(f.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    } else if (f.type === "textarea") {
      control = <textarea rows={f.rows || 3} {...common} />;
    } else {
      control = <input type={f.type || "text"} {...common} />;
    }
    return (
      <label
        key={idx}
        style={{
          display: "grid",
          gap: 6,
          gridColumn: span ? "span 2" : undefined,
        }}
      >
        <span style={{ fontSize: 13, color: "#fff" }}>
          {f.label}
          {f.required ? " *" : ""}
        </span>
        {control}
        {f.helper && <span style={{ fontSize: 12, color: "#6b7280" }}>{f.helper}</span>}
      </label>
    );
  };

  return (
    <form
      onSubmit={onSubmit}
      className={className}
      style={{
        display: "grid",
        gap: 12,
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
      }}
    >
      {fields.map(renderField)}
      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10 }}>
        <button
          type="submit"
          disabled={disabled || loading}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: 0,
            background: "var(--color-primary)",
            color: "var(--color-primary-contrast)",
            cursor: "pointer",
            opacity: disabled || loading ? 0.7 : 1,
          }}
        >
          {loading ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

