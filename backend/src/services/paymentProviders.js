import { env } from "../config/env.js";

const PROVIDERS = {
  CBE: {
    key: "CBE",
    label: "CBE",
    checkoutUrl: (intentId) => `https://apps.cbe.com.et/payment?intent_id=${encodeURIComponent(intentId)}`,
    webhookSecret: () => env.webhooks.cbeSecret || "",
  },
  TELEBIRR: {
    key: "TELEBIRR",
    label: "Telebirr",
    checkoutUrl: (intentId) => `https://telebirr.et/pay?intent_id=${encodeURIComponent(intentId)}`,
    webhookSecret: () => env.webhooks.telebirrSecret || "",
  },
  CHAPA: {
    key: "CHAPA",
    label: "Chapa",
    checkoutUrl: (intentId) => `https://checkout.chapa.co/checkout/payment/${encodeURIComponent(intentId)}`,
    webhookSecret: () => env.webhooks.chapaSecret || "",
  },
};

export function normalizeProvider(provider) {
  return String(provider || "").trim().toUpperCase();
}

export function isSupportedProvider(provider) {
  return !!PROVIDERS[normalizeProvider(provider)];
}

export function getProvider(provider) {
  return PROVIDERS[normalizeProvider(provider)] || null;
}

export function getProviderCheckoutUrl(provider, intentId) {
  const cfg = getProvider(provider);
  return cfg ? cfg.checkoutUrl(intentId) : null;
}

export function getSupportedProviders() {
  return Object.values(PROVIDERS).map(({ key, label }) => ({ key, label }));
}

export function getProviderWebhookSecret(provider) {
  const cfg = getProvider(provider);
  return cfg ? cfg.webhookSecret() : "";
}

