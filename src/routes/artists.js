import { Router } from 'express';
import mongoose from 'mongoose';
import Artist from '../models/Artist.js';
import { getSpotifyClient } from '../spotifyClient.js';
import SpotifyWebApi from 'spotify-web-api-node';

const router = Router();

async function getAppSpotify() {
  const api = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  });
  const { body } = await api.clientCredentialsGrant();
  api.setAccessToken(body.access_token);
  return api;
}

router.post('/', async (req, res) => {
  const artist = await Artist.create(req.body);
  res.status(201).json(artist);
});

router.patch('/:id', async (req, res) => {
  try {
    const artist = await Artist.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    if (!artist) return res.status(404).json({ msg: 'Artist not found' });
    res.json(artist);
  } catch (err) {
    res.status(500).json({ msg: 'Server error', err });
  }
});

router.get('/spotify/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Missing query parameter' });

  try {
    const spotify = await getAppSpotify();
    const result = await spotify.searchArtists(query, { limit: 10 });

    const artists = result.body.artists.items.map(a => ({
      id: a.id,
      name: a.name,
      image: a.images?.[0]?.url || null,
    }));

    res.json(artists);
  } catch (err) {
    console.error('[Spotify Search Error]', err.message || err);
    res.status(500).json({ error: 'Spotify search failed' });
  }
});

router.get('/spotify/:id', async (req, res) => {
  try {
    const spotify = await getAppSpotify();
    const [artist, albums, topTracks] = await Promise.all([
      spotify.getArtist(req.params.id),
      spotify.getArtistAlbums(req.params.id, { limit: 20 }),
      spotify.getArtistTopTracks(req.params.id, 'US'),
    ]);

    res.json({
      id: artist.body.id,
      name: artist.body.name,
      genres: artist.body.genres,
      followers: artist.body.followers?.total,
      profilePic: artist.body.images?.[0]?.url || null,
      albums: albums.body.items.map(a => ({
        id: a.id,
        name: a.name,
        cover: a.images?.[0]?.url || null,
        year: a.release_date?.slice(0, 4),
      })),
      topTracks: topTracks.body.tracks.map(t => ({
        id: t.id,
        name: t.name,
        album: { images: t.album.images },
        popularity: t.popularity,
      }))
    });
  } catch (err) {
    console.error('[Spotify Direct Fetch Error]', err.message || err);
    res.status(500).json({ error: 'Spotify artist fetch failed' });
  }
});

router.patch('/:id/follow', async (req, res) => {
  const me = '682bf5ec57acfd1e97d85e';
  const artist = await Artist.findById(req.params.id);
  if (!artist) return res.status(404).json({ msg: 'Artist not found' });

  if (!artist.followers) artist.followers = [];

  const idx = artist.followers.indexOf(me);
  if (idx === -1) artist.followers.push(me);
  else artist.followers.splice(idx, 1);

  await artist.save();
  res.json({ following: idx === -1 });
});

router.get('/test/spotify/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const spotify = await getAppSpotify();
    const result = await spotify.getArtist(id);
    res.json(result.body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Spotify fetch failed', err: err.message });
  }
});

router.patch('/artists/:id/bio', async (req, res) => {
  const { id } = req.params;
  const { bio } = req.body;

  try {
    const artist = await Artist.findOneAndUpdate(
      { spotifyId: id },
      { bio },
      { new: true }
    );
    if (!artist) return res.status(404).json({ error: 'Artist not found' });
    res.json({ bio: artist.bio });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Bio update failed' });
  }
});

router.get('/:id', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(404).json({ msg: 'Artist not found' });
  }

  try {
    const artist = await Artist.findById(req.params.id);
    if (!artist) return res.status(404).json({ msg: 'Artist not found' });

    const spotify = await getSpotifyClient();

    if (!artist.profilePic || artist.profilePic === "https://link.to/image.jpg") {
      try {
        if (!artist.spotifyId) {
          const searchResult = await spotify.searchArtists(artist.artistName, { limit: 1 });
          if (searchResult.body.artists.items.length > 0) {
            const topResult = searchResult.body.artists.items[0];
            artist.spotifyId = topResult.id;
            if (topResult.images && topResult.images.length > 0) {
              artist.profilePic = topResult.images[0].url;
            }
            await artist.save();
          }
        }
      } catch (searchErr) {
        console.error('[Spotify Search Error]', searchErr.message);
      }
    }

    if (artist.spotifyId) {
      try {
        const [spArtist, spAlbums, spTop] = await Promise.all([
          spotify.getArtist(artist.spotifyId),
          spotify.getArtistAlbums(artist.spotifyId, { limit: 20 }),
          spotify.getArtistTopTracks(artist.spotifyId, 'US')
        ]);

        if (spArtist.body.images && spArtist.body.images.length > 0) {
          artist.profilePic = spArtist.body.images[0].url;
        }

        artist.albums = spAlbums.body.items.map(a => ({
          id: a.id,
          name: a.name,
          cover: a.images?.[0]?.url,
          year: a.release_date?.slice(0, 4),
          images: a.images
        }));

        artist.topTracks = spTop.body.tracks.map(t => ({
          id: t.id,
          name: t.name,
          popularity: t.popularity,
          album: { images: t.album.images }
        }));

        await artist.save();
      } catch (spotifyErr) {
        console.error('[Spotify Error]', spotifyErr.message);
      }
    }

    res.json(artist);
  } catch (err) {
    console.error('[Server Error]', err);
    res.status(500).json({ msg: 'Server error', err });
  }
});

export default router;
