import express from 'express';
import cors from 'cors';
import router from './router.js';

const app  = express();
const PORT = process.env.PORT || 9090;

app.use(cors());
app.use(express.json());
app.use('/api', router);

app.get('/', (req, res) => res.send('API server running.'));

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
