import { pool } from "../config/db.js";

export const Role = {
  async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS roles (
        role_id SERIAL PRIMARY KEY,
        role_name VARCHAR(50) UNIQUE NOT NULL
      );
    `;
    await pool.query(query);
  },

  async seedDefaults() {
    const roles = [
      "Super Admin",
      "Admin",
      "Customs Officer",
      "Inspector",
      "Clearance Officer",
      "Document Officer",
      "Risk Analyst",
      "Port Officer",
      "Finance Officer",
      "Auditor",
      "Importer",
    ];
    for (const role of roles) {
      await pool.query(
        "INSERT INTO roles (role_name) VALUES ($1) ON CONFLICT (role_name) DO NOTHING;",
        [role]
      );
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const oldRole = await client.query(
        "SELECT role_id FROM roles WHERE role_name='Economic Operator' LIMIT 1"
      );
      const importerRole = await client.query(
        "SELECT role_id FROM roles WHERE role_name='Importer' LIMIT 1"
      );
      if (oldRole.rowCount && importerRole.rowCount) {
        const oldRoleId = oldRole.rows[0].role_id;
        const importerRoleId = importerRole.rows[0].role_id;
        await client.query("UPDATE users SET role_id=$2 WHERE role_id=$1", [oldRoleId, importerRoleId]);
        await client.query("UPDATE user_role_audit SET old_role_id=$2 WHERE old_role_id=$1", [oldRoleId, importerRoleId]);
        await client.query("UPDATE user_role_audit SET new_role_id=$2 WHERE new_role_id=$1", [oldRoleId, importerRoleId]);
        await client.query("DELETE FROM roles WHERE role_id=$1", [oldRoleId]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async getAll() {
    const result = await pool.query("SELECT * FROM roles ORDER BY role_id ASC;");
    return result.rows;
  },
};
