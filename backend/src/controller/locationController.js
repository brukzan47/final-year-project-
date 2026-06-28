import { pool } from "../config/db.js";

export const LocationController = {
  async list(_req, res) {
    try {
      const r = await pool.query(`SELECT name, type, lat, lon FROM locations ORDER BY name ASC`);
      return res.json(r.rows || []);
    } catch (e) {
      return res.status(500).json({ message: e.message });
    }
  },
  async create(req, res) {
    try {
      const { name, type, lat, lon } = req.body || {};
      if (!name) return res.status(400).json({ message: 'name is required' });
      const t = (type || null);
      const la = lat == null ? null : Number(lat);
      const lo = lon == null ? null : Number(lon);
      if (!isFinite(la) || !isFinite(lo)) return res.status(400).json({ message: 'lat/lon must be numbers' });
      await pool.query(
        `INSERT INTO locations(name, type, lat, lon) VALUES($1,$2,$3,$4)
         ON CONFLICT (name) DO UPDATE SET type=EXCLUDED.type, lat=EXCLUDED.lat, lon=EXCLUDED.lon`,
        [String(name), t, la, lo]
      );
      const r = await pool.query(`SELECT name, type, lat, lon FROM locations WHERE name=$1`, [String(name)]);
      return res.status(201).json(r.rows?.[0] || null);
    } catch (e) {
      return res.status(500).json({ message: e.message });
    }
  },
  async update(req, res) {
    try {
      const name = req.params?.name;
      if (!name) return res.status(400).json({ message: 'name param is required' });
      const { new_name, type, lat, lon } = req.body || {};
      const sets = [];
      const vals = [];
      if (new_name != null && String(new_name) !== String(name)) { sets.push(`name=$${sets.length+1}`); vals.push(String(new_name)); }
      if (type !== undefined) { sets.push(`type=$${sets.length+1}`); vals.push(type || null); }
      if (lat !== undefined) { const la = lat==null?null:Number(lat); if (la!=null && !isFinite(la)) return res.status(400).json({ message:'lat must be number' }); sets.push(`lat=$${sets.length+1}`); vals.push(la); }
      if (lon !== undefined) { const lo = lon==null?null:Number(lon); if (lo!=null && !isFinite(lo)) return res.status(400).json({ message:'lon must be number' }); sets.push(`lon=$${sets.length+1}`); vals.push(lo); }
      if (sets.length === 0) return res.status(400).json({ message: 'no fields to update' });
      vals.push(String(name));
      const q = `UPDATE locations SET ${sets.join(', ')} WHERE name=$${vals.length} RETURNING name, type, lat, lon`;
      const r = await pool.query(q, vals);
      if (r.rowCount === 0) return res.status(404).json({ message: 'Location not found' });
      return res.json(r.rows[0]);
    } catch (e) {
      return res.status(500).json({ message: e.message });
    }
  },
  async remove(req, res) {
    try {
      const name = req.params?.name;
      if (!name) return res.status(400).json({ message: 'name param is required' });
      const r = await pool.query(`DELETE FROM locations WHERE name=$1`, [String(name)]);
      if (r.rowCount === 0) return res.status(404).json({ message: 'Location not found' });
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ message: e.message });
    }
  },
  async exportCsv(_req, res) {
    try {
      const r = await pool.query(`SELECT name, COALESCE(type,'') AS type, lat, lon FROM locations ORDER BY name ASC`);
      const rows = r.rows || [];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="locations.csv"');
      res.write('name,type,lat,lon\n');
      for (const row of rows) {
        const vals = [row.name, row.type || '', row.lat, row.lon].map(v => JSON.stringify(v ?? ''));
        res.write(vals.join(',') + "\n");
      }
      return res.end();
    } catch (e) {
      return res.status(500).json({ message: e.message });
    }
  },
  async importCsv(req, res) {
    try {
      const csv = (req.body?.csv || '').toString();
      if (!csv.trim()) return res.status(400).json({ message: 'csv is required' });
      const lines = csv.split(/\r?\n/).filter(Boolean);
      let start = 0;
      const header = (lines[0] || '').toLowerCase();
      if (/name\s*,\s*type\s*,\s*lat\s*,\s*lon/.test(header)) start = 1;
      let ok = 0, fail = 0;
      const results = [];
      for (let i = start; i < lines.length; i++) {
        const line = lines[i];
        try {
          const parts = [];
          // simple CSV split honoring quoted fields
          let cur = '', inQ = false;
          for (let j = 0; j < line.length; j++) {
            const ch = line[j];
            if (ch === '"') { inQ = !inQ; continue; }
            if (ch === ',' && !inQ) { parts.push(cur); cur = ''; continue; }
            cur += ch;
          }
          parts.push(cur);
          const [name, type, lat, lon] = parts.map(s => String(s || '').trim());
          if (!name) throw new Error('name missing');
          const la = Number(lat), lo = Number(lon);
          if (!isFinite(la) || !isFinite(lo)) throw new Error('lat/lon invalid');
          await pool.query(
            `INSERT INTO locations(name, type, lat, lon) VALUES($1,$2,$3,$4)
             ON CONFLICT (name) DO UPDATE SET type=EXCLUDED.type, lat=EXCLUDED.lat, lon=EXCLUDED.lon`,
            [name, type || null, la, lo]
          );
          ok++; results.push({ name, status: 'ok' });
        } catch (e) {
          fail++; results.push({ line: i+1, status: 'error', reason: e.message });
        }
      }
      return res.json({ summary: { ok, fail, total: ok+fail }, results: results.slice(0, 200) });
    } catch (e) {
      return res.status(500).json({ message: e.message });
    }
  },
};
