# Backend Data Model Documentation

## Framework & Technology Stack
- **Framework:** Express.js
- **Database:** MongoDB (via Mongoose)
- **Authentication:** Session-based with Spotify OAuth integration
- **External APIs:** Spotify Web API, Ticketmaster API, OpenCage Geocoding API

## API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `GET /auth/spotify/login` - Spotify OAuth login
- `GET /auth/spotify/callback` - Spotify OAuth callback
- `GET /auth/api/me` - Get current user profile

### Users
- `GET /users` - Get all users
- `GET /users/search` - Search users (authenticated)
- `GET /users/:id` - Get user profile
- `POST /users/:id/follow` - Follow user (authenticated)
- `DELETE /users/:id/follow` - Unfollow user (authenticated)
- `GET /users/:id/following` - Get user's following list
- `GET /users/:id/followers` - Get user's followers list
- `POST /users/location` - Update user location (authenticated)

### Artists
- `GET /artists` - Get all artists
- `POST /artists` - Create artist
- `GET /artists/spotify/search` - Search Spotify artists
- `GET /artists/spotify/:id` - Get Spotify artist data
- `PATCH /artists/:id/follow` - Follow/unfollow artist
- `PATCH /artists/:id/bio` - Update artist bio

### Music Posts
- `GET /posts` - Get all music posts
- `POST /posts` - Create music post (authenticated)
- `GET /posts/spotify/search` - Search Spotify tracks
- `POST /posts/:id/like` - Like music post (authenticated)
- `POST /posts/:id/unlike` - Unlike music post (authenticated)
- `GET /posts/my-posts` - Get user's posts (authenticated)

### Spotify Integration
- `GET /spotify/search` - Search Spotify (artists/tracks)
- `GET /spotify/top-artists` - Get user's top artists (authenticated)
- `GET /spotify/user/:id` - Get friend's Spotify data
- `GET /spotify/friends/top` - Get friends' top music (authenticated)

### Music Discovery & Recommendations
- `GET /api/me/spotify` - Get user's Spotify profile + top music
- `GET /api/recommendations` - Get personalized recommendations
- `GET /api/discover/:method` - Alternative discovery methods
- `GET /api/recent` - Get recently played tracks
- `GET /api/genre-stats` - Get user's genre statistics
- `GET /api/genre-timeline` - Get genre listening timeline

### Events
- `GET /events` - Get all events
- `POST /events` - Create event
- `GET /ticketmaster/events?lat=...&lng=...&radius=...` - Get Ticketmaster events by location (coordinates)

### Tiles (Dashboard)
- `GET /tiles` - Get user's tiles
- `POST /tiles` - Create tile (authenticated)
- `PATCH /tiles/:id` - Update tile (authenticated)
- `DELETE /tiles/:id` - Delete tile (authenticated)
- `PATCH /tiles/bulk-layout` - Bulk update tile positions

### Utilities
- `GET /geocode/reverse` - Reverse geocoding (lat/lng to city)

## Data Models

### User
```
{
  displayName: String,      // Display name
  username: String,         // Unique username (lowercase)
  bio: String,             // User biography
  avatar: String,          // Profile picture URL
  email: String,           // Email address (unique, sparse)
  password: String,        // Hashed password
  accountType: String,     // 'user' | 'artist'
  
  // Spotify Integration
  spotifyId: String,       // Spotify user ID (unique, sparse)
  spotifyAccessToken: String,
  spotifyRefreshToken: String,
  spotifyTokenExpiresAt: Date,
  
  // Social Features
  followers: [ObjectId],   // Users following this user (ref: User)
  following: [ObjectId],   // Users followed by this user (ref: User)
  
  // Location (GeoJSON Point)
  location: {
    type: 'Point',
    coordinates: [Number]  // [longitude, latitude], default [0, 0]
  },
  
  createdAt: Date,
  updatedAt: Date
}
```

