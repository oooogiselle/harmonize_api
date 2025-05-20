import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const artistSchema = new Schema({
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  artistName:{ type: String, required: true },
  bio: String,
  tags:  [String],
  tracks:[{ type: Schema.Types.ObjectId, ref: 'Track' }],
  merchLinks:[String],
  profilePic:String
}, { timestamps:true });

export default model('Artist', artistSchema);
