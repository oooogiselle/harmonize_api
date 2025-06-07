// controllers/geocode.js
import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

router.get('/reverse', async (req, res) => {
  const { lat, lon } = req.query;

  console.log('📍 [Geocode API] Called with:', req.query);
  console.log('🌐 Environment:', {
    NODE_ENV: process.env.NODE_ENV,
    SERVER_TIME: new Date().toISOString(),
  });

  // 1. Validate query params
  if (!lat || !lon || !isFinite(+lat) || !isFinite(+lon)) {
    console.error('❌ Invalid lat/lon:', lat, lon);
    return res.status(400).json({ error: 'Invalid latitude or longitude' });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
    console.log('🌍 [Geocode API] Fetching from:', url);

    const startTime = Date.now();

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'HarmonizeApp/1.0 (your@email.com)',
      },
    });

    const duration = Date.now() - startTime;
    console.log(`⏱️ Fetch took ${duration} ms`);

    // 2. Handle failed HTTP response
    if (!response.ok) {
      const text = await response.text();
      console.error('⚠️ [Geocode API] Non-OK response:', response.status);
      console.error('🪵 Response body:', text);
      return res
        .status(response.status)
        .json({ error: 'Failed to fetch geocoding data', details: text });
    }

    const data = await response.json();
    console.log('✅ [Geocode API] Nominatim response:', JSON.stringify(data, null, 2));

    const address = data?.address || {};
    const city =
      address.city ||
      address.town ||
      address.village ||
      address.hamlet ||
      address.county ||
      'Unknown';

    return res.json({ city });
  } catch (err) {
    console.error('❌ [Geocode Error]:', err);
    console.error('📄 Stack trace:', err.stack);

    return res.status(500).json({
      error: 'Failed to reverse geocode',
      details: err.message || 'Unknown error',
    });
  }
});

export default router;
