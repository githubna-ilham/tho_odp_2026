import { z } from 'zod';

export const CreateNasabahSchema = z.object({
  nik: z
    .string()
    .length(16, 'NIK harus tepat 16 digit')
    .regex(/^\d+$/, 'NIK harus angka'),
  nama: z.string().min(3, 'Nama minimal 3 karakter').max(100),
  email: z.string().email('Format email tidak valid').max(150),
  nomorHp: z
    .string()
    .regex(/^08\d{8,11}$/, 'Nomor HP harus format 08xxxxxxxxxx (10-13 digit)'),
});

export type CreateNasabahInput = z.infer<typeof CreateNasabahSchema>;

export const UpdateNasabahSchema = CreateNasabahSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Minimal satu field harus diisi' },
);

export type UpdateNasabahInput = z.infer<typeof UpdateNasabahSchema>;