### Artist
```
{
  artistName: String,      // Artist name
  bio: String,            // Artist biography
  spotifyId: String,      // Spotify artist ID
  profilePic: String,     // Profile picture URL
  followers: [String],    // User IDs following this artist
  
  // Spotify Data
  albums: [{             // Album information
    id: String,
    name: String,
    cover: String,
    year: String,
    images: [{ url: String }]
  }],
  topTracks: [{          // Top tracks
    id: String,
    name: String,
    popularity: Number,
    album: { images: [{ url: String }] }
  }]
}
```
### Music Post
```
{
  spotifyTrackId: String,  // Spotify track ID (required)
  title: String,          // Track title (required)
  artist: String,         // Artist name(s) (required)
  genre: String,          // Music genre
  coverUrl: String,       // Album cover URL
  previewUrl: String,     // 30s preview URL from Spotify
  duration: Number,       // Track duration in seconds
  caption: String,        // User's caption/description
  tags: [String],         // Post tags
  uploadedBy: ObjectId,   // User who posted (ref: User)
  playCount: Number,      // Play count (default: 0)
  likes: Number,          // Like count (default: 0)
  likedBy: [ObjectId],    // Users who liked (ref: User)
  createdAt: Date
}
```

### Event
```
{
  spotifyTrackId: String,  // Spotify track ID (required)
  title: String,          // Track title (required)
  artist: String,         // Artist name(s) (required)
  genre: String,          // Music genre
  coverUrl: String,       // Album cover URL
  previewUrl: String,     // 30s preview URL from Spotify
  duration: Number,       // Track duration in seconds
  caption: String,        // User's caption/description
  tags: [String],         // Post tags
  uploadedBy: ObjectId,   // User who posted (ref: User)
  playCount: Number,      // Play count (default: 0)
  likes: Number,          // Like count (default: 0)
  likedBy: [ObjectId],    // Users who liked (ref: User)
  createdAt: Date
}
```

### Track
```
{
  spotifyTrackId: String,  // Spotify track ID (required)
  title: String,          // Track title (required)
  artist: String,         // Artist name(s) (required)
  genre: String,          // Music genre
  coverUrl: String,       // Album cover URL
  previewUrl: String,     // 30s preview URL from Spotify
  duration: Number,       // Track duration in seconds
  caption: String,        // User's caption/description
  tags: [String],         // Post tags
  uploadedBy: ObjectId,   // User who posted (ref: User)
  playCount: Number,      // Play count (default: 0)
  likes: Number,          // Like count (default: 0)
  likedBy: [ObjectId],    // Users who liked (ref: User)
  createdAt: Date
}
```

### Tile
```
{
  userId: ObjectId,       // User who owns the tile (required, ref: User)
  type: String,          // Tile type (required)
  title: String,         // Tile title
  content: String,       // Tile content
  bgImage: String,       // Background image URL
  bgColor: String,       // Background color
  font: String,          // Font family
  x: Number,             // Grid X position
  y: Number,             // Grid Y position
  w: Number,             // Grid width
  h: Number,             // Grid height
  createdAt: Date,
  updatedAt: Date
}
```

### MusicTasteGraph
```
{
  user1: ObjectId,           // First user reference (required, ref: User)
  user2: ObjectId,           // Second user reference (required, ref: User)
  overlapScore: Number,      // Compatibility score
  sharedArtists: [String],   // Common artist IDs
  differentGenres: [String], // Differing genres
  generatedAt: Date          // Generation timestamp (default: Date.now)
}
```

### Friends
```
{
  userId: ObjectId,       // User who initiated friendship (required, ref: User)
  friendId: ObjectId,     // User who was friended (required, ref: User)
  createdAt: Date,
  updatedAt: Date
}
```

### Playlist
```
{
  userId: ObjectId,       // Playlist owner (required, ref: User)
  name: String,          // Playlist name (required)
  trackIds: [ObjectId],  // Track references (ref: Track)
  isPublic: Boolean,     // Public visibility (default: false)
  createdAt: Date,
  updatedAt: Date
}
```

curl http://localhost:8080/spotify/artist/<spotify_artist_id>/albums

✅ Get track or playlist info

curl http://localhost:8080/spotify/track/<spotify_track_id>
curl http://localhost:8080/spotify/playlist/<spotify_playlist_id>
