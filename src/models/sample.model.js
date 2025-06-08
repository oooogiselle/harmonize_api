import mongoose from 'mongoose';

const { Schema } = mongoose;

const SampleSchema = new Schema({
  textField:     { type: String,  required: true },
  numericField:  { type: Number,  default: 0   },
  boolField:     { type: Boolean, default: false },
  dateField:     { type: Date,    default: Date.now },
  mixedField:    { type: Schema.Types.Mixed },
}, { timestamps: true });

export default mongoose.model('Sample', SampleSchema);
