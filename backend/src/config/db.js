import pkg from "pg";
import { env } from "./env.js";

const { Pool } = pkg;

const poolConfig = env.db.connectionString
  ? { connectionString: env.db.connectionString }
  : {
      host: env.db.host,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
      port: env.db.port,
    };

if (env.db.ssl) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

export const pool = new Pool(poolConfig);

pool.on("connect", () => {
  console.log("Connected to PostgreSQL", {
    host: env.db.connectionString ? "DATABASE_URL" : env.db.host,
    database: env.db.connectionString ? "DATABASE_URL" : env.db.database,
    user: env.db.connectionString ? "DATABASE_URL" : env.db.user,
    port: env.db.connectionString ? "DATABASE_URL" : env.db.port,
    ssl: env.db.ssl,
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
      env.db.connectionString
        ? `Cannot connect to PostgreSQL (DATABASE_URL ssl=${env.db.ssl}):`
        : `Cannot connect to PostgreSQL (host=${env.db.host} db=${env.db.database} user=${env.db.user} port=${env.db.port}):`,
      err.message
    );
  }
})();
