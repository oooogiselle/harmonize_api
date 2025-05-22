import dotenv   from 'dotenv';
import express  from 'express';
import mongoose from 'mongoose';
import cors     from 'cors';
import session  from 'cookie-session';

import authRoutes    from './routes/auth.js';
import spotifyRoutes from './routes/spotify.js';
import artistRoutes  from './routes/artists.js';
import eventRoutes   from './routes/events.js';
import meRoutes      from './routes/me.js'; // make sure this exists

dotenv.config();

const {
  PORT               = 8080,
  MONGO_URI,
  SESSION_SECRET     = 'default-secret',
  FRONTEND_BASE_URL  = 'http://localhost:5173',
} = process.env;

const app = express();

// ────────────────  Session middleware (with secure cookie config)  ────────────────
app.use(
  session({
    name: 'session',
    secret: SESSION_SECRET,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'none',    // ✅ allow cross-site
    secure: true,        // ✅ required when using 'none'
  })
);


// ────────────────  CORS config  ────────────────
app.use(
  cors({
    origin: [
      'http://127.0.0.1:5173',
      process.env.FRONTEND_BASE_URL,
    ],
    credentials: true,
  })
);


app.use(express.json());

// ────────────────  Routes  ────────────────
app.use('/',         authRoutes);
app.use('/spotify',  spotifyRoutes);
app.use('/artists',  artistRoutes);
app.use('/events',   eventRoutes);
app.use(meRoutes); // /api/me/spotify

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
