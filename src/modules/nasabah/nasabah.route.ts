import { Router } from 'express';
import { nasabahController } from './nasabah.controller';

export const nasabahRoutes = Router();

nasabahRoutes.post('/', nasabahController.create);
nasabahRoutes.get('/', nasabahController.findAll);
nasabahRoutes.get('/:id', nasabahController.findById);
nasabahRoutes.put('/:id', nasabahController.update);
nasabahRoutes.delete('/:id', nasabahController.remove);
