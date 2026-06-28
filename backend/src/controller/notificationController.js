import jwt from "jsonwebtoken";
import { Notification } from "../models/Notification.js";
import { env } from "../config/env.js";
import { subscribeUserStream, unsubscribeUserStream } from "../services/notificationRealtime.js";
import { createNotification, notifyRoleGroup } from "../services/notificationService.js";

function resolveToken(req) {
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.includes(" ")) return authHeader.split(" ")[1];
  if (req.query?.token) return String(req.query.token);
  return null;
}

function verifyFromQueryToken(req) {
  const token = resolveToken(req);
  if (!token) return null;
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch {
    return null;
  }
}

export const getNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const limit = Number(req.query?.limit || 50);
    const data = await Notification.listByUser(userId, { limit });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const unread = await Notification.countUnreadByUser(userId);
    return res.json({ unread });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const markRead = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const row = await Notification.markRead({ notification_id: req.params.id, user_id: userId });
    if (!row) return res.status(404).json({ message: "Notification not found" });
    return res.json(row);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const markAllRead = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const updated = await Notification.markAllRead(userId);
    return res.json({ updated });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const streamNotifications = async (req, res) => {
  try {
    const user = req.user || verifyFromQueryToken(req);
    if (!user?.id) return res.status(401).json({ message: "Unauthorized" });
    const userId = user.id;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    subscribeUserStream(userId, res);
    const ping = setInterval(() => {
      try {
        res.write(`event: ping\ndata: {"ts":"${new Date().toISOString()}"}\n\n`);
      } catch {}
    }, 25000);

    req.on("close", () => {
      clearInterval(ping);
      unsubscribeUserStream(userId, res);
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const createManualNotification = async (req, res) => {
  try {
    const {
      title,
      message,
      type = "INFO",
      category = "SYSTEM",
      reference_id = null,
      user_id = null,
      user_ids = [],
      roles = [],
      channels = ["IN_APP"],
    } = req.body || {};

    if (!title || !message) {
      return res.status(400).json({ message: "title and message are required" });
    }

    const created = [];
    const uniqueUserIds = [...new Set([user_id, ...(Array.isArray(user_ids) ? user_ids : [])].filter(Boolean))];
    for (const uid of uniqueUserIds) {
      const row = await createNotification({
        userId: uid,
        title,
        message,
        category,
        type,
        referenceId: reference_id,
        channels,
      });
      if (row) created.push(row);
    }

    if (Array.isArray(roles) && roles.length) {
      const byRole = await notifyRoleGroup({
        roles,
        title,
        message,
        category,
        type,
        referenceId: reference_id,
        channels,
      });
      created.push(...byRole);
    }

    return res.status(201).json({ count: created.length, notifications: created });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

