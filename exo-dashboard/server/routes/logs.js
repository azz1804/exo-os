import { Router } from 'express';
import fs from 'fs';
import { PATHS } from '../paths.js';

const router = Router();

router.get('/', (req, res) => {
    const type = req.query.type === 'error' ? 'error' : 'orchestrator';
    const limit = Math.min(parseInt(req.query.lines) || 100, 500);
    const filePath = type === 'error' ? PATHS.errorLog : PATHS.orchestratorLog;

    try {
        const stat = fs.statSync(filePath);
        // Lire seulement les derniers 64KB au lieu de tout le fichier
        const TAIL_SIZE = 64 * 1024;
        const start = Math.max(0, stat.size - TAIL_SIZE);
        const fd = fs.openSync(filePath, 'r');
        const buf = Buffer.alloc(Math.min(stat.size, TAIL_SIZE));
        fs.readSync(fd, buf, 0, buf.length, start);
        fs.closeSync(fd);

        const content = buf.toString('utf8');
        const allLines = content.split('\n').filter(Boolean);
        // Si on a tronqué, la première ligne est probablement partielle → la retirer
        if (start > 0 && allLines.length > 0) allLines.shift();
        const lines = allLines.slice(-limit);

        res.json({
            lines,
            file: type === 'error' ? 'error.log' : 'orchestrator.log',
            totalLines: lines.length
        });
    } catch (err) {
        if (err.code === 'ENOENT') {
            res.json({ lines: [], file: type + '.log', totalLines: 0 });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

export default router;
