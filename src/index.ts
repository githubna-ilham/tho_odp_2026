import 'dotenv/config';
import './lib/bigint';
import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Prisma } from '@prisma/client';
import { AppError } from './lib/errors';
import { nasabahRoutes } from './modules/nasabah/nasabah.routes';
import { tabunganRoutes } from './modules/tabungan/tabungan.routes';

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
app.use('/api/v1/tabungan', tabunganRoutes);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const field = (err.meta?.target as string[])?.[0] ?? 'field';
      return res.status(409).json({
        error: 'DUPLICATE_ENTRY',
        message: `${field} sudah terdaftar`,
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Data tidak ditemukan',
      });
    }
  }

  console.error(err);
  return res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'Terjadi kesalahan pada server',
  });
};

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});
