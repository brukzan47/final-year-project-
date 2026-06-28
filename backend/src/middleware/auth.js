import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { pool } from "../config/db.js";

export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) return res.status(401).json({ message: "No token provided" });

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Invalid token format" });

    const user = jwt.verify(token, env.jwtSecret);
    req.user = user; // user: { id, role, name }

    const mustChangeRes = await pool.query(
      "SELECT must_change_password FROM users WHERE user_id=$1 LIMIT 1",
      [user.id]
    );
    const mustChange = !!mustChangeRes.rows?.[0]?.must_change_password;
    const isPasswordChangeRoute = req.baseUrl === "/api/auth" && req.path === "/password" && req.method === "PUT";

    if (mustChange && !isPasswordChangeRoute) {
      return res.status(403).json({
        message: "Password change required before accessing this resource.",
        must_change_password: true,
      });
    }

    next();
  } catch (err) {
    console.error("Auth middleware error:", err.message);
    res.status(403).json({ message: "Token expired or invalid" });
  }
};
