import mongoose from 'mongoose';
import Artist from './models/Artist.js';
import { connectDB } from './db.js';

const artistId = '682bf9f0d8dee0de66ba4825';
const spotifyId = '5INjqkS1o8h1imAzPqGZBb';

async function updateArtist() {
  try {
    await connectDB();
    console.log('Connected to database');
    
    const artist = await Artist.findById(artistId);
    if (!artist) {
      console.error('Artist not found');
      process.exit(1);
    }
    
    artist.spotifyId = spotifyId;
    await artist.save();
    
    console.log(`Updated artist ${artist.artistName} with Spotify ID: ${spotifyId}`);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

updateArtist();