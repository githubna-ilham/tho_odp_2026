# Setup Tabungan Haji API — Catatan Lokal

Dokumentasi step-by-step setup project yang sudah dilakukan. File ini tidak di-push (folder `tabungan-haji-api/` di-gitignore).

## Environment

- **OS**: macOS (Darwin 24.6)
- **Node.js**: v20.19.5
- **npm**: 11.6.1
- **PostgreSQL**: 14.16 (Homebrew) — jalan di `localhost:5432`
- **pgAdmin 4**: terinstall di `/Applications`

## Langkah 1 — Database Setup (lewat pgAdmin)

Server PostgreSQL sudah ter-register di pgAdmin sebelumnya.

### 1.1 Bikin Database

Di pgAdmin: klik kanan **Databases → Create → Database**
- Name: `tabungan_haji`
- Owner: `postgres` (pakai user default untuk simplicity)

### 1.2 Aktifkan Extension

Klik kanan database `tabungan_haji` → **Query Tool**, jalankan:

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

Output: `CREATE EXTENSION` (atau notice "already exists").

> **Catatan**: User `bsi_user` skip — pakai `postgres` user saja. Connection string nanti pakai `postgres` sebagai user.

## Langkah 2 — Init Project Node.js + TypeScript

### 2.1 Lokasi & Init

```bash
cd ~/Documents/Projek/ODP\ BSI
mkdir tabungan-haji-api
cd tabungan-haji-api
npm init -y
```

> Folder `tabungan-haji-api/` di-gitignore di repo training (lihat `../.gitignore`).

### 2.2 Install Dependencies

**Runtime:**

```bash
npm install express cors helmet zod dotenv jsonwebtoken bcrypt
```

**Dev:**

```bash
npm install -D typescript @types/express @types/node @types/cors \
  @types/jsonwebtoken @types/bcrypt ts-node nodemon
```

Total: 148 packages, 0 vulnerabilities.

> **Versi Express**: yang terinstall **5.2.1** (latihan.md tertulis 4.x). Versi 5 ada minor breaking changes — sejauh ini OK untuk training.

#### Penjelasan 7 Package Runtime

| Package | Fungsi |
|---|---|
| **express** | Web framework — routing HTTP request/response |
| **cors** | Izinkan request dari domain berbeda (frontend ↔ API) |
| **helmet** | Auto-set security headers (XSS, clickjacking protection) |
| **zod** | Validasi input type-safe (body, query, params) |
| **dotenv** | Load `.env` file ke `process.env` |
| **jsonwebtoken** | Bikin & verify JWT untuk auth stateless |
| **bcrypt** | Hash password sebelum disimpan ke DB |

**Detail per package:**

**express** — terima HTTP request → routing → kirim response. Analogi: resepsionis yang baca request, arahkan ke ruangan tepat, lalu sampaikan jawaban.

```typescript
app.get("/nasabah", (req, res) => res.json({ data: [...] }));
```

**cors** — tanpa ini, browser **blok** request dari domain berbeda (frontend `localhost:3001` → API `localhost:3000` akan error `CORS policy: No 'Access-Control-Allow-Origin' header`).

```typescript
app.use(cors());  // izinkan semua origin (dev only)
```

**helmet** — set 11 security headers sekaligus (`X-Frame-Options`, `Strict-Transport-Security`, `X-Content-Type-Options`, dll). Wajib untuk production banking.

```typescript
app.use(helmet());
```

**zod** — validasi input dengan type-safe. Kalau invalid, lempar error sebelum data masuk service/DB.

```typescript
const schemaSetor = z.object({
  nominal: z.number().min(100_000),  // setoran minimum 100rb
});
const parsed = schemaSetor.parse(req.body);  // throw kalau invalid
```

**dotenv** — load `.env` ke `process.env`. Supaya secrets (DB password, JWT key) tidak hardcoded → bisa beda per environment.

```typescript
import "dotenv/config";
const dbUrl = process.env.DATABASE_URL;
```

**jsonwebtoken** — JWT = token signed untuk authentication **stateless**. Server tidak simpan session, semua info user ada di token.

```typescript
const token = jwt.sign({ userId: "abc" }, JWT_SECRET, { expiresIn: "1h" });
const payload = jwt.verify(token, JWT_SECRET);
```

Flow: login → server kasih JWT → client kirim balik di header `Authorization: Bearer <token>` → server verify.

**bcrypt** — hash password dengan salt + cost factor (lambat on purpose → susah brute force). Password user JANGAN disimpan plain text.

```typescript
const hash = await bcrypt.hash("rahasia123", 10);  // simpan ini ke DB
const cocok = await bcrypt.compare("rahasia123", hash);  // true/false
```

#### Mental Model — Request Flow

```
Request → cors check → helmet headers → jwt verify (auth)
       → zod validate body → controller → service → DB → response
```

| Layer | Package |
|---|---|
| HTTP server | express |
| CORS/security | cors, helmet |
| Input validation | zod |
| Config | dotenv |
| Auth | jsonwebtoken (identity) + bcrypt (password hashing) |

### 2.3 TypeScript Config

```bash
npx tsc --init
```

Lalu replace isi `tsconfig.json` dengan:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 2.4 Struktur Folder

```bash
mkdir -p src/{modules,lib,middleware,utils}
```

Hasil:

```
tabungan-haji-api/
├── node_modules/
├── src/
│   ├── lib/          # Prisma client singleton, dll
│   ├── middleware/   # auth, error handler
│   ├── modules/      # nasabah, tabungan, transaksi
│   └── utils/        # helper response, dll
├── .env
├── .gitignore
├── package.json
└── tsconfig.json
```

### 2.5 File `.env`

```env
DATABASE_URL="postgresql://postgres:root@localhost:5432/tabungan_haji?schema=public"
PORT=3000
JWT_SECRET="ganti-dengan-string-random-panjang-min-32-karakter"
JWT_EXPIRES_IN="1h"
NODE_ENV=development
```

Password user `postgres` di laptop ini = `root`. (Ganti sesuai password masing-masing peserta.)

### 2.6 File `.gitignore`

```gitignore
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
```

### 2.7 Scripts di `package.json`

```json
"scripts": {
  "dev": "nodemon --watch src --ext ts --exec \"ts-node src/index.ts\"",
  "build": "tsc",
  "start": "node dist/index.js"
}
```

## Langkah 3 — Bootstrap Express Server + `/health` Endpoint

**Tujuan**: pastikan Express + TypeScript + nodemon jalan **sebelum** sentuh database. Endpoint paling minimal yang return `{"status": "ok"}` — fungsinya untuk liveness check (load balancer/Kubernetes cek apakah service masih hidup).

### 3.1 Bikin `src/index.ts`

