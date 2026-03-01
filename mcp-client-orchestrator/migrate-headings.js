require("dotenv").config();

const NOTION_HEADERS = {
    "Authorization": `Bearer ${process.env.NOTION_API_KEY}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
};

const CONTACTS_DB = process.env.NOTION_DB_CONTACTS;

if (!CONTACTS_DB) {
    console.error("ERREUR: NOTION_DB_CONTACTS manquant dans .env");
    process.exit(1);
}

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

async function main() {
    console.log("🔄 Migration heading_2 → heading_3 sur toutes les fiches Contact...\n");

    let totalMigrated = 0;
    let totalPages = 0;
    let cursor = undefined;

    // Parcourir toutes les pages de la DB Contacts
    do {
        const body = { page_size: 50 };
        if (cursor) body.start_cursor = cursor;

        const queryRes = await fetchWithRetry(`https://api.notion.com/v1/databases/${CONTACTS_DB}/query`, {
            method: "POST",
            headers: NOTION_HEADERS,
            body: JSON.stringify(body)
        });
        const result = await queryRes.json();
        if (!queryRes.ok) {
            console.error("❌ Erreur query Contacts:", result.message);
            break;
        }

        for (const page of (result.results || [])) {
            const pageName = page.properties?.Name?.title?.[0]?.plain_text || "(sans nom)";
            totalPages++;

            // Fetch les blocs de cette page
            let blockCursor = undefined;
            let pageMigrated = 0;

            do {
                const url = `https://api.notion.com/v1/blocks/${page.id}/children?page_size=100${blockCursor ? `&start_cursor=${blockCursor}` : ""}`;
                const blockRes = await fetchWithRetry(url, { headers: NOTION_HEADERS });
                const blockData = await blockRes.json();
                if (!blockRes.ok) break;

                for (const block of (blockData.results || [])) {
                    if (block.type === "heading_2") {
                        const text = block.heading_2?.rich_text?.[0]?.plain_text || "";

                        // PATCH vers heading_3
                        const patchRes = await fetchWithRetry(`https://api.notion.com/v1/blocks/${block.id}`, {
                            method: "PATCH",
                            headers: NOTION_HEADERS,
                            body: JSON.stringify({
                                heading_3: {
                                    rich_text: [{ type: "text", text: { content: text } }]
                                }
                            })
                        });

                        if (patchRes.ok) {
                            pageMigrated++;
                            totalMigrated++;
                        } else {
                            const err = await patchRes.json();
                            console.error(`   ❌ Bloc ${block.id} : ${err.message}`);
                        }
                    }
                }

                blockCursor = blockData.has_more ? blockData.next_cursor : null;
            } while (blockCursor);

            if (pageMigrated > 0) {
                console.log(`   ✅ ${pageName} : ${pageMigrated} heading(s) migré(s)`);
            }
        }

        cursor = result.has_more ? result.next_cursor : null;
    } while (cursor);

    console.log(`\n✨ Migration terminée : ${totalMigrated} heading_2 → heading_3 sur ${totalPages} fiches Contact.`);
}

main().catch(err => {
    console.error("❌ Erreur critique:", err.message);
    process.exit(1);
});
