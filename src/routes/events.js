import express from 'express';
import axios from 'axios';

const router = express.Router();

const API_KEY = process.env.TICKETMASTER_API_KEY;
const BASE_URL = 'https://app.ticketmaster.com/discovery/v2/events.json';

router.get('/events', async (req, res) => {
  const { lat, lng, keyword = '', radius = 25 } = req.query;

  try {
    const response = await axios.get(BASE_URL, {
      params: {
        apikey: API_KEY,
        latlong: `${lat},${lng}`,
        keyword,
        radius,
        unit: 'miles',
        classificationName: 'music',
        size: 50,
      },
    });

    const events = response.data._embedded?.events.map((event) => ({
      id: event.id,
      name: event.name,
      date: event.dates.start.localDate,
      time: event.dates.start.localTime,
      venue: event._embedded.venues[0].name,
      location: {
        lat: parseFloat(event._embedded.venues[0].location.latitude),
        lng: parseFloat(event._embedded.venues[0].location.longitude),
      },
      image:
        event.images.find((img) => img.width > 300)?.url ||
        '/default-event.jpg',
    })) || [];

    res.json(events);
  } catch (err) {
    console.error('Ticketmaster API error:', err.message);
    res.status(500).json({ error: 'Unable to fetch events' });
  }
});

export default router;