```typescript
import "dotenv/config";           // Load .env ke process.env
import express from "express";    // Web framework
import cors from "cors";          // Allow cross-origin requests
import helmet from "helmet";      // Auto-set security headers

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware (dipanggil urut: helmet → cors → JSON body parser)
app.use(helmet());                // 1. Pasang security headers
app.use(cors());                  // 2. Izinkan request dari domain lain
app.use(express.json());          // 3. Parse JSON body otomatis

// Endpoint health check — paling simple, no DB, no auth.
// Dipakai oleh: load balancer, monitoring, CI smoke test.
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "tabungan-haji-api",
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`✓ Server jalan di http://localhost:${PORT}`);
  console.log(`  Test: curl http://localhost:${PORT}/health`);
});
```

### 3.2 Run Server (Terminal #1)

Buka terminal, pastikan ada di folder project:

```bash
cd "/Users/mac14m1max/Documents/Projek/ODP BSI/tabungan-haji-api"
npm run dev
```

Output expected:

```
[nodemon] 3.1.14
[nodemon] watching path(s): src/**/*
[nodemon] watching extensions: ts
[nodemon] starting `ts-node src/index.ts`
✓ Server jalan di http://localhost:3000
  Test: curl http://localhost:3000/health
```

> **Penting**: terminal ini **TIDAK bisa dipakai untuk command lain** — biarkan terus jalan. Server akan listen ke port 3000 sampai Anda tekan `Ctrl+C` untuk stop.

### 3.3 Test Endpoint (Terminal #2)

Buka **terminal kedua** (jangan close terminal pertama):

```bash
curl http://localhost:3000/health
```

Response (di-prettify):

```json
{
  "status": "ok",
  "service": "tabungan-haji-api",
  "timestamp": "2026-05-25T23:24:55.038Z"
}
```

**Alternatif test tanpa curl:** buka browser → akses `http://localhost:3000/health` → akan tampilkan JSON langsung.

✅ **Checkpoint**: server jalan di Terminal #1, `/health` responsif dari Terminal #2 / browser, nodemon auto-restart saat file `src/*.ts` diubah.

### 3.4 Stop Server

Di Terminal #1, tekan `Ctrl+C`. Output:
```
^C[nodemon] reset
```

Server berhenti. Untuk start lagi: `npm run dev`.

### 3.5 Apa itu Health Check Endpoint?

Di production, **load balancer / Kubernetes** memanggil `/health` periodik (mis. tiap 10 detik) untuk:

- **Liveness probe** — service masih hidup? Kalau gagal 3x → restart container.
- **Readiness probe** — service siap terima traffic? Kalau gagal → routing pindah ke instance lain.

Banking strict biasanya juga cek di sini: DB ping OK? Kafka/Redis sehat? Dependency eksternal up?

---

## Verifikasi Setup Sejauh Ini

| Check | Cara verifikasi | Status |
|---|---|---|
| Node siap | `node --version` → v20.19.5 | ✅ |
| PostgreSQL jalan | `lsof -i :5432` | ✅ |
| Database `tabungan_haji` ada | Lihat di pgAdmin sidebar | ✅ |
| Extension pgcrypto aktif | Query: `SELECT * FROM pg_extension WHERE extname='pgcrypto';` | ⏳ pending |
| Project init | `ls tabungan-haji-api/` ada `package.json` + `node_modules` | ✅ |
| TS config ready | `cat tsconfig.json` | ✅ |
| Koneksi `postgres@tabungan_haji` | `psql -U postgres -d tabungan_haji -h localhost` | ✅ |
| Server `/health` jalan | `curl localhost:3000/health` → status ok | ✅ |
| Prisma terinstall | `ls node_modules/.prisma` ada | ⏳ pending |
| Schema `Nasabah` ditulis | `cat prisma/schema.prisma` | ✅ |
| Migration applied | Tabel `nasabah` muncul di pgAdmin | ⏳ pending |

## Langkah 4 — Setup Prisma + Model `Nasabah` (Pendekatan Incremental)

Daripada langsung migrate semua 4 tabel sekaligus, kita pakai pola **satu tabel → end-to-end → tambah berikutnya**. Lebih mudah dipahami peserta + bug lebih mudah dilokalisasi.

### 4.1 Install Prisma

```bash
cd "/Users/mac14m1max/Documents/Projek/ODP BSI/tabungan-haji-api"
npm install prisma @prisma/client
```

| Package | Tipe | Fungsi |
|---|---|---|
| `prisma` | dev tool | CLI untuk `migrate`, `generate`, `studio` |
| `@prisma/client` | runtime | Client type-safe yang di-import di kode |

### 4.2 Inisialisasi Prisma

```bash
npx prisma init --datasource-provider postgresql
```

Yang terjadi:
- Bikin folder `prisma/` + file `prisma/schema.prisma` (template default)
- Append baris `DATABASE_URL="postgresql://johndoe:randompassword@..."` ke `.env`

**Cleanup `.env`** — hapus baris `DATABASE_URL` baru yang di-append (dan komentarnya). Biarkan baris asli yang `postgres:root@localhost`. Final `.env`:

```env
DATABASE_URL="postgresql://postgres:root@localhost:5432/tabungan_haji?schema=public"
PORT=3000
JWT_SECRET="ganti-dengan-string-random-panjang-min-32-karakter"
JWT_EXPIRES_IN="1h"
NODE_ENV=development
```

### 4.3 Tulis Model `Nasabah` di `prisma/schema.prisma`

Replace seluruh isi file dengan:

```prisma
// Prisma schema — sumber kebenaran (source of truth) untuk struktur DB.
// Dokumentasi: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Nasabah {
  id        String   @id @default(uuid())
  nik       String   @unique @db.VarChar(16)
  nama      String   @db.VarChar(100)
  email     String   @unique @db.VarChar(150)
  nomorHp   String   @map("nomor_hp") @db.VarChar(20)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("nasabah")
}
```

**Anatomi schema:**

| Bagian | Fungsi |
|---|---|
| `generator client` | Kasih tahu Prisma: generate Client TypeScript (default → `node_modules/@prisma/client`) |
| `datasource db` | Sumber data — Postgres, connection string dari env `DATABASE_URL` |
| `model Nasabah` | Definisi tabel — 1 model = 1 tabel di DB |
| `@id` | Primary key |
| `@default(uuid())` | Auto-generate UUID v4 saat insert |
| `@unique` | Constraint UNIQUE di kolom |
| `@db.VarChar(16)` | Tipe SQL spesifik: `VARCHAR(16)` (bukan `TEXT`) |
| `@map("nomor_hp")` | Kolom DB pakai `nomor_hp` (snake_case), kode TS pakai `nomorHp` (camelCase) |
| `@@map("nasabah")` | Nama tabel di DB = `nasabah` (lowercase), bukan `Nasabah` |
| `@updatedAt` | Auto-update timestamp tiap row di-modify |

**Kenapa hanya 1 model dulu?** Supaya peserta paham siklus penuh: schema → migrate → cek DB → endpoint → test. Setelah confident, baru tambah model lain.

### 4.4 Run Migration

Pastikan server Express di Terminal #1 sudah di-`Ctrl+C` dulu, supaya tidak rebut koneksi.

```bash
npx prisma migrate dev --name init_nasabah
```

Yang terjadi:
1. Prisma baca `schema.prisma`
2. Generate SQL migration di `prisma/migrations/<timestamp>_init_nasabah/migration.sql`
3. Apply migration ke database `tabungan_haji`
4. Generate Prisma Client ke `node_modules/@prisma/client` (default — tersembunyi, tapi siap di-import)

**Output expected:**
```
✔ Generated Prisma Client (vX.X.X) to ./node_modules/@prisma/client
Your database is now in sync with your schema.
```

### 4.5 Verifikasi di pgAdmin

