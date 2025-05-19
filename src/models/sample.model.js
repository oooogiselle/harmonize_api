import mongoose from 'mongoose';

const { Schema } = mongoose;

const SampleSchema = new Schema({
  // variety of common data types
  textField:     { type: String,  required: true },   // string
  numericField:  { type: Number,  default: 0   },     // number
  boolField:     { type: Boolean, default: false },   // boolean
  dateField:     { type: Date,    default: Date.now },// date
  mixedField:    { type: Schema.Types.Mixed },        // any / JSON
}, { timestamps: true });

export default mongoose.model('Sample', SampleSchema);
