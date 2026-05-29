"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tabunganService = void 0;
const prisma_1 = require("../../lib/prisma");
const errors_1 = require("../../lib/errors");
function generateNomorRekening() {
    const random = Math.floor(Math.random() * 1e12)
        .toString()
        .padStart(12, '0');
    return `71${random}`;
}
exports.tabunganService = {
    // THO-38 — Buka rekening tabungan haji
    async buka(nasabahId) {
        const nasabah = await prisma_1.prisma.nasabah.findUnique({
            where: { id: nasabahId },
        });
        if (!nasabah) {
            throw new errors_1.AppError(403, 'NASABAH_NOT_REGISTERED', 'Harus daftar nasabah dulu');
        }
        const aktif = await prisma_1.prisma.tabunganHaji.findFirst({
            where: { nasabahId, status: 'AKTIF' },
        });
        if (aktif) {
            throw new errors_1.AppError(409, 'ALREADY_HAS_ACTIVE', 'Sudah punya tabungan haji aktif');
        }
        return prisma_1.prisma.tabunganHaji.create({
            data: { nasabahId, nomorRekening: generateNomorRekening() },
        });
    },
    // THO-40 — Lihat saldo & detail tabungan
    async detail(id) {
        const tabungan = await prisma_1.prisma.tabunganHaji.findUnique({
            where: { id },
            include: {
                nasabah: { select: { id: true, nama: true, nik: true } },
            },
        });
        if (!tabungan) {
            throw new errors_1.AppError(404, 'NOT_FOUND', 'Tabungan tidak ditemukan');
        }
        return tabungan;
    },
    // THO-41 — Lihat mutasi transaksi
    async mutasi(id) {
        const tabungan = await prisma_1.prisma.tabunganHaji.findUnique({ where: { id } });
        if (!tabungan) {
            throw new errors_1.AppError(404, 'NOT_FOUND', 'Tabungan tidak ditemukan');
        }
        return prisma_1.prisma.transaksi.findMany({
            where: { tabunganId: id },
            orderBy: { waktu: 'desc' },
        });
    },
    // THO-39 — Setor saldo (idempotent + DB transaction)
    async setor(tabunganId, input) {
        // Idempotency: referensi unik. Jika request dengan referensi yang sama
        // sudah pernah sukses, kembalikan hasil sebelumnya tanpa double-credit.
        const existing = await prisma_1.prisma.transaksi.findUnique({
            where: { referensi: input.referensi },
        });
        if (existing) {
            return { transaksi: existing, idempotent: true };
        }
        const nominal = BigInt(input.nominal);
        const transaksi = await prisma_1.prisma.$transaction(async (tx) => {
            const tabungan = await tx.tabunganHaji.findUnique({
                where: { id: tabunganId },
            });
            if (!tabungan) {
                throw new errors_1.AppError(404, 'NOT_FOUND', 'Tabungan tidak ditemukan');
            }
            if (tabungan.status !== 'AKTIF') {
                throw new errors_1.AppError(409, 'TABUNGAN_INACTIVE', 'Tabungan tidak aktif');
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
                    jenis: 'Setor QRIS',
                    nominal,
                    saldoSebelum,
                    saldoSesudah,
                    referensi: input.referensi,
                    metode: input.metode ?? 'QRIS',
                },
            });
        });
        return { transaksi, idempotent: false };
    },
};