Buka **pgAdmin** → database `tabungan_haji` → schema `public` → Tables. Harus muncul:
- `nasabah` (tabel data utama)
- `_prisma_migrations` (riwayat migration — Prisma yang manage, jangan diutak-atik manual)

Klik kanan tabel `nasabah` → **View/Edit Data** → **All Rows** → harus kosong (belum ada data).

Lihat juga struktur kolom — klik kanan `nasabah` → **Properties** → tab **Columns**. Harus ada: `id`, `nik`, `nama`, `email`, `nomor_hp`, `created_at`, `updated_at`.

✅ **Checkpoint Langkah 4**: tabel `nasabah` ter-create di Postgres, Prisma Client ter-generate di `node_modules/@prisma/client` (default location).

**Catatan import path:** karena kita TIDAK set `output` di schema, Client di-generate ke `node_modules/@prisma/client` (default). Import-nya pakai `from "@prisma/client"`. Alternatif: kalau set `output = "../src/generated/prisma"`, Client di-generate ke folder project (kelihatan di tree, lebih edukatif tapi import path relatif lebih panjang). Untuk training kita pilih default — sesuai mayoritas tutorial.

### 4.6 Langkah Berikutnya

- **Langkah 5** — Bikin Prisma Client Singleton + endpoint `POST/GET /api/v1/nasabah` dengan Zod validation
- **Langkah 6** — Tambah model `TabunganHaji`, migrate ulang, bikin endpoint terkait
- **Langkah 7** — Tambah model `Transaksi` (setor saldo dengan idempotency-key)
- **Langkah 8** — Tambah model `AuditLog` + JWT auth (login flow, middleware verify token)

## Langkah 5 — Endpoint Nasabah (Prisma + Zod + Modular Pattern)

Pola yang dipakai: **feature-based modular** — tiap fitur (Nasabah, Tabungan, Transaksi) punya foldernya sendiri berisi `schema/service/controller/routes`. Skala ke project besar tanpa folder `routes/` raksasa.

### 5.1 Install Zod (Validation Library)

```bash
npm install zod
```

| Package | Fungsi |
|---|---|
| `zod` | Schema validation runtime — 1 schema → validate request + auto-infer TypeScript type + (nanti) generate OpenAPI |

### 5.2 Prisma Client Singleton — `src/lib/prisma.ts`

**Kenapa singleton?** Setiap `new PrismaClient()` buka connection pool baru. Kalau setiap request bikin instance → connection DB habis cepat. Solusi: 1 instance di-share seluruh aplikasi.

**Kenapa `globalThis`?** Saat development, `nodemon` hot-reload menjalankan ulang file → kalau instance disimpan di module scope biasa, tiap reload bikin instance baru → connection leak. `globalThis` survive reload.

```ts
// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

### 5.3 Struktur Modul Nasabah

```
src/modules/nasabah/
├── nasabah.schema.ts       # Zod schema — validation rules
├── nasabah.service.ts      # DB operations (akses Prisma)
├── nasabah.controller.ts   # HTTP handler (request → response)
└── nasabah.routes.ts       # URL → controller mapping
```

**Separation of concerns:**

| Layer | Tugas | Tidak boleh |
|---|---|---|
| `schema` | Definisi struktur input + validation rules | Akses DB |
| `service` | Semua query Prisma | Tahu tentang Request/Response HTTP |
| `controller` | Parse request, panggil service, format response | Akses Prisma langsung |
| `routes` | Map URL ke controller method | Berisi logic |

Pola ini disebut **Repository Pattern** — kalau nanti ganti ORM atau tambah cache layer, cuma `service.ts` yang berubah.

### 5.4 Schema (`nasabah.schema.ts`)

```ts
import { z } from "zod";

export const CreateNasabahSchema = z.object({
  nik: z.string().length(16, "NIK harus tepat 16 digit").regex(/^\d+$/, "NIK harus angka"),
  nama: z.string().min(3, "Nama minimal 3 karakter").max(100),
  email: z.string().email("Format email tidak valid").max(150),
  nomorHp: z.string().regex(/^08\d{8,11}$/, "Nomor HP harus format 08xxxxxxxxxx (10-13 digit)"),
});

export type CreateNasabahInput = z.infer<typeof CreateNasabahSchema>;
```

**Note `z.infer`** — TypeScript type otomatis di-generate dari schema. Tidak perlu maintain dua tempat (schema + interface).

### 5.5 Service (`nasabah.service.ts`)

```ts
import { prisma } from "../../lib/prisma";
import type { CreateNasabahInput } from "./nasabah.schema";

export const nasabahService = {
  create: (data: CreateNasabahInput) => prisma.nasabah.create({ data }),
  findAll: () => prisma.nasabah.findMany({ orderBy: { createdAt: "desc" } }),
  findById: (id: string) => prisma.nasabah.findUnique({ where: { id } }),
};
```

### 5.6 Controller (`nasabah.controller.ts`)

```ts
import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { CreateNasabahSchema } from "./nasabah.schema";
import { nasabahService } from "./nasabah.service";

export const nasabahController = {
  async create(req: Request, res: Response) {
    const parsed = CreateNasabahSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        details: parsed.error.flatten().fieldErrors,
      });
    }
    try {
      const nasabah = await nasabahService.create(parsed.data);
      return res.status(201).json(nasabah);
    } catch (err) {
      // P2002 = Prisma unique constraint violation
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const field = (err.meta?.target as string[])?.[0] ?? "field";
        return res.status(409).json({
          error: "DUPLICATE_ENTRY",
          message: `${field} sudah terdaftar`,
        });
      }
      throw err;
    }
  },

  async findAll(_req: Request, res: Response) {
    const data = await nasabahService.findAll();
    return res.json({ data, total: data.length });
  },

  async findById(req: Request, res: Response) {
    const id = String(req.params.id);
    const nasabah = await nasabahService.findById(id);
    if (!nasabah) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: `Nasabah dengan id ${id} tidak ditemukan`,
      });
    }
    return res.json(nasabah);
  },
};
```

**Anatomi error handling:**

| Status | Kapan | Body |
|---|---|---|
| `400 VALIDATION_ERROR` | Zod schema gagal | `details` per field, peserta tahu mana yang salah |
| `409 DUPLICATE_ENTRY` | Unique constraint (NIK/email) | Sebut field yang duplikat |
| `404 NOT_FOUND` | `findUnique` return null | — |
| `500 INTERNAL_SERVER_ERROR` | Exception lain | Di-tangkap global handler di `index.ts` |

### 5.7 Routes (`nasabah.routes.ts`)

```ts
import { Router } from "express";
import { nasabahController } from "./nasabah.controller";

export const nasabahRoutes = Router();

nasabahRoutes.post("/", nasabahController.create);
nasabahRoutes.get("/", nasabahController.findAll);
nasabahRoutes.get("/:id", nasabahController.findById);
```

### 5.8 Register Route + Global Error Handler di `src/index.ts`

Tambah import di atas:
```ts
import { nasabahRoutes } from "./modules/nasabah/nasabah.routes";
```

Tambah setelah route `/health`:
```ts
// Mount semua endpoint /api/v1/nasabah
app.use("/api/v1/nasabah", nasabahRoutes);

