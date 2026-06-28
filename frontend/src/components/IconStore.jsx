import React from "react";

function BaseIcon({ children, size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const I = {
  home: <BaseIcon><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></BaseIcon>,
  analytics: <BaseIcon><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20V8"/></BaseIcon>,
  smartAnalytics: <BaseIcon><path d="M4 19h16"/><path d="M7 16V9"/><path d="M12 16V5"/><path d="M17 16v-4"/><path d="m6 6 3 3 4-5 5 6"/></BaseIcon>,
  dataHealth: <BaseIcon><path d="M12 3 4 6v6c0 4.5 3.2 7.5 8 9 4.8-1.5 8-4.5 8-9V6z"/><path d="M8 12h2l1.2-3 2 6 1.2-3H17"/></BaseIcon>,
  economicOperators: <BaseIcon><rect x="3" y="8" width="18" height="13"/><path d="M8 8V4h8v4"/></BaseIcon>,
  shipmentDesk: <BaseIcon><path d="M3 7h13l5 5v9H3z"/><path d="M16 7v5h5"/></BaseIcon>,
  declarationDesk: <BaseIcon><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4"/><path d="M10 13h6"/><path d="M10 17h6"/></BaseIcon>,
  declarationAdmin: <BaseIcon><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.2 2.2 4.8-4.8"/></BaseIcon>,
  inspectionDesk: <BaseIcon><circle cx="11" cy="11" r="6"/><path d="m20 20-4.2-4.2"/></BaseIcon>,
  clearanceControl: <BaseIcon><rect x="2" y="7" width="14" height="10"/><circle cx="7" cy="18" r="2"/><circle cx="15" cy="18" r="2"/><path d="M16 9h4l2 2v6h-6"/></BaseIcon>,
  paymentDesk: <BaseIcon><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 10h20"/></BaseIcon>,
  paymentBoard: <BaseIcon><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 10h20"/></BaseIcon>,
  financeWorkspace: <BaseIcon><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h10"/><path d="M7 13h4"/><path d="M15 13h2"/><path d="M7 17h10"/></BaseIcon>,
  deviceRegistry: <BaseIcon><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></BaseIcon>,
  search: <BaseIcon><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></BaseIcon>,
  singleWindow: <BaseIcon><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M9 9v11"/></BaseIcon>,
  performance: <BaseIcon><path d="M4 19h16"/><path d="m6 15 4-4 3 3 5-6"/></BaseIcon>,
  dataAnalysis: <BaseIcon><path d="M4 19h16"/><rect x="6" y="10" width="3" height="6"/><rect x="11" y="7" width="3" height="9"/><rect x="16" y="5" width="3" height="11"/></BaseIcon>,
  users: <BaseIcon><circle cx="9" cy="8" r="3"/><path d="M3 19c0-3.3 2.7-6 6-6"/><circle cx="17" cy="9" r="2.5"/><path d="M14 19c.5-2.3 2.3-4 4.5-4"/></BaseIcon>,
  notificationsAdmin: <BaseIcon><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></BaseIcon>,
  markAllRead: <BaseIcon><path d="m3 12 4 4 8-8"/><path d="m14 12 2 2 5-5"/></BaseIcon>,
  aboutUser: <BaseIcon><circle cx="12" cy="7.5" r="3.5"/><path d="M5 20c1.8-4 4.6-5.5 7-5.5s5.2 1.5 7 5.5"/><path d="M12 10.5v4"/><path d="M12 17h.01"/></BaseIcon>,
  reports: <BaseIcon><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4"/><path d="M10 13h5"/><path d="M10 17h3"/></BaseIcon>,
  fileUpload: <BaseIcon><path d="M12 16V6"/><path d="m8.5 9.5 3.5-3.5 3.5 3.5"/><path d="M4 19h16"/></BaseIcon>,
  profile: <BaseIcon><circle cx="12" cy="8" r="4"/><path d="M4 21c1.8-3.5 5-5 8-5s6.2 1.5 8 5"/></BaseIcon>,
  language: <BaseIcon><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/></BaseIcon>,
  settings: <BaseIcon><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></BaseIcon>,
  help: <BaseIcon><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.7 2.7 0 0 1 5.1 1.2c0 1.9-2.6 2.2-2.6 4"/><path d="M12 18h.01"/></BaseIcon>,
  logout: <BaseIcon><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></BaseIcon>,
  density: <BaseIcon><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></BaseIcon>,
};

export function AppIcon({ name, size = 14 }) {
  const icon = I[name];
  if (!icon) return null;
  return React.cloneElement(icon, { size });
}
