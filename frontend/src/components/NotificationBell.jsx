import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { NotificationsAPI } from "../api/notificationAPI.js";
import { useAuth } from "../context/AuthContext.jsx";
import { AppIcon } from "./IconStore.jsx";

function normalizeList(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.notifications)) return response.notifications;
  return [];
}

function isUnread(item) {
  return !(item?.read || item?.is_read || item?.read_at || item?.readAt);
}

function readMetadata(item) {
  if (!item?.metadata) return {};
  if (typeof item.metadata === "object") return item.metadata;
  try {
    return JSON.parse(item.metadata);
  } catch {
    return {};
  }
}

function withParams(path, item) {
  const metadata = readMetadata(item);
  const id = item?.id || item?._id || item?.notification_id;
  const reference = item?.reference_id || metadata.declaration_id || metadata.shipment_id || metadata.payment_id || "";
  const params = new URLSearchParams();
  if (id) params.set("notification", id);
  if (reference) params.set("reference", reference);
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}

function getNotificationRoute(item, role) {
  if (item?.url) return item.url;

  const category = String(item?.category || "").toUpperCase();
  const metadata = readMetadata(item);
  const isAdminRole = role === "Admin" || role === "Super Admin";

  if (metadata.shipment_id || category === "SHIPMENT") {
    if (role === "Customs Officer" || role === "Importer" || role === "Port Officer") return withParams("/shipments", item);
    if (isAdminRole) return withParams("/declarations-admin", item);
  }
  if (category === "PAYMENT") {
    if (isAdminRole || role === "Importer") return withParams("/payments", item);
    if (role === "Finance Officer") return withParams("/finance", item);
  }
  if (category === "DECLARATION") {
    if (isAdminRole || role === "Customs Officer") return withParams("/declarations-admin", item);
    if (role === "Importer") return "";
  }
  if (category === "INSPECTION") {
    if (role === "Customs Officer" || role === "Inspector") return withParams("/inspections", item);
    if (isAdminRole) return withParams("/declarations-admin", item);
  }
  if (category === "CLEARANCE") {
    if (role === "Customs Officer" || role === "Clearance Officer") return withParams("/clearance", item);
    if (isAdminRole) return withParams("/declarations-admin", item);
  }
  if (category === "DOCUMENT") {
    if (role === "Customs Officer" || role === "Document Officer" || role === "Importer") return withParams("/file-upload", item);
    if (isAdminRole) return withParams("/declarations-admin", item);
  }

  return "";
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selected, setSelected] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 64, left: 12, width: 320 });

  const callApi = async (names, ...args) => {
    const apiNames = Array.isArray(names) ? names : [names];
    for (const name of apiNames) {
      if (typeof NotificationsAPI?.[name] === "function") {
        return NotificationsAPI[name](...args);
      }
    }
    return null;
  };

  const loadNotifications = async () => {
    try {
      const response = await callApi(["list", "getAll", "fetchAll", "index"]);
      const data = normalizeList(response);
      setItems(data);
      try {
        const count = await callApi("unreadCount");
        setUnreadCount(Number(count?.unread ?? count?.data?.unread ?? data.filter(isUnread).length));
      } catch {
        setUnreadCount(data.filter(isUnread).length);
      }
    } catch (error) {
      setItems([]);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    const stream = NotificationsAPI.stream?.(
      (notification) => {
        setItems((current) => {
          const id = notification?.id || notification?._id || notification?.notification_id;
          if (id && current.some((item) => (item.id || item._id || item.notification_id) === id)) {
            return current;
          }
          return [notification, ...current].slice(0, 30);
        });
        if (isUnread(notification)) {
          setUnreadCount((count) => count + 1);
        }
      },
      () => {}
    );
    return () => stream?.close?.();
  }, []);

  const updateDropdownPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button || typeof window === "undefined") return;
    const rect = button.getBoundingClientRect();
    const width = Math.min(340, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12));
    const top = Math.min(rect.bottom + 8, window.innerHeight - 120);
    setDropdownPosition({ top, left, width });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (event) => {
      const target = event.target;
      if (rootRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", handleClickOutside, { passive: true });
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);
    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [open, updateDropdownPosition]);

  const buttonStyle = useMemo(
    () => ({
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 8px",
      minHeight: 30,
      background: "rgba(236, 253, 245, 0.12)",
      border: "1px solid rgba(236, 253, 245, 0.22)",
      color: "#ffffff",
      boxShadow: "none",
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 600,
    }),
    []
  );

  const labelStyle = useMemo(
    () => ({
      color: "#ffffff",
      fontWeight: 600,
      fontSize: 12,
    }),
    []
  );

  const dropdownStyle = useMemo(
    () => ({
      position: "fixed",
      top: dropdownPosition.top,
      left: dropdownPosition.left,
      width: dropdownPosition.width,
      background: "#ffffff",
      border: "1px solid #d0d7de",
      borderRadius: 8,
      boxShadow: "0 18px 48px rgba(0, 0, 0, 0.22)",
      zIndex: 2147483647,
      overflow: "hidden",
    }),
    [dropdownPosition]
  );

  const markAllRead = async () => {
    try {
      await callApi(["markAllRead", "markAllAsRead", "readAll"]);
      await loadNotifications();
    } catch (error) {
      return;
    }
  };

  const openNotification = async (item) => {
    try {
      if (isUnread(item) && item?.id) {
        await callApi(["markRead", "markAsRead", "read"], item.id);
      }
    } catch {}
    setSelected({ ...item, read: true, is_read: true });
    setItems((current) =>
      current.map((entry) => {
        const entryId = entry.id || entry._id || entry.notification_id;
        const itemId = item.id || item._id || item.notification_id;
        return entryId && itemId && entryId === itemId ? { ...entry, read: true, is_read: true } : entry;
      })
    );
    const route = getNotificationRoute(item, role);
    if (route) {
      setOpen(false);
      setSelected(null);
      try {
        sessionStorage.setItem("active_notification", JSON.stringify(item));
      } catch {}
      navigate(route, { state: { notification: item } });
      await loadNotifications();
      return;
    }
    await loadNotifications();
  };

  const openSelectedLink = () => {
    const route = getNotificationRoute(selected, role);
    if (!route) return;
    setOpen(false);
    setSelected(null);
    try {
      sessionStorage.setItem("active_notification", JSON.stringify(selected));
    } catch {}
    navigate(route, { state: { notification: selected } });
  };

  return (
    <div ref={rootRef} className="notif-wrap">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={buttonStyle}
        className="notif-btn"
      >
        <AppIcon name="notificationsAdmin" size={16} />
        {unreadCount > 0 ? (
          <span
            className="notif-badge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 999,
              background: "#fee4e2",
              color: "#b42318",
              fontSize: 10,
              lineHeight: 1,
              fontWeight: 700,
            }}
          >
            {unreadCount}
          </span>
        ) : null}
      </button>

      {open ? createPortal(
        <div ref={dropdownRef} style={dropdownStyle} className="notif-dropdown">
          <div
            className="notif-head"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px",
              borderBottom: "1px solid #e5e7eb",
              color: "#111111",
              fontWeight: 600,
            }}
          >
            <span>Notifications</span>
            <button
              type="button"
              onClick={markAllRead}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "transparent",
                border: "none",
                color: "#000000",
                padding: 0,
              }}
            >
              <AppIcon name="markAllRead" size={14} />
              Mark all read
            </button>
          </div>

          <div style={{ maxHeight: 360, overflow: "auto" }}>
            {selected ? (
              <div className="notif-detail">
                <button type="button" className="notif-detail-back" onClick={() => setSelected(null)}>
                  Back
                </button>
                <div className="notif-detail-title">{selected.title || "Notification"}</div>
                <div className="notif-detail-message">{selected.message || "No message details."}</div>
                <div className="notif-detail-meta">
                  <span>{selected.type || "INFO"}</span>
                  <span>{selected.category || "SYSTEM"}</span>
                  <span>{selected.created_at || selected.createdAt || ""}</span>
                </div>
                {selected.reference_id ? (
                  <div className="notif-detail-reference">Reference: {selected.reference_id}</div>
                ) : null}
                {getNotificationRoute(selected, role) ? (
                  <button type="button" className="notif-detail-action" onClick={openSelectedLink}>
                    Open related page
                  </button>
                ) : null}
              </div>
            ) : items.length > 0 ? (
              items.slice(0, 8).map((item) => (
                <button
                  key={item.id || item._id}
                  type="button"
                  onClick={() => openNotification(item)}
                  className={`notif-item notif-${String(item.type || "INFO").toLowerCase()}${isUnread(item) ? "" : " is-read"}`}
                  style={{
                    width: "100%",
                    display: "block",
                    textAlign: "left",
                    padding: "10px 12px",
                    background: "#ffffff",
                    border: "none",
                    borderBottom: "1px solid #f0f0f0",
                    color: "#111111",
                  }}
                >
                  <div className="notif-title" style={{ fontSize: 13, fontWeight: isUnread(item) ? 600 : 400 }}>
                    {item.title || item.message || "Notification"}
                  </div>
                  {item.message && item.title ? (
                    <div className="notif-msg">{item.message}</div>
                  ) : null}
                  <div className="notif-time" style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                    {item.created_at || item.createdAt || ""}
                  </div>
                </button>
              ))
            ) : (
              <div className="notif-empty" style={{ padding: "14px 12px", color: "#6b7280" }}>No notifications</div>
            )}
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}