// Global error handler — tangkap exception yang tidak ke-handle di controller.
// Harus ditaruh PALING BAWAH, sebelum app.listen().
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[ERROR]", err);
  res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message: "Terjadi kesalahan internal. Cek log server.",
  });
});
```

**Kenapa global error handler di paling bawah?** Express mengevaluasi middleware secara berurutan. Handler dengan 4 parameter (`err, req, res, next`) dianggap error handler. Express baru lompat ke sini kalau ada controller yang `throw` atau `next(err)`.

### 5.9 Fix `tsconfig.json` Deprecation Warning

TypeScript 6.0+ akan warning `moduleResolution=node10`. Tambah baris ini di `compilerOptions`:

```json
"ignoreDeprecations": "6.0",
```

### 5.10 Test Endpoint

Pastikan server jalan (`npm run dev`), buka **Terminal #2**:

```bash
# 1. Create nasabah (sukses)
curl -X POST http://localhost:3000/api/v1/nasabah \
  -H "Content-Type: application/json" \
  -d '{"nik":"3201010101010001","nama":"Budi Santoso","email":"budi@example.com","nomorHp":"081234567890"}'

# 2. List semua nasabah
curl http://localhost:3000/api/v1/nasabah

# 3. Get by id (pakai id dari response #1)
curl http://localhost:3000/api/v1/nasabah/<id>

# 4. Validation error — semua field invalid
curl -X POST http://localhost:3000/api/v1/nasabah \
  -H "Content-Type: application/json" \
  -d '{"nik":"123","nama":"X","email":"bukan-email","nomorHp":""}'

# 5. Duplicate NIK
curl -X POST http://localhost:3000/api/v1/nasabah \
  -H "Content-Type: application/json" \
  -d '{"nik":"3201010101010001","nama":"Lain","email":"lain@x.com","nomorHp":"081111111111"}'
```

**Expected response — Test #4 (Validation Error):**
```json
{
  "error": "VALIDATION_ERROR",
  "details": {
    "nik": ["NIK harus tepat 16 digit"],
    "nama": ["Nama minimal 3 karakter"],
    "email": ["Format email tidak valid"],
    "nomorHp": ["Nomor HP harus format 08xxxxxxxxxx (10-13 digit)"]
  }
}
```

**Expected response — Test #5 (Duplicate):**
```json
{ "error": "DUPLICATE_ENTRY", "message": "nik sudah terdaftar" }
```

### 5.11 Checklist Verifikasi Langkah 5

| Cek | Cara | Status |
|---|---|---|
| TypeScript compile clean | `npx tsc --noEmit` → no errors | ✅ |
| Server jalan tanpa crash | log muncul `Nasabah: curl ...` | ✅ |
| `POST` create → 201 + data | curl test #1 | ✅ |
| `GET` list → array + total | curl test #2 | ✅ |
| `GET /:id` exist → 200 | curl test #3 | ✅ |
| `GET /:id` not exist → 404 | curl `/api/v1/nasabah/abc` | ✅ |
| Validation gagal → 400 + field errors | curl test #4 | ✅ |
| Duplicate NIK → 409 | curl test #5 | ✅ |

✅ **Checkpoint Langkah 5**: API CRUD Nasabah berfungsi end-to-end dengan validation + error handling production-grade.

### 5.12 Langkah Berikutnya

- **Langkah 5.5** — Pasang Swagger UI (`@asteasolutions/zod-to-openapi`) — peserta bisa explore endpoint via browser di `http://localhost:3000/docs`
- **Langkah 6** — Model `TabunganHaji` + endpoint buka rekening & lihat saldo
- **Langkah 7** — Model `Transaksi` + endpoint setor (idempotent + DB transaction) & mutasi

## Langkah 6 — Model `TabunganHaji` + Endpoint Buka Rekening & Saldo

Lanjut pola incremental: tambah **satu model baru → migrate → endpoint → test**. Langkah ini menutup user story Jira **THO-38** (Buka rekening) & **THO-40** (Lihat saldo & detail tabungan).

> **Catatan revisi roadmap:** rencana awal menyebut "saat create nasabah, otomatis buat rekening". Setelah lihat acceptance criteria di Jira (THO-38), buka rekening dibuat sebagai **aksi eksplisit** (`POST /api/v1/tabungan`) dengan aturan: tolak kalau nasabah belum terdaftar (403), tolak kalau sudah punya tabungan aktif (409). Lebih sesuai alur perbankan nyata.

### 6.1 Tambah Model `TabunganHaji` di `prisma/schema.prisma`

Tambah relasi `tabungan` di model `Nasabah`, lalu tambah model baru. Saldo pakai `BigInt` — rupiah bisa sangat besar (tabungan haji puluhan juta) dan tidak boleh kehilangan presisi.

```prisma
model Nasabah {
  id        String         @id @default(uuid())
  nik       String         @unique @db.VarChar(16)
  nama      String         @db.VarChar(100)
  email     String         @unique @db.VarChar(150)
  nomorHp   String         @map("nomor_hp") @db.VarChar(20)
  tabungan  TabunganHaji[] // relasi 1 nasabah → banyak tabungan (historis)
  createdAt DateTime       @default(now()) @map("created_at")
  updatedAt DateTime       @updatedAt @map("updated_at")

  @@map("nasabah")
}

model TabunganHaji {
  id            String   @id @default(uuid())
  nasabahId     String   @map("nasabah_id")
  nasabah       Nasabah  @relation(fields: [nasabahId], references: [id])
  nomorRekening String   @unique @map("nomor_rekening") @db.VarChar(20)
  saldo         BigInt   @default(0)
  status        String   @default("AKTIF") @db.VarChar(20)
  dibukaAt      DateTime @default(now()) @map("dibuka_at")

  @@map("tabungan_haji")
}
```

| Bagian | Fungsi |
|---|---|
| `tabungan TabunganHaji[]` | Sisi "one" dari relasi — 1 nasabah bisa punya banyak record tabungan (mis. rekening lama yang sudah ditutup) |
| `nasabah @relation(...)` | Sisi "many" — foreign key `nasabah_id` mengacu ke `nasabah.id` |
| `saldo BigInt @default(0)` | Rekening baru selalu mulai dari Rp 0; `BigInt` aman untuk nominal besar |
| `status @default("AKTIF")` | Status rekening — dipakai untuk cegah buka rekening dobel |

### 6.2 Run Migration

```bash
npx prisma migrate dev --name add_tabungan_haji
```

Prisma generate SQL (tabel `tabungan_haji` + foreign key) dan regenerate Client. Verifikasi di pgAdmin: tabel `tabungan_haji` muncul dengan kolom `nasabah_id`, `nomor_rekening`, `saldo`, `status`, `dibuka_at`.

### 6.3 Fix Serialisasi `BigInt` — `src/lib/bigint.ts`

Masalah: `JSON.stringify` **tidak bisa** serialisasi `BigInt` — `res.json({ saldo: 500000n })` akan lempar `TypeError: Do not know how to serialize a BigInt`. Solusi: ajari `BigInt` cara serialisasi dirinya jadi string (string lebih aman daripada number karena nilai besar bisa lewat batas `Number.MAX_SAFE_INTEGER`).

```ts
// src/lib/bigint.ts
// Prisma mengembalikan kolom BigInt (saldo, nominal) sebagai BigInt JS.
// Serialisasi sebagai string agar nilai besar tidak kehilangan presisi.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};
```

