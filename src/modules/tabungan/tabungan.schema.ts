import { z } from 'zod';

export const BukaTabunganSchema = z.object({
  nasabahId: z.string().uuid('nasabahId harus UUID yang valid'),
});

export type BukaTabunganInput = z.infer<typeof BukaTabunganSchema>;

export const SetorSchema = z.object({
  nominal: z
    .number({ message: 'Nominal wajib berupa angka' })
    .int('Nominal harus bilangan bulat')
    .min(100000, 'Setoran minimum Rp 100.000'),
  referensi: z
    .string()
    .min(1, 'Referensi (idempotency key) wajib diisi')
    .max(50),
  metode: z.string().max(20).optional(),
});

export type SetorInput = z.infer<typeof SetorSchema>;
