import express  from 'express';
import mongoose from 'mongoose';
import 'dotenv/config.js';

import Sample from './models/sample.model.js';

const PORT      = process.env.PORT || 8080;
const MONGO_URI = process.env.MONGO_URI; 

try {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');
} catch (err) {
  console.error('MongoDB connection error:', err.message);
  process.exit(1);
}

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.post('/samples', async (req, res) => {
  try {
    const doc = await Sample.create(req.body);
    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