Import sekali di paling atas `src/index.ts` (lihat 6.7) — side-effect global, cukup sekali.

### 6.4 Domain Error Helper — `src/lib/errors.ts`

Sampai sekarang error di-handle ad-hoc di controller. Mulai ada error domain (403 belum daftar, 409 sudah punya rekening) — kita bikin satu class `AppError` yang membawa status + kode, lalu di-tangkap global error handler.

```ts
// src/lib/errors.ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
```

### 6.5 Struktur Modul Tabungan

```
src/modules/tabungan/
├── tabungan.schema.ts       # Zod schema input
├── tabungan.service.ts      # Query Prisma + aturan bisnis
├── tabungan.controller.ts   # HTTP handler
└── tabungan.routes.ts       # URL → controller
```

**Schema (`tabungan.schema.ts`)** — buka rekening cuma butuh `nasabahId`:

```ts
import { z } from "zod";

export const BukaTabunganSchema = z.object({
  nasabahId: z.string().uuid("nasabahId harus UUID yang valid"),
});

export type BukaTabunganInput = z.infer<typeof BukaTabunganSchema>;
```

**Service (`tabungan.service.ts`)** — aturan bisnis THO-38 & THO-40:

```ts
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";

function generateNomorRekening(): string {
  const random = Math.floor(Math.random() * 1e12).toString().padStart(12, "0");
  return `71${random}`;
}

export const tabunganService = {
  // THO-38 — Buka rekening tabungan haji
  async buka(nasabahId: string) {
    const nasabah = await prisma.nasabah.findUnique({ where: { id: nasabahId } });
    if (!nasabah) {
      throw new AppError(403, "NASABAH_NOT_REGISTERED", "Harus daftar nasabah dulu");
    }

    const aktif = await prisma.tabunganHaji.findFirst({
      where: { nasabahId, status: "AKTIF" },
    });
    if (aktif) {
      throw new AppError(409, "ALREADY_HAS_ACTIVE", "Sudah punya tabungan haji aktif");
    }

    return prisma.tabunganHaji.create({
      data: { nasabahId, nomorRekening: generateNomorRekening() },
    });
  },

  // THO-40 — Lihat saldo & detail tabungan
  async detail(id: string) {
    const tabungan = await prisma.tabunganHaji.findUnique({
      where: { id },
      include: { nasabah: { select: { id: true, nama: true, nik: true } } },
    });
    if (!tabungan) {
      throw new AppError(404, "NOT_FOUND", "Tabungan tidak ditemukan");
    }
    return tabungan;
  },
};
```

**Controller (`tabungan.controller.ts`)** — service yang `throw AppError`, di-tangkap global handler (lihat 6.7):

```ts
import type { Request, Response } from "express";
import { BukaTabunganSchema } from "./tabungan.schema";
import { tabunganService } from "./tabungan.service";

export const tabunganController = {
  // POST /api/v1/tabungan
  async buka(req: Request, res: Response) {
    const parsed = BukaTabunganSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const tabungan = await tabunganService.buka(parsed.data.nasabahId);
    return res.status(201).json(tabungan);
  },

  // GET /api/v1/tabungan/:id
  async detail(req: Request, res: Response) {
    const tabungan = await tabunganService.detail(String(req.params.id));
    return res.status(200).json(tabungan);
  },
};
```

> **Catatan Express 5:** controller `async` yang `throw` otomatis diteruskan ke error handler — tidak perlu `try/catch` di tiap method (beda dengan Express 4 yang butuh `next(err)` manual).

**Routes (`tabungan.routes.ts`):**

```ts
import { Router } from "express";
import { tabunganController } from "./tabungan.controller";

export const tabunganRoutes = Router();

tabunganRoutes.post("/", tabunganController.buka);
tabunganRoutes.get("/:id", tabunganController.detail);
```

### 6.6 AC `saldo tidak cukup` (THO-39 AC2) — kenapa belum diimplementasi?

Acceptance criteria setor menyebut "saldo **rekening sumber** tidak cukup". Schema kita **belum punya model rekening sumber** (giro/payroll) — setor saat ini murni *credit* ke tabungan haji. Validasi saldo sumber ditunda sampai model rekening sumber ditambahkan (di luar scope Modul 2). Tetap dicatat agar tidak terlupa saat review PO/Compliance.

### 6.7 Update `src/index.ts` — Mount Route + Upgrade Error Handler

```ts
import "dotenv/config";
import "./lib/bigint";              // patch serialisasi BigInt (sekali, paling atas)
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { Prisma } from "@prisma/client";
import { AppError } from "./lib/errors";
import { nasabahRoutes } from "./modules/nasabah/nasabah.routes";
import { tabunganRoutes } from "./modules/tabungan/tabungan.routes";

// ... (setup app + middleware + /health seperti sebelumnya) ...

app.use("/api/v1/nasabah", nasabahRoutes);
app.use("/api/v1/tabungan", tabunganRoutes);

// Global error handler — tangani AppError (domain) + error Prisma + fallback 500.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.code, message: err.message });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const field = (err.meta?.target as string[])?.[0] ?? "field";
      return res.status(409).json({ error: "DUPLICATE_ENTRY", message: `${field} sudah terdaftar` });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: "NOT_FOUND", message: "Data tidak ditemukan" });
    }
  }
  console.error("[ERROR]", err);
  return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "Terjadi kesalahan internal. Cek log server." });
});
```

### 6.8 Test Endpoint

```bash
# Pakai <nasabahId> dari hasil POST /api/v1/nasabah di Langkah 5

# 1. Buka rekening (sukses → 201, saldo "0")
curl -X POST http://localhost:3000/api/v1/tabungan \
  -H "Content-Type: application/json" -d '{"nasabahId":"<nasabahId>"}'

# 2. Buka rekening kedua untuk nasabah sama → 409 ALREADY_HAS_ACTIVE
curl -X POST http://localhost:3000/api/v1/tabungan \
  -H "Content-Type: application/json" -d '{"nasabahId":"<nasabahId>"}'

# 3. Buka rekening untuk nasabah tak terdaftar → 403 NASABAH_NOT_REGISTERED
curl -X POST http://localhost:3000/api/v1/tabungan \
  -H "Content-Type: application/json" -d '{"nasabahId":"00000000-0000-0000-0000-000000000000"}'

# 4. Lihat saldo & detail (pakai <tabunganId> dari response #1)
curl http://localhost:3000/api/v1/tabungan/<tabunganId>
```

### 6.9 Checklist Verifikasi Langkah 6

| Cek | Cara | Status |
|---|---|---|
| TypeScript compile clean | `npx tsc --noEmit` → no errors | ✅ |
| Tabel `tabungan_haji` ter-create | pgAdmin | ✅ |
| BigInt ter-serialisasi (saldo `"0"`) | curl test #1 | ✅ |
| Buka rekening → 201 | curl test #1 | ✅ |
| Buka kedua → 409 | curl test #2 | ✅ |
| Nasabah tak terdaftar → 403 | curl test #3 | ✅ |
| Detail saldo → 200 + data nasabah | curl test #4 | ✅ |

✅ **Checkpoint Langkah 6**: nasabah bisa buka rekening tabungan haji & lihat saldo, dengan aturan bisnis + serialisasi BigInt benar.

