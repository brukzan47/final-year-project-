import "dotenv/config";
import { pool } from "../src/config/db.js";

const API_BASE = (process.env.API_BASE || "http://localhost:5000/api").replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "MySecret123";

function fail(message) {
  throw new Error(message);
}

async function requestJson(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  return { status: res.status, ok: res.ok, payload };
}

async function requestAny(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, ok: res.ok, text };
}

async function ensureApiUp() {
  const root = API_BASE.replace(/\/api$/, "");
  const res = await fetch(root);
  if (!res.ok) fail(`API not reachable at ${root}. Status=${res.status}`);
}

async function loginAdmin() {
  const res = await requestJson("/auth/login", {
    method: "POST",
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!res.ok || !res.payload?.token) {
    fail(`Admin login failed. Status=${res.status} Message=${res.payload?.message || "n/a"}`);
  }
  return res.payload.token;
}

function pickDeclarationForPayment(declarations, payments) {
  const anyPaymentByDecl = new Set((payments || []).map((p) => p.declaration_id).filter(Boolean));
  return (declarations || []).find((d) => d?.declaration_id && !anyPaymentByDecl.has(d.declaration_id)) || null;
}

function expectStatus(step, got, expected) {
  if (got !== expected) {
    fail(`${step} failed: expected ${expected}, got ${got}`);
  }
}

async function ensureFixtureDeclaration() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(
    now.getHours()
  ).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  const decNo = `DEC-ET-${now.getFullYear()}-${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}`;
  const tin = `TIN-${stamp}-${Math.floor(Math.random() * 1000)}`;
  const shipRef = `SHP-${stamp}-${Math.floor(Math.random() * 1000)}`;

  const importer = await pool.query(
    `INSERT INTO importers (company_name, tin_number, contact_email, sector_type, created_at)
     VALUES ($1,$2,$3,$4,now())
     RETURNING importer_id`,
    ["Lifecycle QA Importer", tin, "qa-lifecycle@example.com", "General"]
  );
  const importerId = importer.rows[0].importer_id;

  const shipment = await pool.query(
    `INSERT INTO shipments
      (importer_id, shipment_reference, description_of_goods, hs_code, quantity, unit_of_measure, cif_value_usd,
       origin_country, destination_port, mode_of_transport, arrival_date, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
     RETURNING shipment_id`,
    [importerId, shipRef, "QA test goods", "847130", 10, "PCS", 1000, "CN", "Addis Ababa", "Air", now.toISOString().slice(0, 10)]
  );
  const shipmentId = shipment.rows[0].shipment_id;

  const declaration = await pool.query(
    `INSERT INTO declarations
      (shipment_id, declaration_no, declaration_date, customs_station, currency, tariff_rate, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,now())
     RETURNING declaration_id, declaration_no, tariff_rate`,
    [shipmentId, decNo, now.toISOString().slice(0, 10), "Addis", "ETB", 10, "Pending"]
  );
  return declaration.rows[0];
}

async function main() {
  try {
    console.log("payment-lifecycle: starting");
    await ensureApiUp();
    const token = await loginAdmin();

    const decRes = await requestJson("/declarations", { token });
    if (!decRes.ok || !Array.isArray(decRes.payload)) {
      fail(`Failed to list declarations. Status=${decRes.status}`);
    }
    const payRes = await requestJson("/payments", { token });
    if (!payRes.ok || !Array.isArray(payRes.payload)) {
      fail(`Failed to list payments. Status=${payRes.status}`);
    }

    let declaration = pickDeclarationForPayment(decRes.payload, payRes.payload);
    let fixtureCreated = false;
    if (!declaration) {
      declaration = await ensureFixtureDeclaration();
      fixtureCreated = true;
    }

    const usd = 1000;
    const rate = 57.35;
    const tariff = Number(declaration.tariff_rate || 10);
    const cif = usd * rate;
    const duty = (cif * tariff) / 100;
    const vat = (cif + duty) * 0.15;
    const excise = 0;
    const total = cif + duty + vat + excise;
    const r2 = (n) => Math.round(n * 100) / 100;

    const create = await requestJson("/payments", {
      method: "POST",
      token,
      body: {
        declaration_id: declaration.declaration_id,
        invoice_value_usd: r2(usd),
        exchange_rate: rate,
        cif_etb: r2(cif),
        duty_paid: r2(duty),
        vat_paid: r2(vat),
        excise_paid: r2(excise),
        total_payable: r2(total),
        payment_method: "Bank Transfer",
        payment_date: new Date().toISOString().slice(0, 10),
      },
    });
    expectStatus("create payment", create.status, 201);
    const paymentId = create.payload?.payment_id;
    if (!paymentId) fail("create payment response missing payment_id");

    const receiptBefore = await requestAny(`/payments/${paymentId}/receipt`, { token });
    expectStatus("receipt before paid", receiptBefore.status, 403);

    const clearancePayload = {
      declaration_id: declaration.declaration_id,
      release_date: new Date().toISOString().slice(0, 10),
      officer_name: "Lifecycle QA",
      customs_office: "Addis Ababa",
      delivery_note_no: `QA-${Date.now()}`,
      transport_company: "QA Logistics",
      truck_plate_no: "AA-99999",
      destination_address: "Addis Ababa",
    };
    const clearanceBefore = await requestJson("/clearances", {
      method: "POST",
      token,
      body: clearancePayload,
    });
    expectStatus("clearance before paid", clearanceBefore.status, 403);

    const verify = await requestJson(`/payments/${paymentId}/verify`, {
      method: "PUT",
      token,
      body: {},
    });
    expectStatus("verify", verify.status, 200);

    const approve = await requestJson(`/payments/${paymentId}/approve`, {
      method: "PUT",
      token,
      body: {},
    });
    expectStatus("approve", approve.status, 200);

    const approveAgain = await requestJson(`/payments/${paymentId}/approve`, {
      method: "PUT",
      token,
      body: {},
    });
    expectStatus("approve twice guard", approveAgain.status, 409);

    const receiptAfter = await requestAny(`/payments/${paymentId}/receipt`, { token });
    expectStatus("receipt after paid", receiptAfter.status, 200);

    const clearanceAfter = await requestJson("/clearances", {
      method: "POST",
      token,
      body: clearancePayload,
    });
    expectStatus("clearance after paid", clearanceAfter.status, 201);

    console.log(
      JSON.stringify(
        {
          ok: true,
          fixture_created: fixtureCreated,
          declaration_id: declaration.declaration_id,
          payment_id: paymentId,
          checks: {
            create: create.status,
            receipt_before_paid: receiptBefore.status,
            clearance_before_paid: clearanceBefore.status,
            verify: verify.status,
            approve: approve.status,
            approve_again: approveAgain.status,
            receipt_after_paid: receiptAfter.status,
            clearance_after_paid: clearanceAfter.status,
          },
        },
        null,
        2
      )
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("payment-lifecycle: FAILED");
  console.error(err.message || err);
  process.exit(1);
});
