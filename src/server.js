import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import session from 'cookie-session';
import tilesRoutes from './routes/tiles.js';
import friendsRoutes from './routes/friends.js';
import eventRoutes from './routes/events.js';
import ticketmasterRoutes from './routes/ticketmaster.js';
import geocodeRouter from './routes/geocode.js';
import authRoutes    from './routes/auth.js';
import spotifyRoutes from './routes/spotify.js';
import artistRoutes  from './routes/artists.js';
import meRoutes      from './routes/me.js';
import genreRoutes   from './routes/genres.js';
import searchRoutes from './routes/search.js';
import musicPostsRoutes from './routes/musicPosts.js';

const {
  PORT = 8080,
  MONGO_URI,
  SESSION_SECRET,
  NODE_ENV = 'development',
} = process.env;

const FRONTEND = 'https://project-music-and-memories-umzm.onrender.com';
const isProduction = NODE_ENV === 'production';

const app = express();

/* ───────── Trust proxy for secure cookies ───────── */
app.set('trust proxy', 1);

/* ───────── CORS config ───────── */
const allowedOrigins = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174',
  FRONTEND,
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://127.0.0.1:5173',
      'http://localhost:5173', 
      'http://localhost:3000',
      'http://localhost:5174',
      'https://localhost:8080',
      FRONTEND
    ];
    
    if (allowedOrigins.includes(origin) || !isProduction) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
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
};

app.use(cors(corsOptions));

/* ───────── Session cookie configuration ───────── */
app.use(
  session({
    name: 'harmonize-session',
    secret: SESSION_SECRET,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    httpOnly: true, // fixed: was false
    overwrite: true,
    signed: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/* ───────── Debugging (non-production only) ───────── */
if (!isProduction) {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    console.log('Origin:', req.get('Origin'));
    console.log('Session ID:', req.session?.userId || 'none');
    console.log('Cookies:', req.headers.cookie ? 'present' : 'none');
    next();
  });
}

/* ───────── CORS setup ───────── */
app.use(cors({
  origin: [
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://localhost:5173',
    'https://project-music-and-memories.onrender.com',
  ],
  credentials: true,
}));

/* ───────── Health check endpoint ───────── */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    session: req.session?.userId ? 'active' : 'none',
    environment: NODE_ENV,
    cors: 'enabled',
  });
});


/* ───────── Route setup ───────── */
app.use('/auth',              authRoutes);
app.use('/spotify',           spotifyRoutes);
app.use('/api/ticketmaster', ticketmasterRoutes);
app.use('/artists',           artistRoutes);
app.use('/events',            eventRoutes);

// Ensure genre routes are mounted before meRoutes
app.use('/',                  genreRoutes);
app.use('/',                  meRoutes);

app.use('/api/geocode',       geocodeRouter);
app.use('/api/tiles',         tilesRoutes);
app.use('/api/search',        searchRoutes);
app.use('/api/musicPosts',    musicPostsRoutes)

// Specific user tiles route handler
app.use('/api/users/:userId/tiles', (req, res, next) => {
  req.url = `/user/${req.params.userId}`;
  tilesRoutes(req, res, next);
});


/* ───────── Error handling ───────── */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      error: 'CORS error',
      message: 'Origin not allowed',
      origin: req.get('Origin'),
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    ...(isProduction ? {} : { details: err.message }),
  });
});

/* ───────── 404 handler ───────── */
app.use('*', (req, res) => {
  console.log('404 - Route not found:', req.method, req.originalUrl);
  res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

/* ───────── DB connection ───────── */
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('✓ MongoDB connected'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

/* ───────── Start server ───────── */
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
  console.log(`📍 Environment: ${NODE_ENV}`);
  console.log(`🔗 Frontend: ${FRONTEND}`);
  console.log(`🌐 CORS allow-list:`, allowedOrigins);
});

/* ───────── Graceful shutdown ───────── */
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  mongoose.connection.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  mongoose.connection.close(() => process.exit(0));
});
