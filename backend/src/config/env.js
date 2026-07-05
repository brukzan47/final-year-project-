import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..", "..");

// Always load backend/.env regardless of process cwd.
dotenv.config({ path: path.join(backendRoot, ".env") });

function normalizeDatabaseUrl(raw) {
  let url = String(raw || "").trim();
  if (url.startsWith("DATABASE_URL=")) {
    url = url.slice("DATABASE_URL=".length).trim();
  }
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes(".render.com") && /^dpg-[a-z0-9-]+$/i.test(parsed.hostname) && !process.env.RENDER) {
      parsed.hostname = `${parsed.hostname}.ohio-postgres.render.com`;
      return parsed.toString();
    }
  } catch {}
  return url;
}

const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);
const databaseUrlRequiresSsl =
  /[?&]sslmode=require\b/i.test(databaseUrl) ||
  /\.render\.com(?:\/|:|$)/i.test(databaseUrl) ||
  /-postgres\.render\.com(?:\/|:|$)/i.test(databaseUrl);

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: process.env.PORT || 5000,
  corsOrigins: (
    process.env.CORS_ORIGINS ||
    "http://localhost:5173,http://127.0.0.1:5173,https://ethiopian-import-management-system2026.onrender.com"
  )
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean),
  strictStartup: (process.env.STRICT_STARTUP || (process.env.NODE_ENV === "production" ? "true" : "false")).toLowerCase() === "true",
  allowWeakJwtSecret: (process.env.ALLOW_WEAK_JWT_SECRET || "false").toLowerCase() === "true",
  db: {
    connectionString: databaseUrl,
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASS || "postgres",
    database: process.env.DB_NAME || "customs_db",
    port: process.env.DB_PORT || 5432,
    ssl: (process.env.DB_SSL || (databaseUrlRequiresSsl ? "true" : "false")).toLowerCase() === "true",
  },
  jwtSecret: process.env.JWT_SECRET || (process.env.NODE_ENV === "production" ? "" : "dev-insecure-change-me"),
  webhooks: {
    cbeSecret: process.env.CBE_WEBHOOK_SECRET || "",
    awashSecret: process.env.AWASH_WEBHOOK_SECRET || "",
    telebirrSecret: process.env.TELEBIRR_WEBHOOK_SECRET || "",
    chapaSecret: process.env.CHAPA_WEBHOOK_SECRET || "",
  },
  payments: {
    cbeCheckoutUrl: process.env.CBE_CHECKOUT_URL || "",
    telebirrCheckoutUrl: process.env.TELEBIRR_CHECKOUT_URL || "",
    chapaCheckoutUrl: process.env.CHAPA_CHECKOUT_URL || "",
  },
  mail: {
    enabled: (process.env.EMAIL_ENABLED || "false").toLowerCase() === "true",
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "no-reply@customs.local",
    secure: (process.env.SMTP_SECURE || "false").toLowerCase() === "true",
  },
  receipts: {
    logoPath: process.env.RECEIPT_LOGO_PATH || "",
  },
  sms: {
    enabled: (process.env.SMS_ENABLED || "false").toLowerCase() === "true",
    provider: process.env.SMS_PROVIDER || "",
    apiKey: process.env.SMS_API_KEY || "",
    sender: process.env.SMS_SENDER || "",
  },
  tracking: {
    esl: {
      enabled: (process.env.ESL_TRACKING_ENABLED || "false").toLowerCase() === "true",
      baseUrl: process.env.ESL_BASE_URL || "",
      apiKey: process.env.ESL_API_KEY || "",
      pollingSec: Number(process.env.ESL_POLLING_SEC || 60),
      webhookSecret: process.env.ESL_WEBHOOK_SECRET || "",
    },
    gpsSecret: process.env.GPS_INGEST_SECRET || "",
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  },
  blockchain: {
    enabled: (process.env.BLOCKCHAIN_ENABLED || "false").toLowerCase() === "true",
    mode: process.env.ANCHOR_MODE || "stub", // 'stub' | 'rawtx' | 'contract'
    rpcUrl: process.env.RPC_URL || "",
    privateKey: process.env.PRIVATE_KEY || "",
    chainId: Number(process.env.CHAIN_ID || 0) || undefined,
    networkName: process.env.NETWORK_NAME || "",
    contractAddress: process.env.CONTRACT_ADDRESS || "",
  },
  declaration: {
    enforceValidNumber: (process.env.DECL_ENFORCE_VALID || "false").toLowerCase() === "true",
    enforceUniqueNumber: (process.env.DECL_ENFORCE_UNIQUE || "false").toLowerCase() === "true",
  },
  singleWindow: {
    nbe: {
      enabled: (process.env.NBE_ENABLED || "false").toLowerCase() === "true",
      baseUrl: process.env.NBE_BASE_URL || "",
      clientId: process.env.NBE_CLIENT_ID || "",
      clientSecret: process.env.NBE_CLIENT_SECRET || "",
      webhookSecret: process.env.NBE_WEBHOOK_SECRET || "",
      timeoutMs: Number(process.env.NBE_TIMEOUT_MS || 8000),
      pollingSec: Number(process.env.NBE_POLLING_SEC || 60),
    },
    trade: {
      enabled: (process.env.TRADE_ENABLED || "false").toLowerCase() === "true",
      baseUrl: process.env.TRADE_BASE_URL || "",
      apiKey: process.env.TRADE_API_KEY || "",
      webhookSecret: process.env.TRADE_WEBHOOK_SECRET || "",
      timeoutMs: Number(process.env.TRADE_TIMEOUT_MS || 8000),
      pollingSec: Number(process.env.TRADE_POLLING_SEC || 60),
    },
    transport: {
      enabled: (process.env.TRANSPORT_ENABLED || "false").toLowerCase() === "true",
      baseUrl: process.env.TRANSPORT_BASE_URL || "",
      apiKey: process.env.TRANSPORT_API_KEY || "",
      webhookSecret: process.env.TRANSPORT_WEBHOOK_SECRET || "",
      timeoutMs: Number(process.env.TRANSPORT_TIMEOUT_MS || 8000),
    },
  },
  smart: {
    enabled: (process.env.SMART_ENABLED || "false").toLowerCase() === "true",
    searchEnabled: (process.env.SEARCH_ENABLED || "false").toLowerCase() === "true",
    ocrEnabled: (process.env.OCR_ENABLED || "false").toLowerCase() === "true",
    logSuggestions: (process.env.SMART_LOG_SUGGESTIONS || "false").toLowerCase() === "true",
  },
};
