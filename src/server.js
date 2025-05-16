import 'dotenv/config';            // <— reads .env when local
import express from 'express';
import cors    from 'cors';
import { connectDB } from './db.js';
import router  from './router.js';

const PORT = process.env.PORT || 9090;

await connectDB(process.env.MONGODB_URI);

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', router);

app.get('/', (_, res) => res.send('API server running.'));

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
