import "dotenv/config";
import fs from "fs";
import path from "path";
import { pool } from "../src/config/db.js";

async function main() {
  const rawPath = process.argv[2];
  if (!rawPath) {
    throw new Error("Usage: node scripts/apply-migration.js <sql-file-path>");
  }
  const sqlPath = path.resolve(process.cwd(), rawPath);
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`SQL file not found: ${sqlPath}`);
  }
  const sql = fs.readFileSync(sqlPath, "utf8");
  await pool.query(sql);
  console.log(`migration applied: ${sqlPath}`);
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("migration apply failed:", err.message || err);
    try {
      await pool.end();
    } catch {}
    process.exit(1);
  });
