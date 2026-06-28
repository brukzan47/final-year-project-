import { api, getApiBase, getToken } from "./client.js";

export const NotificationsAPI = {
  list: (limit = 30) => api.get(`/notifications?limit=${encodeURIComponent(limit)}`),
  unreadCount: () => api.get("/notifications/unread-count"),
  markRead: (id) => api.patch(`/notifications/${encodeURIComponent(id)}/read`, {}),
  markAllRead: () => api.patch("/notifications/read-all", {}),
  create: (payload) => api.post("/notifications", payload),
  listReportSchedules: () => api.get("/notifications/report-schedules"),
  saveReportSchedule: (payload) => api.post("/notifications/report-schedules", payload),
  deleteReportSchedule: (id) => api.del(`/notifications/report-schedules/${encodeURIComponent(id)}`),
  stream: (onMessage, onError) => {
    const token = getToken();
    if (!token) return null;
    const src = new EventSource(`${getApiBase()}/notifications/stream?token=${encodeURIComponent(token)}`);
    src.addEventListener("notification", (evt) => {
      try {
        const data = JSON.parse(evt.data);
        onMessage?.(data);
      } catch {}
    });
    src.addEventListener("error", () => {
      onError?.();
    });
    return src;
  },
};

export default NotificationsAPI;
