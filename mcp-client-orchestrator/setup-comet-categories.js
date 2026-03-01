require("dotenv").config();

const NOTION_HEADERS = {
    "Authorization": `Bearer ${process.env.NOTION_API_KEY}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
};

const CORTEX_PARENT_PAGE_ID = process.env.CORTEX_PARENT_PAGE_ID;

if (!CORTEX_PARENT_PAGE_ID) {
    console.error("ERREUR: CORTEX_PARENT_PAGE_ID manquant dans .env");
    process.exit(1);
}

const CATEGORIES = [
    "Marketing & Growth",
    "Vibe Coding & Dev",
    "Design & UX",
    "Politique & Géopolitique",
    "Business & Entrepreneuriat",
    "IA & Technologie",
    "Culture & Société",
];

const ENV_KEYS = [
    "COMET_CAT_MARKETING",
    "COMET_CAT_CODING",
    "COMET_CAT_DESIGN",
    "COMET_CAT_POLITICS",
    "COMET_CAT_BUSINESS",
    "COMET_CAT_AI",
    "COMET_CAT_CULTURE",
];

async function main() {
    console.log("📚 Création de la hiérarchie Comet dans Notion...\n");

    // 1. Créer la page parent "Recherches Comet"
    console.log("📂 Création de la page parent 'Recherches Comet'...");
    const parentRes = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: NOTION_HEADERS,
        body: JSON.stringify({
            parent: { page_id: CORTEX_PARENT_PAGE_ID },
            properties: {
                title: [{ text: { content: "📚 Recherches Comet" } }]
            },
            children: [{
                object: "block",
                type: "callout",
                callout: {
                    icon: { type: "emoji", emoji: "🔍" },
                    rich_text: [{ type: "text", text: { content: "Dossiers de recherche générés automatiquement par Comet. Organisés par catégorie." } }]
                }
            }]
        })
    });

    if (!parentRes.ok) {
        const err = await parentRes.json();
        console.error("❌ Création page parent échouée:", err.message);
        process.exit(1);
    }

    const parentPage = await parentRes.json();
    const parentId = parentPage.id;
    console.log(`   ✅ Page parent créée : ${parentId}\n`);

    // 2. Créer les sous-pages catégories
    const envLines = [`\n# 9. Comet — Hiérarchie des recherches`, `COMET_PARENT_PAGE_ID=${parentId}`];

    for (let i = 0; i < CATEGORIES.length; i++) {
        const category = CATEGORIES[i];
        const envKey = ENV_KEYS[i];

        console.log(`   📂 Création "${category}"...`);
        const catRes = await fetch("https://api.notion.com/v1/pages", {
            method: "POST",
            headers: NOTION_HEADERS,
            body: JSON.stringify({
                parent: { page_id: parentId },
                properties: {
                    title: [{ text: { content: `📂 ${category}` } }]
                }
            })
        });

        if (!catRes.ok) {
            const err = await catRes.json();
            console.error(`   ❌ Échec pour "${category}": ${err.message}`);
            continue;
        }

        const catPage = await catRes.json();
        console.log(`   ✅ ${category} → ${catPage.id}`);
        envLines.push(`${envKey}=${catPage.id}`);
    }

    // 3. Afficher les variables .env à copier
    console.log("\n" + "=".repeat(60));
    console.log("📋 Ajoutez ces lignes à votre .env :\n");
    console.log(envLines.join("\n"));
    console.log("\n" + "=".repeat(60));
    console.log("\n✨ Setup terminé ! Copiez les IDs ci-dessus dans votre .env.");
}

main().catch(err => {
    console.error("❌ Erreur critique:", err.message);
    process.exit(1);
});
