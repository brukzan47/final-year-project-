import app from "./app.js";
import { env } from "./src/config/env.js";
import { Role } from "./src/models/Role.js";
import { User } from "./src/models/User.js";
import { Importer } from "./src/models/Importer.js";
import { Shipment } from "./src/models/Shipment.js";
import { Declaration } from "./src/models/Declaration.js";
import { Inspection } from "./src/models/Inspection.js";
import { Payment } from "./src/models/Payment.js";
import { Clearance } from "./src/models/Clearance.js";
import { Performance } from "./src/models/Performance.js";
import { Document } from "./src/models/Document.js";
import { Notification } from "./src/models/Notification.js";
import { PaymentIntent } from "./src/models/PaymentIntent.js";
import { PaymentRefund } from "./src/models/PaymentRefund.js";
import { PaymentLedger } from "./src/models/PaymentLedger.js";
import { AuditLog } from "./src/models/AuditLog.js";
import { Tracking } from "./src/models/Tracking.js";
import { TrackingPoint } from "./src/models/TrackingPoint.js";
import { TrackingAudit } from "./src/models/TrackingAudit.js";
import { GpsDevice } from "./src/models/GpsDevice.js";
import { CurrencyApproval } from "./src/models/CurrencyApproval.js";
import { ImportPermit } from "./src/models/ImportPermit.js";
import { TransportLink } from "./src/models/TransportLink.js";
import { TransportEvent } from "./src/models/TransportEvent.js";
import { SmartIndex } from "./src/models/SmartIndex.js";
import { OcrExtract } from "./src/models/OcrExtract.js";
import { Location } from "./src/models/Location.js";
import { GoodsItem } from "./src/models/GoodsItem.js";
import { ReportSchedule } from "./src/models/ReportSchedule.js";
import { RiskModel } from "./src/modules/risk/risk.model.js";
import { logger } from "./src/utils/logger.js";
import { startEslPoller } from "./src/integrations/eslPoller.js";
import { startSingleWindowPoller } from "./src/integrations/singleWindowPoller.js";
import { startNotificationRulesJob } from "./src/services/notificationRulesJob.js";
import { startReportScheduleJob } from "./src/services/reportScheduleJob.js";

const PORT = env.port;

async function safeInit(name, fn) {
  try {
    await fn();
    logger.info(`Init ok: ${name}`);
  } catch (e) {
    logger.error(`Init failed: ${name}: ${e.message}`);
    if (env.strictStartup) throw e;
  }
}

(async () => {
  const requiresStrongJwt = env.nodeEnv === "production" || env.strictStartup;
  if (requiresStrongJwt && (!env.jwtSecret || (!env.allowWeakJwtSecret && /^dev-|supersecretkey$/i.test(env.jwtSecret)))) {
    throw new Error("JWT_SECRET must be configured with a strong value before server startup.");
  }

  await safeInit("roles", () => Role.createTable());
  await safeInit("users", () => User.createTable());
  await safeInit("importers", () => Importer.createTable());
  await safeInit("shipments", () => Shipment.createTable());
  await safeInit("declarations", () => Declaration.createTable());
  await safeInit("inspections", () => Inspection.createTable());
  await safeInit("payments", () => Payment.createTable());
  await safeInit("clearances", () => Clearance.createTable());
  await safeInit("performance", () => Performance.createTable());
  await safeInit("goods_items", () => GoodsItem.createTable());
  await safeInit("risk_engine", () => RiskModel.createTable());
  await safeInit("documents", () => Document.createTable());
  await safeInit("notifications", () => Notification.createTable());
  await safeInit("payment_intents", () => PaymentIntent.createTable());
  await safeInit("payment_refunds", () => PaymentRefund.createTable());
  await safeInit("payment_ledger", () => PaymentLedger.createTable());
  await safeInit("audit_logs", () => AuditLog.createTable());
  await safeInit("tracking", () => Tracking.createTable());
  await safeInit("tracking_points", () => TrackingPoint.createTable());
  await safeInit("tracking_audits", () => TrackingAudit.createTable());
  await safeInit("gps_devices", () => GpsDevice.createTable());
  await safeInit("currency_approvals", () => CurrencyApproval.createTable());
  await safeInit("import_permits", () => ImportPermit.createTable());
  await safeInit("transport_links", () => TransportLink.createTable());
  await safeInit("transport_events", () => TransportEvent.createTable());
  await safeInit("smart_index", () => SmartIndex.createTable());
  await safeInit("ocr_extracts", () => OcrExtract.createTable());
  await safeInit("locations", () => Location.createTable());
  await safeInit("report_schedules", () => ReportSchedule.createTable());
  await safeInit("seedRoles", () => Role.seedDefaults());

  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });

  // Start ESL poller if enabled
  try {
    startEslPoller(logger);
  } catch (e) {
    logger.error(`ESL poller init failed: ${e.message}`);
  }

  // Start Single Window pollers (NBE, Trade) if enabled
  try {
    startSingleWindowPoller(logger);
  } catch (e) {
    logger.error(`Single Window poller init failed: ${e.message}`);
  }

  // Start smart notification reminders/escalations
  try {
    startNotificationRulesJob(logger);
  } catch (e) {
    logger.error(`Notification rules job init failed: ${e.message}`);
  }

  // Start scheduled email report sender
  try {
    startReportScheduleJob(logger);
  } catch (e) {
    logger.error(`Report schedule job init failed: ${e.message}`);
  }
})();

