/* ───────── Imports ───────── */
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import session from 'cookie-session';

import tilesRoutes         from './routes/tiles.js';
import usersRoutes         from './routes/users.js';
import eventRoutes         from './routes/events.js';
import ticketmasterRoutes  from './routes/ticketmaster.js';
import geocodeRouter       from './routes/geocode.js';
import authRoutes          from './routes/auth.js';
import spotifyRoutes       from './routes/spotify.js';
import artistRoutes        from './routes/artists.js';
import meRoutes            from './routes/me.js';
import genreRoutes         from './routes/genres.js';
import searchRoutes        from './routes/search.js';
import musicPostsRoutes    from './routes/musicPosts.js';

const app = express();

/* ───────── Environment ───────── */
const {
  PORT = 8080,
  MONGO_URI,
  SESSION_SECRET,
  NODE_ENV = 'development',
  FRONTEND_URL,
} = process.env;

const FRONTEND     = FRONTEND_URL || 'https://project-music-and-memories-umzm.onrender.com';
const isProduction = NODE_ENV === 'production';

/* ───────── CORS ───────── */
const allowedOrigins = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174',
  'https://project-music-and-memories-umzm.onrender.com',
  FRONTEND,
];

const corsOptions = {
  origin: function (origin, callback) {
    console.log('🔍 CORS Check - Incoming origin:', origin);
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || !isProduction) {
      console.log('✅ CORS - Origin allowed:', origin);
      callback(null, true);
    } else {
      console.log('❌ CORS - Origin blocked:', origin);
      console.log('📋 CORS - Allowed origins:', allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Cookie',
    'X-Requested-With',
    'Accept',
    'Origin',
  ],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 200,
  preflightContinue: false,
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

/* ───────── Session cookie ───────── */
app.set('trust proxy', 1); // Secure cookies on Render
app.use(
  session({
    name:      'harmonize-session',
    secret:    SESSION_SECRET,
    maxAge:    7 * 24 * 60 * 60 * 1000,
    sameSite:  isProduction ? 'none' : 'lax',
    secure:    isProduction,
    httpOnly:  true,
    signed:    true,
  })
);

/* ───────── Body parsers ───────── */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/* ───────── Debug Logging ───────── */
if (!isProduction) {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    console.log('Origin:', req.get('Origin'));
    console.log('Session ID:', req.session?.userId || 'none');
    console.log('Cookies:', req.headers.cookie ? 'present' : 'none');
    next();
  });
}

/* ───────── Health Check ───────── */
app.get('/health', (req, res) => {
  res.json({
    status:      'ok',
    timestamp:   new Date().toISOString(),
    environment: NODE_ENV,
    session:     req.session?.userId ? 'active' : 'none',
  });
});

/* ───────── Routes ───────── */
app.use('/auth',              authRoutes);
app.use('/spotify',           spotifyRoutes);
app.use('/api/ticketmaster',  ticketmasterRoutes);
app.use('/artists',           artistRoutes);
app.use('/events',            eventRoutes);
app.use('/',                  genreRoutes);
app.use('/',                  meRoutes);
app.use('/api/geocode',       geocodeRouter);
app.use('/api/tiles',         tilesRoutes);
app.use('/api/search',        searchRoutes);
app.use('/api/musicPosts',    musicPostsRoutes);
app.use('/api/users',         usersRoutes);

// Special case: nested user tiles
app.use('/api/users/:userId/tiles', (req, res, next) => {
  req.url = `/user/${req.params.userId}`;
  tilesRoutes(req, res, next);
});

/* ───────── 404 Not Found ───────── */
app.use('*', (req, res) =>
  res.status(404).json({ error: 'Route not found', path: req.originalUrl })
);

/* ───────── Error Handler ───────── */
app.use((err, req, res, _next) => {
  console.error(err);
  if (err.message?.includes('CORS')) {
    return res.status(403).json({ error: 'CORS', message: err.message });
  }
  res.status(500).json({
    error: 'Internal server error',
    ...(isProduction ? {} : { details: err.message }),
  });
});

/* ───────── DB & Server Startup ───────── */
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

/* ───────── Graceful Shutdown ───────── */
['SIGTERM', 'SIGINT'].forEach((sig) =>
  process.on(sig, () => {
    console.log(`${sig} received, shutting down`);
    mongoose.connection.close(() => process.exit(0));
  })
);
