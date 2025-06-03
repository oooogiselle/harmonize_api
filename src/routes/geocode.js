// controllers/geocode.js
import express from 'express';
import fetch from 'node-fetch';


const router = express.Router();

router.get('/reverse', async (req, res) => {
  console.log('[Geocode API] Called with', req.query); 
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: 'Latitude and longitude are required' });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Harmonize/1.0 (giselle.siqi.wu@gmail.com)'
      }
    });

    const data = await response.json();
    console.log('[Nominatim Data]', JSON.stringify(data, null, 2));
    const address = data.address;

    const city =
      address.city ||
      address.town ||
      address.village ||
      address.hamlet ||
      address.county ||
      'Unknown';

    res.json({ city });
  } catch (err) {
    console.error('[Geocode Error]', err);
    res.status(500).json({ error: 'Failed to reverse geocode' });
  }
});

export default router;
