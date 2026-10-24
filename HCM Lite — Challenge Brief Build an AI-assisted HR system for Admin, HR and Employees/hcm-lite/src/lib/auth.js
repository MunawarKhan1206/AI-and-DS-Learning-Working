import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import { connectDB } from './db';
import User from '@/models/User';

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
 * Extracts and verifies the authenticated user from the Request
 * Supports Authorization header: Bearer <token> or Cookie: hcm_token=<token>
 */
export async function getAuthUser(req) {
  try {
    let token = null;

    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      const cookieHeader = req.headers.get('cookie');
      if (cookieHeader) {
        const cookies = Object.fromEntries(
          cookieHeader.split('; ').map((c) => c.split('='))
        );
        token = cookies['hcm_token'] || null;
      }
    }

    if (!token) return null;

    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return null;

    await connectDB();
    const user = await User.findById(decoded.userId).populate('employee_id');
    if (!user || !user.is_active) return null;

    return user;
  } catch (err) {
    if (err?.digest === 'NEXT_PRERENDER_INTERRUPTED' || err?.message?.includes('bail out of prerendering')) {
      throw err;
    }
    console.error('getAuthUser error:', err);
    return null;
  }
}

/**
 * Enforces role-based access control (RBAC).
 * If user is unauthorized, returns a NextResponse directly.
 * If authorized, returns { user }.
 */
export async function requireAuth(req, allowedRoles = []) {
  const user = await getAuthUser(req);

  if (!user) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      ),
      user: null,
    };
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return {
      errorResponse: NextResponse.json(
        {
          error: `Forbidden: Role '${user.role}' lacks permission for this action`,
        },
        { status: 403 }
      ),
      user: null,
    };
  }

  return { user, errorResponse: null };
}
