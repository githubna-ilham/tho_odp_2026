import { Router } from 'express';
import { tabunganController } from './tabungan.controller';

export const tabunganRoutes = Router();

tabunganRoutes.post('/', tabunganController.buka);
tabunganRoutes.get('/:id', tabunganController.detail);
tabunganRoutes.get('/:id/mutasi', tabunganController.mutasi);
tabunganRoutes.post('/:id/setor', tabunganController.setor);
