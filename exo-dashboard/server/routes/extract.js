import { Router } from 'express';
import Database from 'better-sqlite3';
import fs from 'fs';
import { PATHS } from '../paths.js';
import { getNotionHeaders } from '../lib/notion.js';

const router = Router();
const APPLE_EPOCH = 978307200;

function toAppleTimestamp(isoDate) {
    return Math.floor(new Date(isoDate).getTime() / 1000) - APPLE_EPOCH;
}

function splitTextIntoBlocks(text) {
    const chunks = [];
    for (let i = 0; i < text.length; i += 2000) {
        chunks.push(text.slice(i, i + 2000));
    }
    return chunks.map(chunk => ({
        object: 'block',
        type: 'paragraph',
        paragraph: {
            rich_text: [{ type: 'text', text: { content: chunk } }]
        }
    }));
}

// GET /api/extract/contacts — liste des contacts WhatsApp whitelistés
router.get('/contacts', (req, res) => {
    try {
        const db = new Database(PATHS.whatsappDb, { readonly: true });

        const rows = db.prepare(`
            SELECT DISTINCT ZCONTACTJID as jid, ZPARTNERNAME as name
            FROM ZWACHATSESSION
            WHERE (ZCONTACTJID LIKE '%@s.whatsapp.net' OR ZCONTACTJID LIKE '%@lid')
            AND ZCONTACTJID NOT LIKE '%@g.us'
            AND ZPARTNERNAME IS NOT NULL AND ZPARTNERNAME != ''
            ORDER BY ZPARTNERNAME ASC
        `).all();

        db.close();

        // Filtrer par la whitelist du config.json
        let contacts = rows;
        try {
            const config = JSON.parse(fs.readFileSync(PATHS.configs.whatsapp, 'utf8'));
            const whitelist = config.permissions?.contacts;
            if (whitelist && Array.isArray(whitelist) && !whitelist.includes('all') && whitelist.length > 0) {
                contacts = rows.filter(r =>
                    whitelist.some(w => r.jid.includes(w))
                );
            }
        } catch { }

        res.json(contacts.map(r => ({
            jid: r.jid,
            name: r.name,
            phone: r.jid.split('@')[0]
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/extract — extraire messages et push vers Notion Inbox
router.post('/', async (req, res) => {
    const { contact_jid, contact_name, since, until, keyword, include_links } = req.body;

    if (!contact_jid) {
        return res.status(400).json({ error: 'contact_jid requis' });
    }

    // Valider le JID contre la whitelist
    try {
        const config = JSON.parse(fs.readFileSync(PATHS.configs.whatsapp, 'utf8'));
        const whitelist = config.permissions?.contacts;
        if (whitelist && Array.isArray(whitelist) && !whitelist.includes('all') && whitelist.length > 0) {
            const allowed = whitelist.some(w => contact_jid.includes(w));
            if (!allowed) {
                return res.status(403).json({ error: 'Contact non autorisé' });
            }
        }
    } catch { }

    let db;
    try {
        db = new Database(PATHS.whatsappDb, { readonly: true });

        // Construire la query
        const messageTypes = include_links ? [0, 7] : [0];
        const placeholders = messageTypes.map(() => '?').join(',');

        let sql = `
            SELECT m.ZTEXT, m.ZMESSAGETYPE, m.ZISFROMME,
                datetime(m.ZMESSAGEDATE + ${APPLE_EPOCH}, 'unixepoch', 'localtime') as date,
                cs.ZCONTACTJID, cs.ZPARTNERNAME,
                mi.ZTITLE as link_title, mi.ZMEDIAURL as link_url
            FROM ZWAMESSAGE m
            LEFT JOIN ZWACHATSESSION cs ON cs.Z_PK = m.ZCHATSESSION
            LEFT JOIN ZWAMEDIAITEM mi ON mi.ZMESSAGE = m.Z_PK
            WHERE cs.ZCONTACTJID = ?
            AND m.ZMESSAGETYPE IN (${placeholders})
        `;
        const params = [contact_jid, ...messageTypes];

        if (since) {
            const ts = toAppleTimestamp(since);
            if (isNaN(ts)) return res.status(400).json({ error: 'Date "depuis" invalide' });
            sql += ` AND m.ZMESSAGEDATE > ?`;
            params.push(ts);
        }
        if (until) {
            const untilEnd = new Date(until);
            if (isNaN(untilEnd.getTime())) return res.status(400).json({ error: 'Date "jusqu\'au" invalide' });
            untilEnd.setHours(23, 59, 59);
            sql += ` AND m.ZMESSAGEDATE < ?`;
            params.push(toAppleTimestamp(untilEnd.toISOString()));
        }
        if (keyword) {
            sql += ` AND m.ZTEXT LIKE ?`;
            params.push(`%${keyword}%`);
        }

        sql += ` ORDER BY m.ZMESSAGEDATE ASC`;

        const rows = db.prepare(sql).all(...params);
        db.close();
        db = null;

        if (rows.length === 0) {
            return res.json({ ok: true, messageCount: 0, pageTitle: null });
        }

        // Formater les messages
        const lines = rows.map(row => {
            const name = row.ZPARTNERNAME || contact_name || 'Contact';
            const sender = row.ZISFROMME ? 'Moi' : name;
            const receiver = row.ZISFROMME ? name : 'Moi';
            let line = `[${row.date}] ${sender} → ${receiver}: ${row.ZTEXT || ''}`;

            if (row.ZMESSAGETYPE === 7 && row.link_url) {
                line += `\n   🔗 ${row.link_title || 'Lien'} — ${row.link_url}`;
            }
            return line;
        });

        const rawContent = lines.join('\n');

        // Construire le titre
        const name = contact_name || rows[0].ZPARTNERNAME || 'Contact';
        const dateRange = since && until
            ? `${formatDateFr(since)} – ${formatDateFr(until)}`
            : since
                ? `depuis ${formatDateFr(since)}`
                : until
                    ? `jusqu'au ${formatDateFr(until)}`
                    : new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

        const keywordSuffix = keyword ? ` (filtre: "${keyword}")` : '';
        const pageTitle = `Conversation WhatsApp — ${name} — ${dateRange}${keywordSuffix}`;

        // Push vers Notion Inbox
        const blocks = splitTextIntoBlocks(rawContent);
        const children = blocks.slice(0, 100);

        const notionRes = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: getNotionHeaders(),
            body: JSON.stringify({
                parent: { database_id: process.env.NOTION_DB_INBOX },
                properties: {
                    Name: { title: [{ text: { content: pageTitle } }] },
                    Source: { select: { name: 'whatsapp' } },
                    Statut: { select: { name: 'Nouveau' } }
                },
                children
            })
        });

        const notionData = await notionRes.json();

        if (!notionRes.ok) {
            return res.status(500).json({ error: `Notion: ${notionData.message || 'erreur'}` });
        }

        // Si plus de 100 blocks, append le reste avec vérification
        if (blocks.length > 100) {
            const pageId = notionData.id;
            for (let i = 100; i < blocks.length; i += 100) {
                const batch = blocks.slice(i, i + 100);
                const appendRes = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
                    method: 'PATCH',
                    headers: getNotionHeaders(),
                    body: JSON.stringify({ children: batch })
                });
                if (!appendRes.ok) {
                    const err = await appendRes.json();
                    console.error(`Erreur append batch ${i}: ${err.message}`);
                }
            }
        }

        const notionUrl = notionData.url || `https://notion.so/${notionData.id.replace(/-/g, '')}`;

        res.json({
            ok: true,
            pageTitle,
            messageCount: rows.length,
            notionUrl
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (db) try { db.close(); } catch { }
    }
});

function formatDateFr(isoDate) {
    return new Date(isoDate).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'short', year: 'numeric'
    });
}

export default router;
