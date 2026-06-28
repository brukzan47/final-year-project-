import express from "express";
import {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  streamNotifications,
  createManualNotification,
} from "../controller/notificationController.js";
import { deleteReportSchedule, listReportSchedules, saveReportSchedule } from "../controller/reportScheduleController.js";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/roleCheck.js";

const router = express.Router();

// Live stream (supports bearer token header or ?token= for EventSource)
router.get("/stream", streamNotifications);

// List personal notifications
router.get("/", verifyToken, authorizeRoles("Super Admin", "Admin", "Customs Officer", "Importer", "Finance Officer", "Inspector", "Clearance Officer", "Document Officer", "Risk Analyst", "Port Officer", "Auditor"), getNotifications);

// Badge count
router.get("/unread-count", verifyToken, authorizeRoles("Super Admin", "Admin", "Customs Officer", "Importer", "Finance Officer", "Inspector", "Clearance Officer", "Document Officer", "Risk Analyst", "Port Officer", "Auditor"), getUnreadCount);

// Mark one read
router.patch("/:id/read", verifyToken, authorizeRoles("Super Admin", "Admin", "Customs Officer", "Importer", "Finance Officer", "Inspector", "Clearance Officer", "Document Officer", "Risk Analyst", "Port Officer", "Auditor"), markRead);

// Mark all read
router.patch("/read-all", verifyToken, authorizeRoles("Super Admin", "Admin", "Customs Officer", "Importer", "Finance Officer", "Inspector", "Clearance Officer", "Document Officer", "Risk Analyst", "Port Officer", "Auditor"), markAllRead);

// Manual push notification (admin/officer)
router.post("/", verifyToken, authorizeRoles("Admin", "Customs Officer", "Document Officer", "Inspector", "Clearance Officer", "Risk Analyst", "Port Officer", "Finance Officer"), createManualNotification);
router.get("/report-schedules", verifyToken, authorizeRoles("Admin"), listReportSchedules);
router.post("/report-schedules", verifyToken, authorizeRoles("Admin"), saveReportSchedule);
router.delete("/report-schedules/:id", verifyToken, authorizeRoles("Admin"), deleteReportSchedule);

export default router;

