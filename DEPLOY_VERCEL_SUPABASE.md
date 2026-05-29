# Deploy Backend ke Vercel + Supabase

Panduan ini fokus untuk deploy `tabungan-haji-api1` sebagai backend Express + Prisma di Vercel, dengan database PostgreSQL dari Supabase.

## Kondisi Project Saat Ini

Backend saat ini berjalan sebagai server Express biasa:

```ts
app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});
```

Model seperti ini cocok untuk local development, tetapi belum cocok langsung untuk Vercel karena Vercel menjalankan backend Node.js sebagai serverless function. Jadi kita perlu memisahkan:

- `src/app.ts`: konfigurasi Express app
- `src/index.ts`: local development dengan `app.listen()`
- `api/index.ts`: entry point Vercel serverless

## 1. Buat Database Supabase

1. Login ke Supabase.
2. Buat project baru.
3. Simpan password database dengan aman.
4. Ambil connection string PostgreSQL dari Supabase.

Gunakan format seperti ini untuk `DATABASE_URL`:

```env
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?schema=public"
```

Untuk aplikasi serverless, Supabase biasanya menyediakan pooler connection string. Jika tersedia, gunakan pooler untuk runtime aplikasi dan direct connection untuk migration:

```env
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@[POOLER_HOST]:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres:[PASSWORD]@[DB_HOST]:5432/postgres"
```

Catatan:

- `DATABASE_URL` dipakai aplikasi ketika runtime di Vercel.
- `DIRECT_URL` dipakai Prisma untuk migration.
- Jangan commit value asli `.env` ke Git.

## 2. Update Prisma Schema

Edit `prisma/schema.prisma`.

Saat ini:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Ubah menjadi:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

Jika nanti tidak memakai pooler dan hanya memakai satu connection string, `DIRECT_URL` tetap bisa diisi sama dengan `DATABASE_URL`.

## 3. Refactor Express App untuk Vercel

### 3.1 Buat `src/app.ts`

Pindahkan konfigurasi Express dari `src/index.ts` ke file baru:

```ts
import 'dotenv/config';
import './lib/bigint';
import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Prisma } from '@prisma/client';
import { AppError } from './lib/errors';
import { nasabahRoutes } from './modules/nasabah/nasabah.routes';
import { tabunganRoutes } from './modules/tabungan/tabungan.routes';

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
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
```

### 3.2 Ubah `src/index.ts`

File ini cukup untuk local development:

```ts
import { app } from './app';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Tabungan Haji API listening on port ${PORT}`);
});
```

### 3.3 Buat `api/index.ts`

Buat folder `api` di root project, lalu buat file:

```ts
import { app } from '../src/app';

export default app;
```

File ini adalah entry point yang akan dipakai Vercel.

## 4. Tambahkan `vercel.json`

Buat file `vercel.json` di root `tabungan-haji-api1`:

```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/api/index.ts"
    }
  ]
}
```

Dengan route ini:

- `/health` masuk ke Express app
- `/api/v1/nasabah` masuk ke Express app
- `/api/v1/tabungan` masuk ke Express app

## 5. Update Script `package.json`

Tambahkan `prisma generate` agar Prisma Client selalu dibuat saat deploy.

Rekomendasi scripts:

```json
{
  "scripts": {
    "dev": "nodemon --watch src --ext ts --exec \"ts-node src/index.ts\"",
    "build": "prisma generate && tsc",
    "start": "node dist/index.js",
    "postinstall": "prisma generate",
    "db:migrate:deploy": "prisma migrate deploy",
    "db:generate": "prisma generate"
  }
}
```

Catatan:

- `build` dipakai Vercel.
- `postinstall` membantu memastikan `@prisma/client` tergenerate setelah dependency install.
- `db:migrate:deploy` dipakai untuk menerapkan migration ke Supabase.

## 6. Set Environment Variables di Vercel

Di dashboard Vercel, buka project backend lalu isi:

```env
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
JWT_SECRET=ganti-dengan-string-random-panjang-min-32-karakter
JWT_EXPIRES_IN=1h
NODE_ENV=production
```

Jangan isi `PORT` di Vercel. Vercel yang mengatur runtime port untuk serverless function.

## 7. Jalankan Migration ke Supabase

Ada dua opsi.

### Opsi A: Jalankan dari Local

Isi `.env` local sementara dengan connection string Supabase:

```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
```

Lalu jalankan:

```bash
npx prisma migrate deploy
```

Gunakan opsi ini kalau migration sudah ada di folder `prisma/migrations`.

### Opsi B: Jalankan lewat Vercel Build

Bisa, tetapi tidak direkomendasikan untuk awal. Migration lebih aman dijalankan manual dari local agar error database terlihat jelas.

## 8. Deploy ke Vercel

Jika deploy lewat GitHub:

1. Push project ke GitHub.
2. Import repository di Vercel.
3. Set **Root Directory** ke:

```text
tabungan-haji-api1
```

4. Framework Preset: `Other`
5. Build Command:

```bash
npm run build
```

6. Install Command:

```bash
npm install
```

7. Output Directory: kosongkan.
8. Isi environment variables.
9. Deploy.

Jika deploy lewat Vercel CLI:

```bash
cd tabungan-haji-api1
vercel
```

Untuk production:

```bash
vercel --prod
```

## 9. Verifikasi Setelah Deploy

Ganti domain sesuai hasil deploy Vercel:

```bash
curl https://nama-project.vercel.app/health
```

Response yang diharapkan:

```json
{
  "status": "ok",
  "service": "tabungan-haji-api",
  "timestamp": "..."
}
```

Test endpoint nasabah:

```bash
curl https://nama-project.vercel.app/api/v1/nasabah
```

Jika database sudah connect, response harus berupa JSON dari API, bukan error connection.

## 10. Checklist Troubleshooting

### Error Prisma Client belum tergenerate

Pastikan ada script:

```json
"postinstall": "prisma generate"
```

Lalu redeploy.

### Error tidak bisa connect ke Supabase

Cek:

- `DATABASE_URL` benar.
- Password tidak mengandung karakter yang belum di-URL-encode.
- Supabase project aktif.
- Jika memakai pooler, gunakan host dan port pooler yang benar.
- Jika migration gagal, coba pakai `DIRECT_URL`.

### Endpoint `/health` 404

Cek:

- `vercel.json` sudah ada di root `tabungan-haji-api1`.
- File `api/index.ts` sudah dibuat.
- `api/index.ts` export default Express app.

### Build gagal karena TypeScript

Jalankan local:

```bash
npm run build
```

Perbaiki error TypeScript sebelum deploy ulang.

### CORS dari Frontend Gagal

Saat ini API memakai:

```ts
app.use(cors());
```

Ini mengizinkan semua origin. Untuk production banking lebih aman dibatasi:

```ts
app.use(cors({
  origin: process.env.FRONTEND_URL,
}));
```

Jika dibatasi, tambahkan env di Vercel:

```env
FRONTEND_URL=https://domain-frontend.vercel.app
```

## 11. Setelah Backend Live

Setelah backend berhasil deploy, frontend nanti perlu env:

```env
NEXT_PUBLIC_API_URL=https://nama-project-api.vercel.app/api/v1
```

Frontend akan memakai URL ini untuk cek `/health` dan endpoint API lain.

