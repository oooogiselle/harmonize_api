/* ───────── Imports ───────── */
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import session from 'cookie-session';

import tilesRoutes       from './routes/tiles.js';
import friendsRoutes     from './routes/friends.js';
import usersRoutes       from './routes/users.js';
import eventRoutes       from './routes/events.js';
import ticketmasterRoutes from './routes/ticketmaster.js';
import geocodeRouter     from './routes/geocode.js';
import authRoutes        from './routes/auth.js';
import spotifyRoutes     from './routes/spotify.js';
import artistRoutes      from './routes/artists.js';
import meRoutes          from './routes/me.js';
import genreRoutes       from './routes/genres.js';

dotenv.config();

/* ───────── Environment ───────── */
const {
  PORT            = 8080,
  MONGO_URI,
  SESSION_SECRET,
  NODE_ENV        = 'development',
  FRONTEND_URL,                                 // set in Render
} = process.env;

const FRONTEND = FRONTEND_URL || 'https://project-music-and-memories-umzm.onrender.com';
const isProduction = NODE_ENV === 'production';

/* ───────── App init ───────── */
const app = express();
app.set('trust proxy', 1);   // => secure cookies on Render

/* ───────── CORS ───────── */
app.use(
  cors({
    origin: (origin, cb) => {
      // server-to-server or curl
      if (!origin) return cb(null, true);

      // dev whitelist
      const dev =
        origin.startsWith('http://localhost') ||
        origin.startsWith('http://127.0.0.1');

      if (origin === FRONTEND || (!isProduction && dev)) return cb(null, true);

      console.log('[CORS] Blocked:', origin);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

// explicit pre-flight for all routes
app.options('*', cors());

/* ───────── Session cookie ───────── */
app.use(
  session({
    name: 'harmonize-session',
    secret: SESSION_SECRET,
    maxAge: 7 * 24 * 60 * 60 * 1000,       // 7 days
    sameSite: isProduction ? 'none' : 'lax',
    secure:   isProduction,
    httpOnly: true,
    signed:   true,
  })
);

/* ───────── Body parsers ───────── */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/* ───────── Health check ───────── */
app.get('/health', (req, res) => {
  res.json({
    status:       'ok',
    timestamp:    new Date().toISOString(),
    environment:  NODE_ENV,
    session:      req.session?.userId ? 'active' : 'none',
  });
});

/* ───────── Routes ───────── */
app.use('/auth',              authRoutes);
app.use('/spotify',           spotifyRoutes);
app.use('/api/ticketmaster',  ticketmasterRoutes);
app.use('/artists',           artistRoutes);
app.use('/events',            eventRoutes);
app.use('/',                  genreRoutes);   // placed before /me
app.use('/',                  meRoutes);
app.use('/api/geocode',       geocodeRouter);
app.use('/api/tiles',         tilesRoutes);
app.use('/api/friends',       friendsRoutes);
app.use('/api/users',         usersRoutes);

/* ───────── 404 ───────── */
app.use('*', (req, res) =>
  res.status(404).json({ error: 'Route not found', path: req.originalUrl })
);

/* ───────── Error handler ───────── */
app.use((err, req, res, _next) => {
  console.error(err);
  if (err.message?.includes('CORS'))
    return res.status(403).json({ error: 'CORS', message: err.message });

  res.status(500).json({
    error: 'Internal server error',
    ...(isProduction ? {} : { details: err.message }),
  });
});

/* ───────── DB & server ───────── */
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('✓ MongoDB connected'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

app.listen(PORT, () => {
  console.log(`🚀  API listening on ${PORT}`);
  console.log(`🌐  CORS origin: ${FRONTEND}`);
});

/* ───────── Graceful shutdown ───────── */
['SIGTERM', 'SIGINT'].forEach((sig) =>
  process.on(sig, () => {
    console.log(`${sig} received, shutting down`);
    mongoose.connection.close(() => process.exit(0));
  })
);
