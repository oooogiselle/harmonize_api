// server/routes/ticketmaster.js
import express from 'express';
import axios from 'axios';

const router = express.Router();
const TICKETMASTER_API_KEY = process.env.TICKETMASTER_API_KEY;

router.get('/events', async (req, res) => {
  const { lat, lng, radius = 25 } = req.query;

  try {
    const response = await axios.get('https://app.ticketmaster.com/discovery/v2/events.json', {
      params: {
        apikey: TICKETMASTER_API_KEY,
        latlong: `${lat},${lng}`,
        radius,
        unit: 'miles',
        classificationName: 'music',
        countryCode: 'US',
      },
    });

    const events = response.data._embedded?.events || [];
    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error.message);
    res.status(500).json({ error: 'Failed to fetch events from Ticketmaster' });
  }
});

export default router;
