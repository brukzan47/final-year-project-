import { pool } from "../config/db.js";
import { env } from "../config/env.js";
import { getApprovalStatus } from "../clients/nbeClient.js";
import { getPermitStatus } from "../clients/tradeClient.js";
import { getLinkStatus } from "../clients/transportClient.js";

let nbeLastRun = null;
let nbeLastUpdated = 0;
let tradeLastRun = null;
let tradeLastUpdated = 0;
let transportLastRun = null;
let transportLastUpdated = 0;

function startNbePoll(logger) {
  if (!env.singleWindow?.nbe?.enabled) return () => {};
  let running = false;
  const intervalMs = Math.max(10, Number(env.singleWindow.nbe.pollingSec || 60)) * 1000;
  const tick = async () => {
    if (running) return; running = true;
    try {
      const q = await pool.query(
        `SELECT approval_id, request_ref
           FROM currency_approvals
          WHERE COALESCE(status,'Pending') = 'Pending' AND request_ref IS NOT NULL
          ORDER BY updated_at ASC
          LIMIT 50`
      );
      let updated = 0;
      for (const row of q.rows) {
        try {
          const s = await getApprovalStatus({ request_ref: row.request_ref });
          if (s && s.status && s.status !== 'Pending') {
            await pool.query(
              `UPDATE currency_approvals SET status=$1, raw=$2, updated_at=now() WHERE approval_id=$3`,
              [s.status, JSON.stringify(s), row.approval_id]
            );
            updated++;
          }
        } catch (e) { logger?.warn?.(`NBE poll error: ${e.message}`); }
      }
    } catch (e) { logger?.error?.(`NBE poll loop failed: ${e.message}`); }
    finally { nbeLastRun = new Date().toISOString(); if (updated) nbeLastUpdated = updated; running = false; }
  };
  const id = setInterval(tick, intervalMs);
  return () => clearInterval(id);
}

function startTradePoll(logger) {
  if (!env.singleWindow?.trade?.enabled) return () => {};
  let running = false;
  const intervalMs = Math.max(10, Number(env.singleWindow.trade.pollingSec || 60)) * 1000;
  const tick = async () => {
    if (running) return; running = true;
    try {
      const q = await pool.query(
        `SELECT permit_id, permit_no
           FROM import_permits
          WHERE COALESCE(status,'Pending') = 'Pending' AND permit_no IS NOT NULL
          ORDER BY updated_at ASC
          LIMIT 50`
      );
      let updated = 0;
      for (const row of q.rows) {
        try {
          const s = await getPermitStatus({ permit_no: row.permit_no });
          if (s && s.status && s.status !== 'Pending') {
            await pool.query(
              `UPDATE import_permits SET status=$1, raw=$2, updated_at=now() WHERE permit_id=$3`,
              [s.status, JSON.stringify(s), row.permit_id]
            );
            updated++;
          }
        } catch (e) { logger?.warn?.(`Trade poll error: ${e.message}`); }
      }
    } catch (e) { logger?.error?.(`Trade poll loop failed: ${e.message}`); }
    finally { tradeLastRun = new Date().toISOString(); if (updated) tradeLastUpdated = updated; running = false; }
  };
  const id = setInterval(tick, intervalMs);
  return () => clearInterval(id);
}

export function startSingleWindowPoller(logger) {
  const stops = [];
  try { stops.push(startNbePoll(logger)); } catch (e) { logger?.error?.(`NBE poller init failed: ${e.message}`); }
  try { stops.push(startTradePoll(logger)); } catch (e) { logger?.error?.(`Trade poller init failed: ${e.message}`); }
  try {
    // Simple transport link poller: refresh links that are not 'Linked'
    if (env.singleWindow?.transport?.enabled) {
      let running = false;
      const intervalMs = Math.max(10, Number(env.singleWindow.transport.pollingSec || 60)) * 1000;
      const tick = async () => {
        if (running) return; running = true;
        try {
          const q = await pool.query(
            `SELECT link_id, provider_ref, COALESCE(status,'') AS status
               FROM transport_links
              WHERE COALESCE(status,'') <> 'Linked' AND provider_ref IS NOT NULL
              ORDER BY updated_at ASC
              LIMIT 50`
          );
      let updated = 0;
      for (const row of q.rows) {
        try {
          const s = await getLinkStatus({ provider_ref: row.provider_ref });
          if (s && s.status && s.status !== row.status) {
            await pool.query(
              `UPDATE transport_links SET status=$1, raw=$2, updated_at=now() WHERE link_id=$3`,
              [s.status, JSON.stringify(s), row.link_id]
            );
            updated++;
          }
        } catch (e) { logger?.warn?.(`Transport poll error: ${e.message}`); }
      }
    } catch (e) { logger?.error?.(`Transport poll loop failed: ${e.message}`); }
    finally { transportLastRun = new Date().toISOString(); if (updated) transportLastUpdated = updated; running = false; }
  };
      const id = setInterval(tick, intervalMs);
      stops.push(() => clearInterval(id));
    }
  } catch (e) { logger?.error?.(`Transport poller init failed: ${e.message}`); }
  return () => { for (const stop of stops) { try { stop?.(); } catch {} } };
}

export function getSingleWindowPollStatus() {
  return {
    nbe: {
      enabled: !!env.singleWindow?.nbe?.enabled,
      pollingSec: Number(env.singleWindow?.nbe?.pollingSec || 0),
      lastRun: nbeLastRun,
      lastUpdated: nbeLastUpdated,
    },
    trade: {
      enabled: !!env.singleWindow?.trade?.enabled,
      pollingSec: Number(env.singleWindow?.trade?.pollingSec || 0),
      lastRun: tradeLastRun,
      lastUpdated: tradeLastUpdated,
    },
    transport: {
      enabled: !!env.singleWindow?.transport?.enabled,
      pollingSec: Number(env.singleWindow?.transport?.pollingSec || 0),
      lastRun: transportLastRun,
      lastUpdated: transportLastUpdated,
    },
  };
}
