import express from 'express';
import cors from 'cors';
import { connectDB } from './db.js';

import usersRouter   from './routes/users.js';
import artistsRouter from './routes/artists.js';
import tracksRouter  from './routes/tracks.js';
import eventsRouter  from './routes/events.js';
import blendRouter   from './routes/blend.js';
import spotifyRouter from './routes/spotify.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/users',   usersRouter);
app.use('/artists', artistsRouter);
app.use('/tracks',  tracksRouter);
app.use('/events',  eventsRouter);
app.use('/blend',   blendRouter);
app.use('/spotify', spotifyRouter);

app.get('/', (_req,res) => res.send('Hello World'));

const PORT = process.env.PORT || 8080;
connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
