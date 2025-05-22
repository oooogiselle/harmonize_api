
import dotenv   from 'dotenv';
import express  from 'express';
import mongoose from 'mongoose';
import cors     from 'cors';
import session  from 'cookie-session';

import authRoutes    from './routes/auth.js';
import spotifyRoutes from './routes/spotify.js';
import artistRoutes  from './routes/artists.js';
import eventRoutes   from './routes/events.js';

dotenv.config();

const {
  PORT               = 8080,
  MONGO_URI,
  SESSION_SECRET     = 'default-secret',
  FRONTEND_BASE_URL  = 'http://localhost:5173',
} = process.env;

const app = express();

// ────────────────  middleware  ────────────────
app.use(
  session({
    name:    'session',
    secret:  SESSION_SECRET,
    maxAge:  24 * 60 * 60 * 1000,   // 24 h
    sameSite:'lax',
  }),
);

app.use(
  cors({
    origin: [
      'http://127.0.0.1:5173',   // local dev
      FRONTEND_BASE_URL,         // deployed FE
    ],
    credentials: true,
  }),
);

app.use(express.json());

// ────────────────  routes  ────────────────
app.use('/',         authRoutes);
app.use('/spotify',  spotifyRoutes);
app.use('/artists',  artistRoutes);
app.use('/events',   eventRoutes);
// …etc.

// ────────────────  DB + start  ────────────────
mongoose.connect(MONGO_URI)
  .then(() => console.log('✓ MongoDB connected'))
  .catch((err) => {
    console.error('MongoDB connection error', err);
    process.exit(1);
  });

app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`),
);
