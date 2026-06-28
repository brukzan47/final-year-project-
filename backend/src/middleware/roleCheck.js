import { normalizeRoleName } from "../utils/roles.js";
import { hasPermission, rolesForPermission } from "../utils/permissions.js";

export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized: No user context" });
      }

      const roleRaw = String(req.user.role || "").trim();
      const role = normalizeRoleName(roleRaw);
      if (!role) {
        return res.status(403).json({
          message: "Access denied: account role is missing. Contact system administrator.",
        });
      }

      if (role === "super admin") {
        return next();
      }

      const allowed = new Set((allowedRoles || []).map(normalizeRoleName));
      if (!allowed.has(role)) {
        return res.status(403).json({ message: `Access denied: ${roleRaw || req.user.role} not allowed` });
      }

      next();
    } catch {
      res.status(500).json({ message: "Role validation failed" });
    }
  };
};

export const authorizePermission = (permission) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized: No user context" });
      }

      if (!hasPermission(req.user.role, permission)) {
        return res.status(403).json({
          message: `Access denied: ${req.user.role || "Unknown role"} lacks ${permission}`,
          allowed_roles: rolesForPermission(permission),
        });
      }

      return next();
    } catch {
      return res.status(500).json({ message: "Permission validation failed" });
    }
  };
};