## Langkah 7 — Model `Transaksi` + Setor (Idempotent + DB Transaction) & Mutasi

Langkah paling kritikal — menyentuh **uang**. Menutup user story **THO-39** (Setor idempotent) & **THO-41** (Mutasi). Dua konsep penting: **DB transaction** (atomic) dan **idempotency** (retry aman tanpa double-credit).

### 7.1 Tambah Model `Transaksi` di `prisma/schema.prisma`

Tambah relasi `transaksi` di `TabunganHaji`, lalu model baru. Field `referensi @unique` adalah kunci idempotency — satu referensi cuma boleh tercatat sekali.

```prisma
model TabunganHaji {
  // ... field sebelumnya ...
  transaksi Transaksi[]

  @@map("tabungan_haji")
}

model Transaksi {
  id           String       @id @default(uuid())
  tabunganId   String       @map("tabungan_id")
  tabungan     TabunganHaji @relation(fields: [tabunganId], references: [id])
  jenis        String       @db.VarChar(20)
  nominal      BigInt
  saldoSebelum BigInt       @map("saldo_sebelum")
  saldoSesudah BigInt       @map("saldo_sesudah")
  referensi    String       @unique @db.VarChar(50)
  metode       String?      @db.VarChar(20)
  waktu        DateTime     @default(now())

  @@map("transaksi")
}
```

| Field | Fungsi |
|---|---|
| `referensi @unique` | **Idempotency key** — DB menolak insert kedua dengan referensi sama (constraint UNIQUE) |
| `saldoSebelum` / `saldoSesudah` | Snapshot saldo sebelum & sesudah transaksi — audit trail wajib di perbankan |
| `jenis` | Mis. `"Setor QRIS"` — kategori transaksi untuk tampilan mutasi |

Migrate:

```bash
npx prisma migrate dev --name add_transaksi
```

### 7.2 Tambah Schema Setor — `tabungan.schema.ts`

```ts
export const SetorSchema = z.object({
  nominal: z
    .number({ message: "Nominal wajib berupa angka" })
    .int("Nominal harus bilangan bulat")
    .min(100000, "Setoran minimum Rp 100.000"),
  referensi: z.string().min(1, "Referensi (idempotency key) wajib diisi").max(50),
  metode: z.string().max(20).optional(),
});

export type SetorInput = z.infer<typeof SetorSchema>;
```

> **AC3 (nominal < minimum)** ditangani di sini — `.min(100000, ...)` langsung balas `400 VALIDATION_ERROR` dengan pesan "Setoran minimum Rp 100.000".

### 7.3 Tambah Method Service — `tabungan.service.ts`

```ts
import type { SetorInput } from "./tabungan.schema";

// ... di dalam object tabunganService, tambah: ...

  // THO-41 — Lihat mutasi transaksi
  async mutasi(id: string) {
    const tabungan = await prisma.tabunganHaji.findUnique({ where: { id } });
    if (!tabungan) {
      throw new AppError(404, "NOT_FOUND", "Tabungan tidak ditemukan");
    }
    return prisma.transaksi.findMany({
      where: { tabunganId: id },
      orderBy: { waktu: "desc" },
    });
  },

  // THO-39 — Setor saldo (idempotent + DB transaction)
  async setor(tabunganId: string, input: SetorInput) {
    // (1) Idempotency fast-path: kalau referensi sudah pernah sukses,
    //     kembalikan hasil sebelumnya — JANGAN credit lagi.
    const existing = await prisma.transaksi.findUnique({
      where: { referensi: input.referensi },
    });
    if (existing) {
      return { transaksi: existing, idempotent: true };
    }

    const nominal = BigInt(input.nominal);

    // (2) DB transaction: baca saldo → update saldo → catat transaksi.
    //     Kalau salah satu gagal, SEMUA di-rollback (atomic).
    const transaksi = await prisma.$transaction(async (tx) => {
      const tabungan = await tx.tabunganHaji.findUnique({ where: { id: tabunganId } });
      if (!tabungan) {
        throw new AppError(404, "NOT_FOUND", "Tabungan tidak ditemukan");
      }
      if (tabungan.status !== "AKTIF") {
        throw new AppError(409, "TABUNGAN_INACTIVE", "Tabungan tidak aktif");
      }

      const saldoSebelum = tabungan.saldo;
      const saldoSesudah = saldoSebelum + nominal;

      await tx.tabunganHaji.update({
        where: { id: tabunganId },
        data: { saldo: saldoSesudah },
      });

      return tx.transaksi.create({
        data: {
          tabunganId,
          jenis: "Setor QRIS",
          nominal,
          saldoSebelum,
          saldoSesudah,
          referensi: input.referensi,
          metode: input.metode ?? "QRIS",
        },
      });
    });

    return { transaksi, idempotent: false };
  },
```

**Kenapa idempotency penting?** Jaringan mobile sering timeout — client retry request setor. Tanpa idempotency, retry = double-credit (uang nasabah bertambah dua kali). Dengan `referensi @unique` + cek fast-path, retry aman: server kembalikan hasil pertama. Sebagai jaring pengaman tambahan, constraint UNIQUE di DB akan tetap menolak insert kedua (lempar P2002) walau dua request balapan (race condition).

**Kenapa `$transaction`?** Update saldo dan insert transaksi harus **all-or-nothing**. Kalau saldo ke-update tapi insert transaksi gagal (atau sebaliknya), data jadi tidak konsisten. `prisma.$transaction` bungkus keduanya dalam satu DB transaction — gagal di tengah → rollback otomatis.

### 7.4 Tambah Method Controller + Routes

```ts
// tabungan.controller.ts — tambah:
import { SetorSchema } from "./tabungan.schema";

  // GET /api/v1/tabungan/:id/mutasi
  async mutasi(req: Request, res: Response) {
    const data = await tabunganService.mutasi(String(req.params.id));
    return res.status(200).json({ data, total: data.length });
  },

  // POST /api/v1/tabungan/:id/setor
  async setor(req: Request, res: Response) {
    const parsed = SetorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const { transaksi, idempotent } = await tabunganService.setor(String(req.params.id), parsed.data);
    // Setor baru → 201, replay idempotent → 200
    return res.status(idempotent ? 200 : 201).json(transaksi);
  },
```

```ts
// tabungan.routes.ts — tambah:
tabunganRoutes.get("/:id/mutasi", tabunganController.mutasi);
tabunganRoutes.post("/:id/setor", tabunganController.setor);
```

### 7.5 Test Endpoint

```bash
# <tabunganId> dari Langkah 6

# 1. Setor < minimum → 400 "Setoran minimum Rp 100.000"
curl -X POST http://localhost:3000/api/v1/tabungan/<tabunganId>/setor \
  -H "Content-Type: application/json" -d '{"nominal":50000,"referensi":"REF-001"}'

# 2. Setor 500rb → 201, saldoSesudah "500000"
curl -X POST http://localhost:3000/api/v1/tabungan/<tabunganId>/setor \
  -H "Content-Type: application/json" -d '{"nominal":500000,"referensi":"REF-002"}'

# 3. Retry referensi SAMA → 200, transaksi sama (TIDAK double-credit)
curl -X POST http://localhost:3000/api/v1/tabungan/<tabunganId>/setor \
  -H "Content-Type: application/json" -d '{"nominal":500000,"referensi":"REF-002"}'

# 4. Cek saldo → tetap "500000" (bukan 1.000.000)
curl http://localhost:3000/api/v1/tabungan/<tabunganId>

# 5. Mutasi → 1 transaksi
curl http://localhost:3000/api/v1/tabungan/<tabunganId>/mutasi
```

