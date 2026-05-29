"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
require("./lib/bigint");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const client_1 = require("@prisma/client");
const errors_1 = require("./lib/errors");
const nasabah_routes_1 = require("./modules/nasabah/nasabah.routes");
const tabungan_routes_1 = require("./modules/tabungan/tabungan.routes");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'tabungan-haji-api',
        timestamp: new Date().toISOString(),
    });
});
app.use('/api/v1/nasabah', nasabah_routes_1.nasabahRoutes);
app.use('/api/v1/tabungan', tabungan_routes_1.tabunganRoutes);
const errorHandler = (err, _req, res, _next) => {
    if (err instanceof errors_1.AppError) {
        return res.status(err.statusCode).json({
            error: err.code,
            message: err.message,
        });
    }
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
            const field = err.meta?.target?.[0] ?? 'field';
            return res.status(409).json({
                error: 'DUPLICATE_ENTRY',
                message: `${field} sudah terdaftar`,
            });
        }
        if (err.code === 'P2025') {
            return res.status(404).json({
                error: 'NOT_FOUND',
                message: 'Data tidak ditemukan',
            });
        }
    }
    console.error(err);
    return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Terjadi kesalahan pada server',
    });
};
app.use(errorHandler);
app.listen(PORT, () => {
    console.log(`Example app listening on port ${PORT}`);
});
