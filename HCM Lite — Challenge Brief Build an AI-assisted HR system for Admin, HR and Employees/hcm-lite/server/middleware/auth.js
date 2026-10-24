import jwt from 'jsonwebtoken';
import User from '../../src/models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-hcm-lite-min32chars';

export function signToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Express middleware to extract authenticated user from Bearer header or cookie
 */
export async function authenticateUser(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.hcm_token) {
      token = req.cookies.hcm_token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }

    const user = await User.findById(decoded.userId).populate('employee_id');
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Unauthorized: Account deactivated or missing' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Authentication internal error', details: err.message });
  }
}

/**
 * Express middleware to enforce allowed roles
 */
export function requireRoles(roles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Role '${req.user.role}' lacks permission for this action`,
      });
    }

    next();
  };
}
