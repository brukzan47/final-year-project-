import pkg from "pg";
import { env } from "./env.js";

const { Pool } = pkg;

export const pool = new Pool({
  host: env.db.host,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  port: env.db.port,
});

pool.on("connect", () => {
  console.log("Connected to PostgreSQL", {
    host: env.db.host,
    database: env.db.database,
    user: env.db.user,
    port: env.db.port,
  });
});

pool.on("error", (err) => {
  console.error("PostgreSQL pool error:", err.message);
});

(async function initDb() {
  try {
    await pool.query("SELECT 1");
    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    } catch (e) {
      if (!/permission denied/i.test(e.message)) {
        console.warn("UUID extension warning:", e.message);
      }
    }
  } catch (err) {
    console.error(
      `Cannot connect to PostgreSQL (host=${env.db.host} db=${env.db.database} user=${env.db.user} port=${env.db.port}):`,
      err.message
    );
  }
})();

