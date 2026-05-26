import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { CreateNasabahSchema, UpdateNasabahSchema } from './nasabah.schema';
import { nasabahService } from './nasabah.service';

function handlePrismaError(err: unknown, res: Response): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const field = (err.meta?.target as string[])?.[0] ?? 'field';
      res.status(409).json({
        error: 'DUPLICATE_ENTRY',
        message: `${field} sudah terdaftar`,
      });
      return true;
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Nasabah tidak ditemukan',
      });
      return true;
    }
  }
  return false;
}

export const nasabahController = {
  async create(req: Request, res: Response) {
    const parsed = CreateNasabahSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const nasabah = await nasabahService.create(parsed.data);
      return res.status(201).json(nasabah);
    } catch (err) {
      if (handlePrismaError(err, res)) return;
      throw err;
    }
  },

  async findAll(req: Request, res: Response) {
    const data = await nasabahService.findAll();
    return res.status(200).json({
      data,
      total: data.length,
    });
  },

  async findById(req: Request, res: Response) {
    const nasabah = await nasabahService.findById(req.params.id as string);
    if (!nasabah) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Nasabah tidak ditemukan',
      });
    }
    return res.status(200).json(nasabah);
  },

  async update(req: Request, res: Response) {
    const parsed = UpdateNasabahSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const nasabah = await nasabahService.update(
        req.params.id as string,
        parsed.data,
      );
      return res.status(200).json(nasabah);
    } catch (err) {
      if (handlePrismaError(err, res)) return;
      throw err;
    }
  },

  async remove(req: Request, res: Response) {
    try {
      await nasabahService.remove(req.params.id as string);
      return res.status(204).send();
    } catch (err) {
      if (handlePrismaError(err, res)) return;
      throw err;
    }
  },
};
