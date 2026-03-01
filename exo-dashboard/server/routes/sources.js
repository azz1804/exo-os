import { Router } from 'express';
import fs from 'fs';
import { PATHS } from '../paths.js';

const router = Router();

function readConfig(filePath) {
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null) return { enabled: true };
        return parsed;
    } catch (err) {
        if (err.code === 'ENOENT') return { enabled: true };
        // Fichier corrompu → ne PAS écraser, remonter l'erreur
        throw new Error(`Config corrompue: ${filePath}`);
    }
}

router.get('/', (req, res) => {
    try {
        res.json({
            whatsapp: { enabled: readConfig(PATHS.configs.whatsapp).enabled !== false },
            imessage: { enabled: readConfig(PATHS.configs.imessage).enabled !== false },
            fathom: { enabled: readConfig(PATHS.configs.fathom).enabled !== false },
            comet: { enabled: readConfig(PATHS.configs.comet).enabled !== false },
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', (req, res) => {
    const { source, enabled } = req.body;

    if (!['whatsapp', 'imessage', 'fathom', 'comet'].includes(source)) {
        return res.status(400).json({ error: 'Invalid source' });
    }
    if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'enabled must be a boolean' });
    }

    const configPath = PATHS.configs[source];
    const config = readConfig(configPath);
    config.enabled = enabled;

    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
        res.json({ ok: true, source, enabled });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
