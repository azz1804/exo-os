import { Router } from 'express';
import { getNotionHeaders } from '../lib/notion.js';

const router = Router();

let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function countPages(dbId, filter = undefined) {
    let total = 0;
    let cursor = undefined;
    let iterations = 0;
    const MAX_ITERATIONS = 50; // garde-fou contre boucle infinie
    do {
        const body = { page_size: 100 };
        if (filter) body.filter = filter;
        if (cursor) body.start_cursor = cursor;

        const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
            method: 'POST',
            headers: getNotionHeaders(),
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) break;
        const count = (data.results || []).length;
        if (count === 0) break; // pas de résultats → stop
        total += count;
        cursor = data.has_more ? data.next_cursor : null;
        iterations++;
    } while (cursor && iterations < MAX_ITERATIONS);
    return total;
}

router.get('/', async (req, res) => {
    // Servir depuis le cache si frais
    if (cache.data && (Date.now() - cache.timestamp) < CACHE_TTL) {
        return res.json(cache.data);
    }

    const contactsDb = process.env.NOTION_DB_CONTACTS;
    const tasksDb = process.env.NOTION_DB_TASKS;
    const inboxDb = process.env.NOTION_DB_INBOX;

    if (!contactsDb || !tasksDb || !process.env.NOTION_API_KEY) {
        return res.json({ contacts: { total: 0 }, tasks: { total: 0, pending: 0 }, dossiers: { total: 0 } });
    }

    try {
        const promises = [
            countPages(contactsDb),
            countPages(tasksDb),
            countPages(tasksDb, { property: 'Statut', select: { equals: 'À faire' } }),
        ];
        if (inboxDb) {
            promises.push(countPages(inboxDb, { property: 'Source', select: { equals: 'comet' } }));
        }

        const [contactsTotal, tasksTotal, tasksPending, dossiersTotal] = await Promise.all(promises);

        const data = {
            contacts: { total: contactsTotal },
            tasks: { total: tasksTotal, pending: tasksPending },
            dossiers: { total: dossiersTotal || 0 }
        };

        cache = { data, timestamp: Date.now() };
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