### 7.6 Checklist Verifikasi Langkah 7

| Cek | Cara | Status |
|---|---|---|
| TypeScript compile clean | `npx tsc --noEmit` | ✅ |
| Tabel `transaksi` ter-create | pgAdmin | ✅ |
| Setor < minimum → 400 | curl test #1 | ✅ |
| Setor valid → 201 + saldo bertambah | curl test #2 | ✅ |
| Retry idempotent → 200, no double-credit | curl test #3 + #4 | ✅ |
| `$transaction` (saldo & transaksi konsisten) | curl test #4 vs #5 | ✅ |
| Mutasi → list transaksi | curl test #5 | ✅ |

✅ **Checkpoint Langkah 7**: setor saldo aman (atomic + idempotent), mutasi tampil. Inti Modul 2 (RESTful API + PostgreSQL) selesai.

### 7.7 Langkah Berikutnya

- **Langkah 8** — JWT auth: login, middleware proteksi, logout (lihat di bawah).
- Update Postman collection untuk endpoint tabungan & transaksi.
- Unit + integration test otomatis (DoD Jira THO-39 minta coverage > 80%, test rollback & replay).

## Langkah 8 — JWT Authentication (Login, Middleware Proteksi, Logout)

Menutup epic Jira **THO-27 (Keamanan & Auth)**: **THO-42** (Login JWT), **THO-43** (middleware `requireAuth`), **THO-44** (Logout). Sampai sini semua endpoint masih terbuka — siapa saja bisa buka rekening & setor. Langkah ini mengunci endpoint sensitif agar hanya bisa diakses user terautentikasi.

> **Keputusan desain (sprint ini):**
> 1. **Model `User` terpisah** dari `Nasabah` — pisah *identity* (email + password + role) dari *profil nasabah*. Mirip praktik perbankan nyata & mendukung role (`NASABAH`, `TELLER`, `ADMIN`).
> 2. **JWT stateless biasa** — logout di sisi client (hapus token). Lihat catatan jujur di 8.7 soal keterbatasannya terhadap AC "token invalid setelahnya".

### 8.1 Konsep Singkat

- **bcrypt** — password user **tidak pernah** disimpan plain text. Disimpan sebagai hash (`bcrypt.hash`). Saat login, bandingkan dengan `bcrypt.compare`.
- **JWT** — setelah login sukses, server bikin token signed berisi `sub` (user id) + `role`. Client kirim balik di header `Authorization: Bearer <token>` tiap request. Server cukup `jwt.verify` — **tidak perlu simpan session** (stateless).

```
login → bcrypt.compare → jwt.sign → client simpan token
request berikutnya → header Bearer → requireAuth (jwt.verify) → controller
```

### 8.2 Tambah Model `User` di `prisma/schema.prisma`

Tambah relasi `user` (opsional) di `Nasabah`, lalu model `User`:

```prisma
model Nasabah {
  // ... field sebelumnya ...
  user User? // 1 nasabah punya paling banyak 1 akun login

  @@map("nasabah")
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique @db.VarChar(150)
  passwordHash String   @map("password_hash")
  role         String   @default("NASABAH") @db.VarChar(20)
  nasabahId    String?  @unique @map("nasabah_id")
  nasabah      Nasabah? @relation(fields: [nasabahId], references: [id])
  createdAt    DateTime @default(now()) @map("created_at")

  @@map("users")
}
```

| Field | Fungsi |
|---|---|
| `passwordHash` | Hash bcrypt — **bukan** password asli |
| `role` | Otorisasi (RBAC) — bisa dipakai middleware `requireRole("ADMIN")` nanti |
| `nasabahId @unique` | Link 1-1 ke profil Nasabah; `?` karena admin/teller bisa tanpa profil nasabah |

Migrate:

```bash
npx prisma migrate dev --name add_user_auth
```

### 8.3 Cek `.env`

Pastikan dua baris ini ada (sudah disiapkan sejak Langkah 2.5):

```env
JWT_SECRET="ganti-dengan-string-random-panjang-min-32-karakter"
JWT_EXPIRES_IN="1h"
```

Nilai `JWT_SECRET` di atas hanya **placeholder** — jangan dipakai apa adanya. Generate string acak sungguhan (pilih salah satu):

```bash
# Opsi A — openssl (bawaan macOS/Linux)
openssl rand -base64 48

# Opsi B — node (tanpa tool tambahan)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Salin output-nya ke `.env`:

```env
JWT_SECRET="<tempel-hasil-generate-di-sini>"
```

> **Penting:** `JWT_SECRET` adalah kunci tanda tangan token. Kalau bocor, orang bisa bikin token palsu.
> - Minimal **32 karakter** — makin panjang makin aman.
> - **Jangan commit ke git** (`.env` sudah di-`.gitignore`).
> - Tiap environment (dev/staging/prod) idealnya pakai secret **berbeda**, disimpan di secret manager saat production.
> - Jangan pakai contoh secret yang pernah tampil di layar/chat — generate yang baru.

### 8.4 Modul Auth

```
src/modules/auth/
├── auth.schema.ts
├── auth.service.ts
├── auth.controller.ts
└── auth.routes.ts
```

**Schema (`auth.schema.ts`):**

```ts
import { z } from "zod";

export const RegisterSchema = z.object({
  email: z.string().email("Format email tidak valid").max(150),
  password: z.string().min(8, "Password minimal 8 karakter"),
  nasabahId: z.string().uuid().optional(), // link ke profil nasabah (opsional)
});

export const LoginSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
```

> **Catatan:** THO-42 hanya minta endpoint **login**, tapi untuk bisa login harus ada user dulu. Kita tambah `register` sebagai endpoint bantu (di dunia nyata, user dibuat saat onboarding nasabah / oleh admin).

**Service (`auth.service.ts`):**

```ts
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import type { RegisterInput, LoginInput } from "./auth.schema";

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ?? "1h") as jwt.SignOptions["expiresIn"];

export const authService = {
  async register(input: RegisterInput) {
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        nasabahId: input.nasabahId ?? null,
      },
    });
    // Jangan pernah balikin passwordHash ke client
    return { id: user.id, email: user.email, role: user.role };
  },

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    // Pesan error sengaja generik — jangan bocorkan "email tidak ada" vs "password salah"
    if (!user) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Email atau password salah");
    }
    const cocok = await bcrypt.compare(input.password, user.passwordHash);
    if (!cocok) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Email atau password salah");
    }

    const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });
    return { token, user: { id: user.id, email: user.email, role: user.role } };
  },
};
```

**Controller (`auth.controller.ts`):**

```ts
import type { Request, Response } from "express";
import { RegisterSchema, LoginSchema } from "./auth.schema";
import { authService } from "./auth.service";

