import { Declaration } from "../models/Declaration.js";
import { pool } from "../config/db.js";
import { notifyImporterByDeclaration } from "../utils/notify.js";
import { notifyRoleGroup } from "../services/notificationService.js";
import { CustomsCalculator as Calc } from "../utils/calculator.js";
import { RiskEngineService } from "../modules/risk/risk.service.js";
import { logger } from "../utils/logger.js";
import { isImporterLike } from "../utils/roles.js";

export const getDeclarations = async (req, res) => {
  try {
    let data;
    if (isImporterLike(req.user?.role) && req.user?.email) {
      const q = `
        SELECT d.*, s.shipment_reference, i.company_name
        FROM declarations d
        JOIN shipments s ON d.shipment_id = s.shipment_id
        JOIN importers i ON s.importer_id = i.importer_id
        WHERE i.contact_email = $1
        ORDER BY d.declaration_date DESC;
      `;
      const r = await pool.query(q, [req.user.email]);
      data = r.rows;
    } else {
      data = await Declaration.getAll();
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createDeclaration = async (req, res) => {
  try {
    const body = { ...(req.body || {}) };
    const emptyToNull = (value) => (typeof value === "string" && value.trim() === "" ? null : value);
    const numericOrNull = (value) => {
      const normalized = emptyToNull(value);
      if (normalized === null || normalized === undefined) return null;
      const number = Number(normalized);
      return Number.isFinite(number) ? number : normalized;
    };

    if (typeof body.declaration_no === 'string') body.declaration_no = body.declaration_no.trim().toUpperCase();
    body.declarant_agent = emptyToNull(body.declarant_agent);
    body.customs_station = emptyToNull(body.customs_station);
    body.valuation_basis = emptyToNull(body.valuation_basis);
    body.payment_receipt_no = emptyToNull(body.payment_receipt_no);
    body.tariff_rate = numericOrNull(body.tariff_rate);
    body.duties_etb = numericOrNull(body.duties_etb);
    if (!body.shipment_id) return res.status(400).json({ message: 'shipment_id is required' });
    if (body.tariff_rate === null) return res.status(400).json({ message: 'tariff_rate is required' });
    if (!Number.isFinite(Number(body.tariff_rate))) return res.status(400).json({ message: 'tariff_rate must be a valid number' });
    if (body.duties_etb !== null && !Number.isFinite(Number(body.duties_etb))) {
      return res.status(400).json({ message: 'duties_etb must be a valid number' });
    }
    {
      const shipmentExists = await pool.query(`SELECT shipment_id FROM shipments WHERE shipment_id=$1 LIMIT 1`, [body.shipment_id]);
      if (shipmentExists.rowCount === 0) return res.status(404).json({ message: 'Shipment not found' });
    }
    {
      const existingByShipment = await pool.query(
        `SELECT declaration_id, declaration_no
           FROM declarations
          WHERE shipment_id = $1
          LIMIT 1`,
        [body.shipment_id]
      );
      if (existingByShipment.rowCount > 0) {
        const row = existingByShipment.rows[0];
        return res.status(409).json({
          message: 'This shipment already has a declaration',
          declaration_id: row.declaration_id,
          declaration_no: row.declaration_no,
        });
      }
    }
    // Validate/generate Declaration No
    const isValidDecNo = (v) => /^DEC-(ET-)?\d{4}-\d{4,6}$/.test(String(v || ''));
    const genDecNo = async () => {
      const y = new Date().getFullYear();
      for (let i = 0; i < 10; i++) {
        const seq = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
        const candidate = `DEC-ET-${y}-${seq}`;
        const dupe = await pool.query(`SELECT declaration_id FROM declarations WHERE declaration_no=$1 LIMIT 1`, [candidate]);
        if (dupe.rowCount === 0) return candidate;
      }
      return null;
    };
    if (!body.declaration_no || !isValidDecNo(body.declaration_no)) {
      const auto = await genDecNo();
      if (!auto) return res.status(500).json({ message: 'Failed to assign declaration number' });
      body.declaration_no = auto;
    } else {
      const dupe = await pool.query(`SELECT declaration_id FROM declarations WHERE declaration_no=$1 LIMIT 1`, [body.declaration_no]);
      if (dupe.rowCount > 0) return res.status(409).json({ message: 'Declaration number already exists' });
    }

    const declaration = await Declaration.create(body);
    // Auto-create an initial pending payment so new declarations appear in Payment Board.
    try {
      const exists = await pool.query(
        "SELECT 1 FROM payments WHERE declaration_id=$1 AND payment_status IN ('Pending','Verified') LIMIT 1",
        [declaration.declaration_id]
      );
      if (exists.rowCount === 0) {
        const shipmentRow = await pool.query(
          "SELECT cif_value_usd FROM shipments WHERE shipment_id=$1 LIMIT 1",
          [body.shipment_id]
        );
        const cifUsd = Number(shipmentRow.rows?.[0]?.cif_value_usd);
        const tariffRate = body.tariff_rate === null ? NaN : Number(body.tariff_rate);
        const declaredDuty = body.duties_etb === null ? NaN : Number(body.duties_etb);
        const fxRate = Number(process.env.DEFAULT_EXCHANGE_RATE || 130);

        let cifEtb = null;
        let dutyPaid = null;
        let vatPaid = null;
        let totalPayable = null;

        if (Number.isFinite(cifUsd) && cifUsd > 0 && Number.isFinite(fxRate) && fxRate > 0) {
          cifEtb = Math.round(Calc.cifToETB(cifUsd, fxRate) * 100) / 100;
        }

        if (Number.isFinite(declaredDuty) && declaredDuty > 0) {
          dutyPaid = Math.round(declaredDuty * 100) / 100;
          totalPayable = dutyPaid;
        } else if (Number.isFinite(cifEtb) && Number.isFinite(tariffRate) && tariffRate >= 0) {
          const duty = Calc.calculateDuty(cifEtb, tariffRate);
          const vat = Calc.calculateVAT(cifEtb, duty);
          const total = Calc.totalPayable(cifEtb, duty, vat, 0);
          dutyPaid = Math.round(duty * 100) / 100;
          vatPaid = Math.round(vat * 100) / 100;
          totalPayable = Math.round(total * 100) / 100;
        }

        const y = new Date().getFullYear();
        const rand = Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
        const paymentOrderNo = `PO-${y}-${rand}`;

        await pool.query(
          `INSERT INTO payments
            (declaration_id, invoice_value_usd, exchange_rate, cif_etb, duty_paid, vat_paid, excise_paid, total_payable,
             receipt_no, payment_method, payment_status, payment_date, payment_order_no)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            declaration.declaration_id,
            Number.isFinite(cifUsd) ? cifUsd : null,
            Number.isFinite(fxRate) ? fxRate : null,
            Number.isFinite(cifEtb) ? cifEtb : null,
            Number.isFinite(dutyPaid) ? dutyPaid : null,
            Number.isFinite(vatPaid) ? vatPaid : null,
            0,
            Number.isFinite(totalPayable) ? totalPayable : null,
            null,
            null,
            "Pending",
            null,
            paymentOrderNo,
          ]
        );
      }
    } catch {}
    // Auto-link shipment goods_items to this declaration if any exist
    try {
      if (declaration?.declaration_id && req.body?.shipment_id) {
        await pool.query(
          `UPDATE goods_items
             SET declaration_id=$1, shipment_id = NULL
           WHERE shipment_id=$2 AND declaration_id IS NULL`,
          [declaration.declaration_id, req.body.shipment_id]
        );
        // Also attach shipment-level supporting documents to this declaration.
        await pool.query(
          `UPDATE documents
              SET declaration_id = $1
            WHERE shipment_id = $2
              AND declaration_id IS NULL`,
          [declaration.declaration_id, req.body.shipment_id]
        );
      }
    } catch {}
    try {
      await notifyRoleGroup({
        roles: ["Customs Officer"],
        title: { en: "New Declaration Submitted", am: "አዲስ መግለጫ ቀርቧል" },
        message: {
          en: `${declaration.declaration_no || "Declaration"} requires review.`,
          am: `${declaration.declaration_no || "መግለጫ"} ለግምገማ ዝግጁ ነው።`,
        },
        category: "DECLARATION",
        type: "INFO",
        referenceId: declaration.declaration_id,
        eventKeyPrefix: `event:declaration_submitted:${declaration.declaration_id}`,
      });
    } catch {}

    let withRisk = declaration;
    try {
      const scored = await RiskEngineService.scoreAndPersist(declaration.declaration_id);
      if (scored) {
        withRisk = {
          ...declaration,
          risk_score: scored.risk_score,
          risk_channel: scored.risk_channel,
          risk_reason: scored.risk_reason,
        };
      }
    } catch (riskErr) {
      logger.warn(`Risk scoring failed for declaration ${declaration.declaration_id}: ${riskErr.message}`);
    }

    res.status(201).json(withRisk);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

import { env } from "../config/env.js";

export const approveDeclaration = async (req, res) => {
  try {
    // Policy: enforce valid and unique declaration number before approval
    if (env.declaration?.enforceValidNumber || env.declaration?.enforceUniqueNumber) {
      const q = await pool.query(`SELECT declaration_no FROM declarations WHERE declaration_id=$1`, [req.params.id]);
      if (q.rowCount === 0) return res.status(404).json({ message: 'Declaration not found' });
      const no = String(q.rows[0]?.declaration_no || '').toUpperCase();
      const valid = /^DEC-(ET-)?\d{4}-\d{4,6}$/.test(no);
      if (env.declaration.enforceValidNumber && !valid) {
        return res.status(400).json({ message: 'Cannot approve: invalid Declaration No format' });
      }
      if (env.declaration.enforceUniqueNumber && no) {
        const dup = await pool.query(`SELECT COUNT(1) AS cnt FROM declarations WHERE declaration_no=$1 AND declaration_id<>$2`, [no, req.params.id]);
        const cnt = Number(dup.rows[0]?.cnt || 0);
        if (cnt > 0) return res.status(400).json({ message: 'Cannot approve: duplicate Declaration No' });
      }
    }

    const updated = await Declaration.setStatus({ id: req.params.id, status: 'Accepted', reason: null });
    if (!updated) return res.status(404).json({ message: 'Declaration not found' });
    try {
      await notifyImporterByDeclaration({
        declaration_id: req.params.id,
        title: { en: "Declaration Accepted", am: "መግለጫ ተቀባ" },
        message: {
          en: "Your customs declaration has been accepted.",
          am: "የእርስዎ የጉምሩክ መግለጫ ተቀባ።",
        },
      });
    } catch {}
    res.json({ ok: true, declaration: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const rejectDeclaration = async (req, res) => {
  try {
    const reason = (req.body?.reason || '').toString() || null;
    const updated = await Declaration.setStatus({ id: req.params.id, status: 'Rejected', reason });
    if (!updated) return res.status(404).json({ message: 'Declaration not found' });
    try {
      await notifyImporterByDeclaration({
        declaration_id: req.params.id,
        title: { en: "Declaration Rejected", am: "መግለጫ ተከልክሏል" },
        message: {
          en: `Your customs declaration was rejected.${reason ? ` Reason: ${reason}` : ""}`,
          am: `የእርስዎ የጉምሩክ መግለጫ ተከልክሏል።${reason ? ` ምክንያት: ${reason}` : ""}`,
        },
      });
    } catch {}
    res.json({ ok: true, declaration: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const findByNumber = async (req, res) => {
  try {
    const no = String((req.query?.no || req.params?.declaration_no || "")).trim().toUpperCase();
    if (!no) return res.status(400).json({ message: "declaration_no is required" });

    // Restrict Importer to their own declarations
    let q, params;
    if (isImporterLike(req.user?.role) && req.user?.email) {
      q = `
        SELECT d.*, s.shipment_reference, i.company_name
        FROM declarations d
        JOIN shipments s ON d.shipment_id = s.shipment_id
        JOIN importers i ON s.importer_id = i.importer_id
        WHERE d.declaration_no = $1 AND i.contact_email = $2
        LIMIT 1`;
      params = [no, req.user.email];
    } else {
      q = `
        SELECT d.*, s.shipment_reference, i.company_name
        FROM declarations d
        JOIN shipments s ON d.shipment_id = s.shipment_id
        JOIN importers i ON s.importer_id = i.importer_id
        WHERE d.declaration_no = $1
        LIMIT 1`;
      params = [no];
    }
    const r = await pool.query(q, params);
    if (r.rowCount === 0) return res.status(404).json({ message: "Declaration not found" });
    return res.json(r.rows[0]);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const reportInvalidNumbers = async (_req, res) => {
  try {
    const invalid = (await pool.query(
      `SELECT d.declaration_id, d.declaration_no, d.declaration_date, s.shipment_reference, i.company_name
       FROM declarations d
       JOIN shipments s ON d.shipment_id = s.shipment_id
       JOIN importers i ON s.importer_id = i.importer_id
       WHERE d.declaration_no IS NULL OR d.declaration_no = '' OR d.declaration_no !~ '^DEC-(ET-)?[0-9]{4}-[0-9]{4,6}$'`
    )).rows || [];

    const duplicates = (await pool.query(
      `WITH dup AS (
         SELECT declaration_no
         FROM declarations
         WHERE declaration_no IS NOT NULL AND declaration_no <> ''
         GROUP BY declaration_no HAVING COUNT(*) > 1
       )
       SELECT d.declaration_id, d.declaration_no, d.declaration_date, s.shipment_reference, i.company_name
       FROM declarations d
       JOIN dup x ON x.declaration_no = d.declaration_no
       JOIN shipments s ON d.shipment_id = s.shipment_id
       JOIN importers i ON s.importer_id = i.importer_id
       ORDER BY d.declaration_no`
    )).rows || [];

    return res.json({ invalid, duplicates });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const regenerateNumber = async (req, res) => {
  try {
    const { id } = req.params || {};
    if (!id) return res.status(400).json({ message: "declaration_id is required" });
    const exists = await pool.query(`SELECT declaration_id FROM declarations WHERE declaration_id=$1`, [id]);
    if (exists.rowCount === 0) return res.status(404).json({ message: "Declaration not found" });

    const genDecNo = async () => {
      const y = new Date().getFullYear();
      for (let i = 0; i < 20; i++) {
        const seq = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
        const candidate = `DEC-ET-${y}-${seq}`;
        const dupe = await pool.query(`SELECT declaration_id FROM declarations WHERE declaration_no=$1 AND declaration_id<>$2 LIMIT 1`, [candidate, id]);
        if (dupe.rowCount === 0) return candidate;
      }
      return null;
    };
    const no = await genDecNo();
    if (!no) return res.status(500).json({ message: 'Failed to generate unique declaration number' });

    const upd = await pool.query(`UPDATE declarations SET declaration_no=$2 WHERE declaration_id=$1 RETURNING *`, [id, no]);
    return res.json(upd.rows[0] || null);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const importNumbers = async (req, res) => {
  try {
    let items = [];
    if (Array.isArray(req.body?.items)) {
      items = req.body.items;
    } else if (typeof req.body?.csv === 'string') {
      const lines = req.body.csv.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      if (lines.length > 0) {
        const header = lines[0].toLowerCase();
        const hasHeader = header.includes('declaration_id') || header.includes('declaration_no');
        const start = hasHeader ? 1 : 0;
        for (let i = start; i < lines.length; i++) {
          const parts = lines[i].split(',');
          if (parts.length < 2) continue;
          items.push({ declaration_id: parts[0].trim(), declaration_no: parts[1].trim().toUpperCase() });
        }
      }
    }

    const isValid = (v) => /^DEC-(ET-)?\d{4}-\d{4,6}$/.test(String(v || ''));
    const results = [];

    for (const row of items) {
      const id = row.declaration_id;
      const no = String(row.declaration_no || '').toUpperCase();
      if (!id || !no) { results.push({ id, no, status: 'skipped', reason: 'missing id or number' }); continue; }
      if (!isValid(no)) { results.push({ id, no, status: 'error', reason: 'invalid format' }); continue; }
      const exists = await pool.query(`SELECT declaration_id FROM declarations WHERE declaration_id=$1`, [id]);
      if (exists.rowCount === 0) { results.push({ id, no, status: 'error', reason: 'declaration not found' }); continue; }
      const dup = await pool.query(`SELECT COUNT(1) AS cnt FROM declarations WHERE declaration_no=$1 AND declaration_id<>$2`, [no, id]);
      if (Number(dup.rows[0]?.cnt || 0) > 0) { results.push({ id, no, status: 'error', reason: 'duplicate number' }); continue; }
      await pool.query(`UPDATE declarations SET declaration_no=$2 WHERE declaration_id=$1`, [id, no]);
      results.push({ id, no, status: 'ok' });
    }

    const summary = results.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {});
    return res.json({ summary, results });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};


