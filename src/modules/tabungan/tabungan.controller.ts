import type { Request, Response } from 'express';
import { BukaTabunganSchema, SetorSchema } from './tabungan.schema';
import { tabunganService } from './tabungan.service';

export const tabunganController = {
  // POST /api/v1/tabungan
  async buka(req: Request, res: Response) {
    const parsed = BukaTabunganSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const tabungan = await tabunganService.buka(parsed.data.nasabahId);
    return res.status(201).json(tabungan);
  },

  // GET /api/v1/tabungan/:id
  async detail(req: Request, res: Response) {
    const tabungan = await tabunganService.detail(req.params.id as string);
    return res.status(200).json(tabungan);
  },

  // GET /api/v1/tabungan/:id/mutasi
  async mutasi(req: Request, res: Response) {
    const data = await tabunganService.mutasi(req.params.id as string);
    return res.status(200).json({ data, total: data.length });
  },

  // POST /api/v1/tabungan/:id/setor
  async setor(req: Request, res: Response) {
    const parsed = SetorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { transaksi, idempotent } = await tabunganService.setor(
      req.params.id as string,
      parsed.data,
    );
    // Replay idempotent -> 200, setor baru -> 201
    return res.status(idempotent ? 200 : 201).json(transaksi);
  },
};
