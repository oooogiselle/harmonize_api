// src/routes/auth.js
import express from 'express';
import axios from 'axios';

const router = express.Router();

router.get('/spotify/callback', async (req, res) => {
  const code = req.query.code;

  if (!code) return res.status(400).send('No code provided');

  try {
    const tokenRes = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'https://project-music-and-memories-api.onrender.com/api/auth/spotify/callback',
        client_id: process.env.SPOTIFY_CLIENT_ID,
        client_secret: process.env.SPOTIFY_CLIENT_SECRET,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenRes.data;

    // Store tokens in your database or session for future use
    // For now, return them as JSON
    res.json({ access_token, refresh_token, expires_in });

  } catch (err) {
    console.error('Token exchange error:', err.response?.data || err.message);
    res.status(500).send('Failed to exchange token');
  }
});

export default router;
