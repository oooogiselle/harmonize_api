📘 USERS
✅ Create a user

Creates a new user profile with top artists and location.

curl -X POST http://localhost:8080/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "may",
    "email": "may@example.com",
    "passwordHash": "hashed_pw",
    "bio": "music addict",
    "profileImage": "https://image.link/profile.jpg",
    "topArtists": ["Rina Sawayama", "Joji", "Charli XCX"],
    "location": {
      "type": "Point",
      "coordinates": [-118.2437, 34.0522],
      "city": "Los Angeles"
    }
  }'

✅ Update user fields (bio, friends, etc.)

Updates any field of a user, including appending friends.

curl -X PATCH http://localhost:8080/users/<user_id> \
  -H "Content-Type: application/json" \
  -d '{
    "bio": "Updated bio here",
    "friends": ["<friend_user_id>"]
  }'

✅ Add a favorite track

Adds a track to a user’s list of favorite tracks.

curl -X PATCH http://localhost:8080/users/<user_id>/favorite \
  -H "Content-Type: application/json" \
  -d '{"trackId": "<track_id>"}'

✅ Get all users

Returns all users in the system.

curl http://localhost:8080/users

✅ Get a specific user with populated fields

Returns user data including favorite tracks and friend usernames.

curl http://localhost:8080/users/<user_id>

🎵 TRACKS
✅ Create a new track

Creates a track linked to an artist, with tags and initial comments.

curl -X POST http://localhost:8080/tracks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Let It Happen",
    "artistId": "<artist_id>",
    "audioUrl": "https://audio.link/let-it-happen.mp3",
    "coverArtUrl": "https://image.link/cover.jpg",
    "tags": ["psychedelic", "indie"],
    "visibility": "public",
    "comments": [
      {
        "userId": "<user_id>",
        "content": "Amazing song!",
        "timestamp": "2025-05-20T04:00:00Z"
      }
    ]
  }'

✅ Get all tracks

Returns all tracks, optionally with artist info and comments.

curl http://localhost:8080/tracks

✅ Like a track

Adds a user’s ID to the likes array for the given track.

curl -X PATCH http://localhost:8080/tracks/<track_id>/like \
  -H "Content-Type: application/json" \
  -d '{"userId": "<user_id>"}'

✅ Comment on a track

Adds a new comment to the track.

curl -X PATCH http://localhost:8080/tracks/<track_id>/comment \
  -H "Content-Type: application/json" \
  -d '{"userId": "<user_id>", "content": "Still my favorite!"}'

🧠 BLEND
✅ Compare music taste between two users

Creates and stores a blend graph of two users’ top artist overlap.

curl http://localhost:8080/blend/<user1_id>/<user2_id>

🎤 ARTISTS
✅ Create a new artist (linked to a user)

Creates an artist profile linked to a userId.

curl -X POST http://localhost:8080/artists \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "<user_id>",
    "artistName": "Tame Impala",
    "bio": "Psychedelic project",
    "tags": ["psychedelic", "indie"],
    "merchLinks": ["https://shop.tameimpala.com"],
    "profilePic": "https://image.link/profile.jpg"
  }'

📅 EVENTS
✅ Create an event

Creates an event for an artist at a specific location and time.

curl -X POST http://localhost:8080/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Live at Red Rocks",
    "artistId": "<artist_id>",
    "location": {
      "type": "Point",
      "coordinates": [-105.2057, 39.6654]
    },
    "date": "2025-07-25T02:00:00Z",
    "description": "Tame Impala under the stars at Red Rocks"
  }'

✅ Get all events

Returns all stored events.

curl http://localhost:8080/events

🔍 SPOTIFY (Read-only catalog access)
✅ Search artists, albums, tracks, playlists

curl 'http://localhost:8080/spotify/search?q=Tame+Impala&type=artist'

✅ Get artist info by ID

curl http://localhost:8080/spotify/artist/<spotify_artist_id>

✅ Get artist albums

curl http://localhost:8080/spotify/artist/<spotify_artist_id>/albums

✅ Get track or playlist info

curl http://localhost:8080/spotify/track/<spotify_track_id>
curl http://localhost:8080/spotify/playlist/<spotify_playlist_id>