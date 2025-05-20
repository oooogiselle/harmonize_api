import mongoose from 'mongoose';

const AlbumSchema = new mongoose.Schema({
  id   : String,
  name : String,
  cover: String,
  year : String,
  images:[{ url:String }]
}, { _id:false });

const TrackSchema = new mongoose.Schema({
  id  : String,
  name: String,
  popularity: Number,
  album: {
    images:[{ url:String }]
  }
}, { _id:false });

const ArtistSchema = new mongoose.Schema({
  artistName : String,
  bio        : String,
  spotifyId  : String,
  profilePic : String,
  followers  : [String],
  albums     : [AlbumSchema],
  topTracks  : [TrackSchema]
});

export default mongoose.model('Artist', ArtistSchema);