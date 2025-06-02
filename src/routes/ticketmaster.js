// server/routes/ticketmaster.js
import express from 'express';
import axios from 'axios';
import geohash from 'ngeohash';

const router = express.Router();
const TICKETMASTER_API_KEY = process.env.TICKETMASTER_API_KEY;

router.get('/events', async (req, res) => {
  const { lat, lng, radius = 25 } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat/lng required' });

  try {
    const geoPoint = geohash.encode(parseFloat(lat), parseFloat(lng));
    const response = await axios.get('https://app.ticketmaster.com/discovery/v2/events.json', {
      params: {
        apikey: TICKETMASTER_API_KEY,
        geoPoint,
        radius,
        unit: 'miles',
        classificationName: 'music',
        countryCode: 'US',
      },
    });

    const events = response.data._embedded?.events || [];

    const cleaned = events
      .filter(e => e.classifications?.[0]?.genre?.name && e._embedded?.venues?.[0]?.location)
      .map((event) => ({
        _id: event.id,
        title: event.name,
        location: {
          type: 'Point',
          coordinates: [
            parseFloat(event._embedded.venues[0].location.longitude),
            parseFloat(event._embedded.venues[0].location.latitude),
          ],
        },
        date: event.dates.start.dateTime,
        genre: event.classifications[0].genre.name,
        genreKey: event.classifications[0].genre.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
        description: event.info || '',
        ticketUrl: event.url || '',
        image: event.images?.[0]?.url || '',
      }));

    res.json(cleaned);
  } catch (error) {
    console.error('Ticketmaster API Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch events from Ticketmaster' });
  }
});

export default router;
