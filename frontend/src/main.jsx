import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles/main.css";
import "./styles/smart.css";
import "./styles/dashboard.css";
import "./styles/customs-dashboard-design-system.css";

try {
  const density = localStorage.getItem('density') || 'regular';
  document.documentElement.setAttribute('data-density', density);
} catch {}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
