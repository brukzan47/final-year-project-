import { pool } from "../src/config/db.js";
import { Importer } from "../src/models/Importer.js";
import { Shipment } from "../src/models/Shipment.js";
import { Declaration } from "../src/models/Declaration.js";
import { Tracking } from "../src/models/Tracking.js";
import { TrackingPoint } from "../src/models/TrackingPoint.js";
import { GpsDevice } from "../src/models/GpsDevice.js";

async function ensureTables() {
  await Importer.createTable();
  await Shipment.createTable();
  await Declaration.createTable();
  await Tracking.createTable();
  await TrackingPoint.createTable();
  await GpsDevice.createTable();
}

async function upsertImporter() {
  const tin = "TIN-DEMO-0001";
  const q = await pool.query("SELECT * FROM importers WHERE tin_number=$1 LIMIT 1", [tin]);
  if (q.rowCount) return q.rows[0];
  return await Importer.create({
    company_name: "Demo Importers PLC",
    tin_number: tin,
    customs_registration_no: "CRN-DEMO-001",
    contact_person: "Alemu Kebede",
    contact_title: "Manager",
    contact_phone: "+251911000000",
    contact_email: "demo@importers.local",
    import_license_no: "LIC-DEMO-001",
    sector_type: "Electronics",
    address: "Addis Ababa",
  });
}

async function upsertShipment(importer) {
  // Try by reference
  const ref = "SHP-DEMO-TRACK-001";
  const s = await pool.query("SELECT * FROM shipments WHERE shipment_reference=$1 LIMIT 1", [ref]);
  if (s.rowCount) return s.rows[0];
  const today = new Date();
  return await Shipment.create({
    importer_id: importer.importer_id,
    shipment_reference: ref,
    tracking_ref: "MSCU1234567",
    description_of_goods: "Mobile phones and accessories for demo tracking",
    goods_type: "Electronics",
    hs_code: "8517.12",
    quantity: 1000,
    unit_of_measure: "pcs",
    cif_value_usd: 250000,
    origin_country: "Djibouti",
    destination_port: "Modjo Dry Port",
    mode_of_transport: "Road",
    arrival_date: new Date(today.getTime() + 3 * 24 * 3600 * 1000),
  });
}

async function upsertDeclaration(shipment) {
  const q = await pool.query("SELECT * FROM declarations WHERE shipment_id=$1 LIMIT 1", [shipment.shipment_id]);
  if (q.rowCount) return q.rows[0];
  const y = new Date().getFullYear();
  const decNo = `DEC-ET-${y}-90001`;
  return await Declaration.create({
    shipment_id: shipment.shipment_id,
    declaration_no: decNo,
    declaration_date: new Date(),
    declarant_agent: "Demo Agent",
    customs_station: "Addis Ababa",
    valuation_basis: "CIF",
    currency: "USD",
    tariff_rate: 10,
    duties_etb: 0,
    payment_receipt_no: null,
  });
}

async function upsertDevice(shipment) {
  const deviceId = "DEV-DEMO-001";
  const d = await GpsDevice.register({
    device_id: deviceId,
    shipment_id: shipment.shipment_id,
    container_no: "MSCU1234567",
    transport_company: "Demo Logistics",
    driver_name: "Bekele",
    driver_phone: "+251922000000",
    active: true,
  });
  return d;
}

async function seedTrack(shipment) {
  // Waypoints: Djibouti Port -> Dire Dawa -> Modjo Dry Port
  const points = [
    { lat: 11.600000, lon: 43.150000, speed: 0, heading: 0, hoursAgo: 30 },
    { lat: 9.596000, lon: 41.866000, speed: 45, heading: 260, hoursAgo: 20 },
    { lat: 8.586000, lon: 39.125000, speed: 10, heading: 180, hoursAgo: 1 },
  ];
  // Upsert tracking current
  const last = points[points.length - 1];
  await Tracking.upsert(shipment.shipment_id, {
    lat: last.lat,
    lon: last.lon,
    speed: last.speed,
    heading: last.heading,
    vessel_name: null,
    last_seen: new Date(),
    eta_delivery: new Date(new Date().getTime() + 12 * 3600 * 1000),
    customs_status: "In Transit",
    clearance_progress: 0,
    extra: { demo: true },
  });
  // Insert trail
  const now = Date.now();
  for (const p of points) {
    const seenAt = new Date(now - (p.hoursAgo || 0) * 3600 * 1000);
    await TrackingPoint.insert({
      shipment_id: shipment.shipment_id,
      lat: p.lat,
      lon: p.lon,
      speed: p.speed,
      heading: p.heading,
      predicted: false,
      seen_at: seenAt,
    });
  }
}

async function main() {
  try {
    await ensureTables();
    const importer = await upsertImporter();
    const shipment = await upsertShipment(importer);
    const declaration = await upsertDeclaration(shipment);
    await upsertDevice(shipment);
    await seedTrack(shipment);
    console.log("Demo data ready:");
    console.log("  Importer:", importer.company_name, importer.importer_id);
    console.log("  Shipment:", shipment.shipment_reference, shipment.shipment_id);
    console.log("  Declaration:", declaration.declaration_no, declaration.declaration_id);
    console.log("  Device:", "DEV-DEMO-001");
    process.exit(0);
  } catch (e) {
    console.error("Seed failed:", e);
    process.exit(1);
  }
}

main();

