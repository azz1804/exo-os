import { Router } from 'express';
import fs from 'fs';
import { PATHS } from '../paths.js';

const router = Router();

router.get('/', (req, res) => {
    let syncState = {};
    try {
        syncState = JSON.parse(fs.readFileSync(PATHS.lastSync, 'utf8'));
    } catch { }

    const now = Date.now();
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    const FOUR_HOURS = 4 * 60 * 60 * 1000;

    const sourceStatus = (key, threshold = TWO_HOURS) => {
        const ts = syncState[key];
        if (!ts) return { lastSync: null, healthy: false, minutesAgo: null, status: 'never' };
        const diff = now - new Date(ts).getTime();
        return {
            lastSync: ts,
            healthy: diff < threshold,
            minutesAgo: Math.round(diff / 60000),
            status: diff < threshold ? 'ok' : 'missed'
        };
    };

    res.json({
        sources: {
            whatsapp: sourceStatus('whatsapp'),
            imessage: sourceStatus('imessage'),
            fathom: sourceStatus('fathom'),
            comet: sourceStatus('comet', FOUR_HOURS),
        }
    });
});

export default router;
