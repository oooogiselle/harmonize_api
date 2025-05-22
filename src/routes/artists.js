import { Router } from 'express';
import Artist from '../models/Artist.js';
import spotify from '../spotifyClient.js';

const router = Router();

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

router.get('/:id', async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);
    if (!artist) return res.status(404).json({ msg: 'Artist not found' });

    console.log(`Artist ${artist.artistName} has spotifyId: ${artist.spotifyId || 'none'}`);

    if (!artist.profilePic || artist.profilePic === "https://link.to/image.jpg") {
      try {
        if (!artist.spotifyId) {
          const searchResult = await spotify.searchArtists(artist.artistName, { limit: 1 });
          if (searchResult.body.artists.items.length > 0) {
            const topResult = searchResult.body.artists.items[0];
            
            artist.spotifyId = topResult.id;
            console.log(`Found spotifyId: ${topResult.id} for artist: ${artist.artistName}`);
            
            if (topResult.images && topResult.images.length > 0) {
              artist.profilePic = topResult.images[0].url;
              console.log(`Updated profile pic to: ${artist.profilePic}`);
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
        console.log(`Fetching Spotify data for ${artist.artistName} with ID: ${artist.spotifyId}`);
        
        const [spArtist, spAlbums, spTop] = await Promise.all([
          spotify.getArtist(artist.spotifyId),
          spotify.getArtistAlbums(artist.spotifyId, { limit: 20 }),
          spotify.getArtistTopTracks(artist.spotifyId, 'US')
        ]);

        console.log(`Spotify artist response image count: ${spArtist.body.images?.length || 0}`);
        if (spArtist.body.images?.[0]) {
          console.log(`First image URL: ${spArtist.body.images[0].url}`);
        }

       
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
        if (spotifyErr.statusCode) {
          console.error(`Spotify API returned status code: ${spotifyErr.statusCode}`);
        }
      }
    } else {
      console.log(`No Spotify ID found for artist: ${artist.artistName}. Add a spotifyId to enable Spotify integration.`);
    }

    res.json(artist);
  } catch (err) {
    console.error('[Server Error]', err);
    res.status(500).json({ msg: 'Server error', err });
  }
});

router.patch('/:id/follow', async (req, res) => {
  const me = '682bf5ec57acfd1e97d85d8e';
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


export default router;