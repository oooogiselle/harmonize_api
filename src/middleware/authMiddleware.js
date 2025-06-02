import axios from 'axios';

export const authenticateSpotifyUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Spotify endpoint to get user info
    const response = await axios.get('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    req.user = response.data; // includes id, display_name, email, etc.
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};