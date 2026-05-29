"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tabunganController = void 0;
const tabungan_schema_1 = require("./tabungan.schema");
const tabungan_service_1 = require("./tabungan.service");
exports.tabunganController = {
    // POST /api/v1/tabungan
    async buka(req, res) {
        const parsed = tabungan_schema_1.BukaTabunganSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                details: parsed.error.flatten().fieldErrors,
            });
        }
        const tabungan = await tabungan_service_1.tabunganService.buka(parsed.data.nasabahId);
        return res.status(201).json(tabungan);
    },
    // GET /api/v1/tabungan/:id
    async detail(req, res) {
        const tabungan = await tabungan_service_1.tabunganService.detail(req.params.id);
        return res.status(200).json(tabungan);
    },
    // GET /api/v1/tabungan/:id/mutasi
    async mutasi(req, res) {
        const data = await tabungan_service_1.tabunganService.mutasi(req.params.id);
        return res.status(200).json({ data, total: data.length });
    },
    // POST /api/v1/tabungan/:id/setor
    async setor(req, res) {
        const parsed = tabungan_schema_1.SetorSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                details: parsed.error.flatten().fieldErrors,
            });
        }
        const { transaksi, idempotent } = await tabungan_service_1.tabunganService.setor(req.params.id, parsed.data);
        // Replay idempotent -> 200, setor baru -> 201
        return res.status(idempotent ? 200 : 201).json(transaksi);
    },
};
