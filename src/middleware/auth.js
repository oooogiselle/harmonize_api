// middleware/auth.js
export const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.userId) {
      console.log('[AUTH] No session found, rejecting request');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    console.log('[AUTH] Session found for user:', req.session.userId);
    next();
  };
  
  export const optionalAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
      console.log('[AUTH] Optional auth - user logged in:', req.session.userId);
    } else {
      console.log('[AUTH] Optional auth - no user session');
    }
    next();
  };