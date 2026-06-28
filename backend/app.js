import express from "express";
import cors from "cors";
import helmet from "helmet";
import bodyParser from "body-parser";
import { morganLogger, logger } from "./src/utils/logger.js";
import { errorHandler } from "./src/middleware/errorHandler.js";
import { rateLimit } from "./src/middleware/rateLimit.js";
import { env } from "./src/config/env.js";

// Import Routes
import authRoutes from "./src/routes/authRoutes.js";
import importerRoutes from "./src/routes/importerRoutes.js";
import importerSelfRoutes from "./src/routes/importerSelfRoutes.js";
import shipmentRoutes from "./src/routes/shipmentRoutes.js";
import declarationRoutes from "./src/routes/declarationRoutes.js";
import inspectionRoutes from "./src/routes/inspectionRoutes.js";
import paymentRoutes from "./src/routes/paymentRoutes.js";
import paymentWorkflowRoutes from "./src/routes/paymentWorkflowRoutes.js";
import bankWebhookRoutes from "./src/routes/bankWebhookRoutes.js";
import clearanceRoutes from "./src/routes/clearanceRoutes.js";
import performanceRoutes from "./src/routes/performanceRoutes.js";
import documentRoutes from "./src/routes/documentRoutes.js";
import notificationRoutes from "./src/routes/notificationRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import paymentIntentRoutes from "./src/routes/paymentIntentRoutes.js";
import refundRoutes from "./src/routes/refundRoutes.js";
import trackingRoutes from "./src/routes/trackingRoutes.js";
import importerTrackingRoutes from "./src/routes/importerTrackingRoutes.js";
import assistantRoutes from "./src/routes/assistantRoutes.js";
import analyticsRoutes from "./src/routes/analyticsRoutes.js";
import exportRoutes from "./src/routes/exportRoutes.js";
import publicRoutes from "./src/routes/publicRoutes.js";
import riskRoutes from "./src/routes/riskRoutes.js";
import goodsItemRoutes from "./src/routes/goodsItemRoutes.js";
import smartRoutes from "./src/routes/smartRoutes.js";
import nbeRoutes from "./src/routes/nbeRoutes.js";
import tradeRoutes from "./src/routes/tradeRoutes.js";
import transportRoutes from "./src/routes/transportRoutes.js";
import singleWindowRoutes from "./src/routes/singleWindowRoutes.js";
import locationRoutes from "./src/routes/locationRoutes.js";
import systemHealthRoutes from "./src/routes/systemHealthRoutes.js";

const app = express();

// Middleware
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("CORS origin not allowed"));
  },
  credentials: true,
}));
app.use(helmet());
app.use(rateLimit({ windowMs: 60_000, max: 300, scope: "api" }));
// Mount bank webhook BEFORE JSON parsing to preserve raw body for HMAC
app.use("/api/bank", bankWebhookRoutes);
app.use(bodyParser.json({ limit: "1mb" }));
app.use(morganLogger);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/importers", importerRoutes);
app.use("/api/importers", importerSelfRoutes);
app.use("/api/shipments", shipmentRoutes);
app.use("/api/declarations", declarationRoutes);
app.use("/api/inspections", inspectionRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/payments", paymentWorkflowRoutes);
app.use("/api/clearances", clearanceRoutes);
app.use("/api/performance", performanceRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/payments", paymentIntentRoutes);
app.use("/api/refunds", refundRoutes);
app.use("/api/tracking", trackingRoutes);
app.use("/api/importer/tracking", importerTrackingRoutes);
app.use("/api/assistant", assistantRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/risk", riskRoutes);
app.use("/api/goods-items", goodsItemRoutes);
app.use("/api/smart", smartRoutes);
app.use("/api/integrations/nbe", nbeRoutes);
app.use("/api/integrations/trade", tradeRoutes);
app.use("/api/integrations/transport", transportRoutes);
app.use("/api/single-window", singleWindowRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/system-health", systemHealthRoutes);

// Health check
app.get("/", (req, res) => {
  res.json({ message: "🇪🇹 Ethiopian Import Customs API is running..." });
});

// Global Error Handler
app.use(errorHandler);

export default app;