export const authController = {
  // POST /api/auth/register
  async register(req: Request, res: Response) {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten().fieldErrors });
    }
    const user = await authService.register(parsed.data);
    return res.status(201).json(user);
  },

  // POST /api/auth/login
  async login(req: Request, res: Response) {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten().fieldErrors });
    }
    const result = await authService.login(parsed.data);
    return res.status(200).json(result);
  },

  // POST /api/auth/logout — lihat 8.7
  async logout(_req: Request, res: Response) {
    return res.status(200).json({ message: "Logout sukses. Hapus token di sisi client." });
  },
};
```

**Routes (`auth.routes.ts`):**

```ts
import { Router } from "express";
import { authController } from "./auth.controller";

export const authRoutes = Router();

authRoutes.post("/register", authController.register);
authRoutes.post("/login", authController.login);
authRoutes.post("/logout", authController.logout);
```

### 8.5 Middleware `requireAuth` (THO-43)

```ts
// src/middleware/requireAuth.ts
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "UNAUTHORIZED", message: "Token tidak ada" });
  }

  const token = header.slice(7); // buang "Bearer "
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; role: string };
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: "UNAUTHORIZED", message: "Token tidak valid atau kadaluarsa" });
  }
}
```

Supaya `req.user` dikenali TypeScript, tambah augmentasi tipe — `src/types/express.d.ts`:

```ts
import "express";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string };
    }
  }
}
```

### 8.6 Pasang Middleware + Mount Route di `src/index.ts`

```ts
import { authRoutes } from "./modules/auth/auth.routes";
import { requireAuth } from "./middleware/requireAuth";

// ... setelah /health ...

app.use("/api/auth", authRoutes);               // login/register/logout: PUBLIC

// Endpoint sensitif — wajib login. Pasang requireAuth sebelum router-nya.
app.use("/api/v1/tabungan", requireAuth, tabunganRoutes);

// Nasabah: GET boleh publik (opsional), tapi tulis (POST/PUT/DELETE) sebaiknya diproteksi.
// Untuk simpel, bisa proteksi semua: app.use("/api/v1/nasabah", requireAuth, nasabahRoutes);
app.use("/api/v1/nasabah", nasabahRoutes);
```

> **Urutan penting:** `requireAuth` ditaruh **sebelum** router. Kalau token invalid, request berhenti di middleware (401) — tidak sampai ke controller.

### 8.7 Logout (THO-44) — Catatan Jujur soal JWT Stateless

AC THO-44: *"token saya invalid setelahnya"*. Dengan **JWT stateless biasa** (pilihan sprint ini), server **tidak menyimpan** token, jadi secara teknis token **tetap valid sampai `exp`** walau user "logout". Endpoint `/api/auth/logout` di sini hanya memberi sinyal ke client untuk **menghapus token**.

Trade-off ini OK untuk training & token ber-`expiresIn` pendek (1 jam). Untuk benar-benar memenuhi AC, opsi peningkatan:

| Opsi | Cara | Trade-off |
|---|---|---|
| **Denylist token** | Simpan `jti` token yang di-logout ke tabel/Redis; `requireAuth` cek tiap request | Butuh storage, jadi semi-stateful |
| **Refresh token pendek** | Access token umur sangat pendek (mis. 5 menit) + refresh token yang bisa dicabut | Lebih kompleks, paling aman |

Mulai dari yang sekarang; naikkan ke denylist saat masuk fase hardening.

### 8.8 Test Endpoint

```bash
# 1. Register user (pakai <nasabahId> dari Langkah 5 untuk link, atau tanpa)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"budi@example.com","password":"rahasia123","nasabahId":"<nasabahId>"}'

# 2. Akses endpoint sensitif TANPA token → 401
curl -X POST http://localhost:3000/api/v1/tabungan \
  -H "Content-Type: application/json" -d '{"nasabahId":"<nasabahId>"}'

# 3. Login → dapat token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"budi@example.com","password":"rahasia123"}'
# Response: {"token":"eyJ...","user":{...}}

# 4. Akses endpoint sensitif DENGAN token → sukses
TOKEN="<token dari response #3>"
curl -X POST http://localhost:3000/api/v1/tabungan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"nasabahId":"<nasabahId>"}'

# 5. Login password salah → 401 INVALID_CREDENTIALS
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"budi@example.com","password":"salah"}'

# 6. Logout
curl -X POST http://localhost:3000/api/auth/logout -H "Authorization: Bearer $TOKEN"
```

### 8.9 Checklist Verifikasi Langkah 8

| Cek | Cara | Status |
|---|---|---|
| Tabel `users` ter-create | pgAdmin | ⏳ |
| Register → 201, password ter-hash (bukan plain) | curl #1 + cek kolom `password_hash` | ⏳ |
| Endpoint sensitif tanpa token → 401 | curl #2 | ⏳ |
| Login benar → 200 + token | curl #3 | ⏳ |
| Endpoint sensitif dengan token → sukses | curl #4 | ⏳ |
| Password salah → 401 generik | curl #5 | ⏳ |
| `req.user` terisi di controller (id + role) | log di controller | ⏳ |

✅ **Checkpoint Langkah 8 (target):** login menghasilkan JWT, endpoint tabungan & transaksi terkunci di belakang `requireAuth`, password tersimpan ter-hash.

### 8.10 Langkah Berikutnya

- **RBAC** — middleware `requireRole("ADMIN")` untuk aksi khusus admin/teller.
- **AuditLog** — catat tiap aksi sensitif (siapa, kapan, dari IP mana) ke tabel `audit_log`.
- **Logout kuat** — denylist token / refresh token (lihat 8.7).
- **Test otomatis** — unit test `authService.login` (bcrypt + jwt) & integration test middleware 401/200.

## Troubleshooting

### `password authentication failed for user "postgres"`

Cek password di `.env` — harus sama persis dengan yang di-set saat install PostgreSQL. Kalau lupa, reset via:

```bash
# macOS Homebrew
brew services stop postgresql@14
# edit ~/.../postgresql.conf, set authentication ke 'trust' sementara
# atau pakai pgAdmin GUI: klik kanan user postgres → Properties → Definition → set new password
```

### `relation does not exist`

Lupa run `npx prisma migrate dev` — schema belum di-apply ke database.

### Express 5 vs 4

Error `req.params` undefined di route → kemungkinan related ke breaking change Express 5. Workaround: downgrade `npm install express@4.21.2` atau adapt code.

### `npx prisma init` menambah baris DATABASE_URL duplikat

`prisma init` selalu append `DATABASE_URL="postgresql://johndoe:randompassword@..."` ke `.env`. Hapus baris baru tersebut — biarkan baris asli yang sudah benar.

### Vercel deployment — kenapa harus pakai Neon/Supabase, bukan Postgres self-hosted?

Vercel pakai arsitektur **serverless function** — tiap request bisa spawn instance baru. Postgres default max 100 connection — kalau traffic spike, connection pool habis cepat. Solusi:

- **Vercel Postgres** (powered by Neon) atau **Neon langsung** — HTTP-based driver, ramah serverless
- **Supabase** — punya connection pooler bawaan
- **PlanetScale** (MySQL serverless)
- **Prisma Data Proxy** kalau pakai Prisma

Untuk training kita tetap di lokal — pembahasan Vercel disimpan untuk modul deployment terpisah.

---

_Dibuat saat hands-on session Modul 2 — disimpan lokal sebagai catatan instruktur._
