import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import session from 'cookie-session';

import authRoutes    from './routes/auth.js';
import spotifyRoutes from './routes/spotify.js';
import artistRoutes  from './routes/artists.js';
import eventRoutes   from './routes/events.js';
import meRoutes      from './routes/me.js';
import tilesRoutes from './routes/tiles.js';
import searchRoutes from './routes/search.js';
import musicPostsRoutes from './routes/musicPosts.js';

dotenv.config();

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

/* ───────── CORS config (MOVED BEFORE SESSION) ───────── */
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://127.0.0.1:5173',
      'http://localhost:5173', 
      'http://localhost:3000',
      'http://localhost:5174',
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
    'Origin'
  ],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 200 // For legacy browser support
};

app.use(cors(corsOptions));

/* ───────── Handle preflight requests ───────── */
app.options('*', cors(corsOptions));

/* ───────── Session cookie configuration ───────── */
app.use(
  session({
    name: 'harmonize-session',
    secret: SESSION_SECRET,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    httpOnly: false,
    overwrite: true,
    signed: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/* ───────── Add debugging middleware ───────── */
if (!isProduction) {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    console.log('Origin:', req.get('Origin'));
    console.log('Session ID:', req.session?.userId || 'none');
    console.log('Cookies:', req.headers.cookie ? 'present' : 'none');
    next();
  });
}

/* ───────── Health check endpoint ───────── */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    session: req.session?.userId ? 'active' : 'none',
    environment: NODE_ENV,
    cors: 'enabled'
  });
});

/* ───────── Route setup ───────── */
app.use('/auth',              authRoutes);
app.use('/spotify',           spotifyRoutes);
app.use('/artists',           artistRoutes);
app.use('/events',            eventRoutes);
app.use('/',                  meRoutes);
app.use('/api/tiles',         tilesRoutes);
app.use('/api/search',        searchRoutes);
app.use('/api/musicPosts',    musicPostsRoutes)

// Add specific route for user tiles (this should be added to server.js)
app.use('/api/users/:userId/tiles', (req, res, next) => {
  // Forward to tiles route with user-specific handling
  req.url = `/user/${req.params.userId}`;
  tilesRoutes(req, res, next);
});

/* ───────── Error handling middleware ───────── */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  // Handle CORS errors specifically
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({ 
      error: 'CORS error',
      message: 'Origin not allowed',
      origin: req.get('Origin')
    });
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    ...(isProduction ? {} : { details: err.message })
  });
});

/* ───────── 404 handler ───────── */
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

/* ───────── DB connection ───────── */
mongoose.connect(MONGO_URI)
  .then(() => console.log('✓ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

/* ───────── Server startup ───────── */
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
  console.log(`📍 Environment: ${NODE_ENV}`);
  console.log(`🔗 Frontend: ${FRONTEND}`);
  console.log(`🌐 CORS enabled for:`, corsOptions.origin);
});

/* ───────── Graceful shutdown ───────── */
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  mongoose.connection.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  mongoose.connection.close(() => {
    process.exit(0);
  });
});