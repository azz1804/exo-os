require("dotenv").config();
const fs = require("fs");
const path = require("path");

const NOTION_HEADERS = {
    "Authorization": `Bearer ${process.env.NOTION_API_KEY}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
};

const INBOX_DB = process.env.NOTION_DB_INBOX;
const CONTACTS_DB = process.env.NOTION_DB_CONTACTS;
const TASKS_DB = process.env.NOTION_DB_TASKS;

async function fetchWithRetry(url, options = {}, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000);
            const res = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeout);
            if (res.status === 429 || res.status >= 500) {
                if (attempt < retries) {
                    const delay = Math.pow(2, attempt) * 1000;
                    console.log(`   ⏳ API ${res.status} — retry ${attempt}/${retries}...`);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
            }
            return res;
        } catch (err) {
            if (attempt < retries) {
                await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
                continue;
            }
            throw err;
        }
    }
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));

// ── Archive toutes les pages d'une DB ──────────────────────
async function archiveAllPages(dbId, dbName) {
    console.log(`\n🗑️  Nettoyage de "${dbName}"...`);
    let cursor = undefined;
    let total = 0;

    do {
        const body = { page_size: 100 };
        if (cursor) body.start_cursor = cursor;

        const res = await fetchWithRetry(`https://api.notion.com/v1/databases/${dbId}/query`, {
            method: "POST",
            headers: NOTION_HEADERS,
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) {
            console.error(`   ❌ Erreur query ${dbName}: ${data.message}`);
            break;
        }

        for (const page of (data.results || [])) {
            const name = page.properties?.Name?.title?.[0]?.plain_text
                || page.properties?.["Nom du projet"]?.title?.[0]?.plain_text
                || page.properties?.Date?.title?.[0]?.plain_text
                || "(sans nom)";
            const archiveRes = await fetchWithRetry(`https://api.notion.com/v1/pages/${page.id}`, {
                method: "PATCH",
                headers: NOTION_HEADERS,
                body: JSON.stringify({ archived: true })
            });
            if (archiveRes.ok) {
                total++;
                console.log(`   🗑️  Archivé : ${name}`);
            } else {
                const err = await archiveRes.json();
                console.error(`   ❌ Archivage échoué (${name}): ${err.message}`);
            }
            await wait(100);
        }

        cursor = data.has_more ? data.next_cursor : null;
    } while (cursor);

    console.log(`   ✅ ${total} page(s) archivée(s) dans "${dbName}"`);
    return total;
}

