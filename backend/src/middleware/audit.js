import { pool } from '../config/db.js';

export async function auditLog(req, res, next) {
  const method = req.method.toUpperCase();
  const mutating = ['POST','PUT','PATCH','DELETE'];
  if (!mutating.includes(method)) return next();

  const origJson = res.json.bind(res);
  res.json = async function (body) {
    try {
      const userId = req.user ? req.user.id : null;
      const ip = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null;
      const ua = req.headers['user-agent'] || null;

      // Determine resource id from controller or response body
      let resourceId = res.locals && (res.locals.resourceId || res.locals.resource_id) || null;
      if (!resourceId && body) {
        resourceId = body.id || body.importer_id || body.user_id || body.payment_reference || null;
      }

      const details = {
        path: req.originalUrl || req.url,
        method,
        body: req.body,
        response: body,
        statusCode: res.statusCode
      };

      await pool.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [userId, `${method} ${req.baseUrl || ''} ${req.path}`, req.baseUrl || null, resourceId, details, ip, ua]
      );
    } catch (e) {
      console.error('Audit log error', e.message);
    }
    return origJson(body);
  };
  next();
}
