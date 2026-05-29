"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetorSchema = exports.BukaTabunganSchema = void 0;
const zod_1 = require("zod");
exports.BukaTabunganSchema = zod_1.z.object({
    nasabahId: zod_1.z.string().uuid('nasabahId harus UUID yang valid'),
});
exports.SetorSchema = zod_1.z.object({
    nominal: zod_1.z
        .number({ message: 'Nominal wajib berupa angka' })
        .int('Nominal harus bilangan bulat')
        .min(100000, 'Setoran minimum Rp 100.000'),
    referensi: zod_1.z
        .string()
        .min(1, 'Referensi (idempotency key) wajib diisi')
        .max(50),
    metode: zod_1.z.string().max(20).optional(),
});