// ── Nettoyer le contenu des fiches Contact (garder les pages) ──
async function cleanContactPages() {
    console.log(`\n🧹 Nettoyage du contenu des fiches Contact...`);
    let cursor = undefined;
    let totalPages = 0;
    let totalBlocks = 0;

    do {
        const body = { page_size: 100 };
        if (cursor) body.start_cursor = cursor;

        const res = await fetchWithRetry(`https://api.notion.com/v1/databases/${CONTACTS_DB}/query`, {
            method: "POST",
            headers: NOTION_HEADERS,
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) {
            console.error(`   ❌ Erreur query Contacts: ${data.message}`);
            break;
        }

        for (const page of (data.results || [])) {
            const pageName = page.properties?.Name?.title?.[0]?.plain_text || "(sans nom)";
            totalPages++;

            // 1. Supprimer tous les blocs de la page
            let blockCursor = undefined;
            const blockIds = [];

            do {
                const url = `https://api.notion.com/v1/blocks/${page.id}/children?page_size=100${blockCursor ? `&start_cursor=${blockCursor}` : ""}`;
                const blockRes = await fetchWithRetry(url, { headers: NOTION_HEADERS });
                const blockData = await blockRes.json();
                if (!blockRes.ok) break;

                for (const block of (blockData.results || [])) {
                    blockIds.push(block.id);
                }

                blockCursor = blockData.has_more ? blockData.next_cursor : null;
            } while (blockCursor);

            // Supprimer en ordre inverse pour éviter les problèmes d'index
            for (let i = blockIds.length - 1; i >= 0; i--) {
                const delRes = await fetchWithRetry(`https://api.notion.com/v1/blocks/${blockIds[i]}`, {
                    method: "DELETE",
                    headers: NOTION_HEADERS
                });
                if (delRes.ok) totalBlocks++;
                await wait(50);
            }

            // 2. Reset les propriétés dynamiques (garder Name, Numéro, E-mail)
            await fetchWithRetry(`https://api.notion.com/v1/pages/${page.id}`, {
                method: "PATCH",
                headers: NOTION_HEADERS,
                body: JSON.stringify({
                    properties: {
                        "Dernière interaction": { date: null },
                        "Nombre d'interactions": { number: 0 },
                        "Sujets récurrents": { rich_text: [] },
                        "Sentiment général": { select: null }
                    }
                })
            });

            if (blockIds.length > 0) {
                console.log(`   🧹 ${pageName} : ${blockIds.length} bloc(s) supprimé(s) + propriétés reset`);
            } else {
                console.log(`   ✅ ${pageName} : déjà vide`);
            }
        }

        cursor = data.has_more ? data.next_cursor : null;
    } while (cursor);

    console.log(`   ✅ ${totalBlocks} bloc(s) supprimé(s) sur ${totalPages} fiches Contact`);
}

// ── Trouver les DBs Projets, Journal, Événements via Notion Search ──
async function findCortexDatabases() {
    console.log("\n🔍 Recherche des bases Projets, Journal & Événements...");

    const res = await fetchWithRetry("https://api.notion.com/v1/search", {
        method: "POST",
        headers: NOTION_HEADERS,
        body: JSON.stringify({
            filter: { property: "object", value: "database" }
        })
    });
    const data = await res.json();
    if (!res.ok) {
        console.error(`   ❌ Erreur search: ${data.message}`);
        return {};
    }

    const dbs = {};
    for (const db of (data.results || [])) {
        const title = db.title?.[0]?.plain_text || "";
        if ((title.includes("Projets") || title.includes("Dossiers")) && !dbs.projets) {
            dbs.projets = db.id;
            console.log(`   📂 Projets & Dossiers : ${db.id}`);
        }
        if (title.includes("Journal") && !dbs.journal) {
            dbs.journal = db.id;
            console.log(`   📓 Journal : ${db.id}`);
        }
        if (title.includes("Événements") && !dbs.events) {
            dbs.events = db.id;
            console.log(`   📅 Événements : ${db.id}`);
        }
    }

    return dbs;
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
    console.log("🧹 CLEAN NOTION — Nettoyage complet (structure conservée)");
    console.log("=".repeat(60));
    console.log("  → Contacts : contenu supprimé, pages gardées");
    console.log("  → Inbox, Tâches, Projets, Journal, Événements : archivés");
    console.log("  → Hiérarchie Comet : conservée (catégories vides)");
    console.log("  → last_sync.json : remis à zéro");
    console.log("=".repeat(60));

    // 1. Trouver les DBs du Cortex
    const cortexDbs = await findCortexDatabases();

    // 2. Inbox
    if (INBOX_DB) await archiveAllPages(INBOX_DB, "Inbox");

    // 3. Contacts — nettoyer le contenu sans supprimer les pages
    if (CONTACTS_DB) await cleanContactPages();

    // 4. Tâches
    if (TASKS_DB) await archiveAllPages(TASKS_DB, "Tâches");

    // 5. Projets & Dossiers
    if (cortexDbs.projets) await archiveAllPages(cortexDbs.projets, "Projets & Dossiers");

    // 6. Journal
    if (cortexDbs.journal) await archiveAllPages(cortexDbs.journal, "Journal");

    // 7. Événements
    if (cortexDbs.events) await archiveAllPages(cortexDbs.events, "Événements");

    // 8. Reset last_sync.json
    const syncPath = path.join(__dirname, "last_sync.json");
    fs.writeFileSync(syncPath, JSON.stringify({}, null, 2));
    console.log("\n🔄 last_sync.json réinitialisé à {}");

    console.log("\n" + "=".repeat(60));
    console.log("✨ Nettoyage terminé ! Notion est prêt pour un test propre.");
    console.log("   → Contacts conservés (noms, numéros, emails) — contenu vidé");
    console.log("   → Hiérarchie Comet conservée (catégories vides)");
    console.log("   → Tout le reste archivé (récupérable dans la corbeille Notion 30j)");
    console.log("   → last_sync.json à zéro → prochain run re-fetche tout");
}

main().catch(err => {
    console.error("❌ Erreur critique:", err.message);
    process.exit(1);
});
