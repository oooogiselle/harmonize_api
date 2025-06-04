import User from '../models/User.js';

// session-based authentication middleware (compatible with auth system)
export const authenticateUser = async (req, res, next) => {
  try {
    const userId = req.session?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

// Optional: Keep the Spotify token-based auth for specific use cases
export const authenticateSpotifyUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify Spotify token
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error('Invalid token');
    }

    const spotifyUser = await response.json();
    
    // Find user in database by Spotify ID
    const user = await User.findOne({ spotifyId: spotifyUser.id });
    if (!user) {
      return res.status(401).json({ error: 'User not found in database' });
    }

    req.user = user;
    req.spotifyUser = spotifyUser;
    next();
  } catch (err) {
    console.error('Spotify auth error:', err);
    return res.status(401).json({ error: 'Invalid token' });
  }
};