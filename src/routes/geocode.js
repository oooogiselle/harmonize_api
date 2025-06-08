// controllers/geocode.js
import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

const OC_API_KEY = process.env.OPENCAGE_KEY;

router.get('/reverse', async (req, res) => {
  const { lat, lon } = req.query;

  console.log('📍 [Geocode API] Called with:', req.query);

  if (!lat || !lon || !isFinite(+lat) || !isFinite(+lon)) {
    console.error('Invalid lat/lon:', lat, lon);
    return res.status(400).json({ error: 'Invalid latitude or longitude' });
  }

  if (!OC_API_KEY) {
    console.error('Missing OPENCAGE_KEY in environment');
    return res.status(500).json({ error: 'Missing API key for OpenCage' });
  }

  try {
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${OC_API_KEY}`;
    console.log('[Geocode API] Fetching from:', url);

    const start = Date.now();
    const response = await fetch(url);
    const duration = Date.now() - start;
    console.log(`Fetch took ${duration}ms`);

    if (!response.ok) {
      const text = await response.text();
      console.error('[OpenCage API] Non-OK response:', response.status);
      console.error('Response body:', text);
      return res.status(response.status).json({
        error: 'Failed to fetch geocoding data',
        details: text,
      });
    }

    const data = await response.json();
    console.log('[Geocode API] Response:', JSON.stringify(data, null, 2));

    const components = data?.results?.[0]?.components || {};
    const city =
      components.city ||
      components.town ||
      components.village ||
      components.hamlet ||
      components.county ||
      'Unknown';

    res.json({ city });
  } catch (err) {
    console.error('[Geocode Error]:', err);
    res.status(500).json({
      error: 'Failed to reverse geocode',
      details: err.message || 'Unknown error',
    });
  }
});

export default router;
