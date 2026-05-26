import { prisma } from '../../lib/prisma';
import type {
  CreateNasabahInput,
  UpdateNasabahInput,
} from './nasabah.schema';

export const nasabahService = {
  create: (data: CreateNasabahInput) => prisma.nasabah.create({ data }),
  findAll: () => prisma.nasabah.findMany({ orderBy: { createdAt: 'desc' } }),
  findById: (id: string) => prisma.nasabah.findUnique({ where: { id } }),
  update: (id: string, data: UpdateNasabahInput) =>
    prisma.nasabah.update({ where: { id }, data }),
  remove: (id: string) => prisma.nasabah.delete({ where: { id } }),
};
