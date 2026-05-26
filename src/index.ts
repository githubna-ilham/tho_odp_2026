import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { nasabahRoutes } from './modules/nasabah/nasabah.route';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'tabungan-haji-api',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/v1/nasabah', nasabahRoutes);

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});
