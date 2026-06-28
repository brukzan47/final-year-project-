import { pool } from "../config/db.js";
import { logger } from "./logger.js";

export async function createUniqueIndexIfClean(indexName, createSql) {
  try {
    await pool.query(createSql);
    return true;
  } catch (error) {
    if (error?.code !== "23505") throw error;
    logger.warn(`Skipped unique index ${indexName}: existing duplicate data must be resolved first`);
    return false;
  }
}
