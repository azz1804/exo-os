require("dotenv").config();
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const path = require("path");
const fs = require("fs");

// --- Config ---

const SERVERS = {
    whatsapp: path.resolve(__dirname, "../mcp-whatsapp-poc/server.js"),
    imessage: path.resolve(__dirname, "../mcp-imessage-poc/server.js"),
    comet: path.resolve(__dirname, "../mcp-comet-poc/server.js"),
};

const LOCKFILE = path.join(__dirname, "orchestrator.lock");
const SYNC_STATE_PATH = path.join(__dirname, "last_sync.json");
const INBOX_DB = process.env.NOTION_DB_INBOX;
const FATHOM_API_KEY = process.env.FATHOM_API_KEY;

const NOTION_HEADERS = {
    "Authorization": `Bearer ${process.env.NOTION_API_KEY}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
};

// --- Sync State ---

function getSyncState() {
    try { return JSON.parse(fs.readFileSync(SYNC_STATE_PATH, "utf8")); }
    catch { return {}; }
}

function saveSyncState(state) {
    fs.writeFileSync(SYNC_STATE_PATH, JSON.stringify(state, null, 2));
}

// --- Fetch avec retry ---

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
            if (attempt < retries && (err.name === 'AbortError' || err.code === 'ECONNRESET')) {
                const delay = Math.pow(2, attempt) * 1000;
                console.log(`   ⏳ Timeout — retry ${attempt}/${retries}...`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            throw err;
        }
    }
}

// --- Utilitaires ---

function splitTextIntoBlocks(text) {
    const maxLen = 2000;
    const blocks = [];
    let rest = text;
    while (rest.length > 0) {
        blocks.push({
            object: "block", type: "paragraph",
            paragraph: { rich_text: [{ type: "text", text: { content: rest.slice(0, maxLen) } }] }
        });
        rest = rest.slice(maxLen);
    }
    return blocks;
}

function withTimeout(promise, ms, label) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout ${label} après ${ms / 1000}s`)), ms))
    ]);
}

// --- MCP ---

async function connectAndCallMCP(name, scriptPath, toolName, toolArgs) {
    console.log(`🔌 Extraction des données via MCP [${name}]...`);
    const transport = new StdioClientTransport({ command: "node", args: [scriptPath] });
    const mcpClient = new Client({ name: `exo-tuyau-${name}`, version: "1.0.0" }, { capabilities: {} });

    try {
        await withTimeout(mcpClient.connect(transport), 30000, `connect ${name}`);
        const result = await withTimeout(mcpClient.callTool({ name: toolName, arguments: toolArgs }), 60000, `callTool ${name}`);
        const text = result.content?.[0]?.text;
        if (!text || text === "No messages found." || text === "No recent searches found.") {
            console.log(`ℹ️ Source [${name}] vide.`);
            return null;
        }
        return text;
    } catch (err) {
        console.log(`⚠️ Source [${name}] inaccessible : ${err.message}`);
        return null;
    } finally {
        try { await mcpClient.close(); } catch { }
    }
}

// --- Notion Inbox ---

async function createNotionInboxPage(sourceName, rawContent) {
    if (!INBOX_DB) {
        console.warn("⚠️ NOTION_DB_INBOX manquant dans .env");
        return;
    }

    const today = new Date().toISOString().split('T')[0];
    const title = `Log ${sourceName.toUpperCase()} — ${today}`;

    try {
        const blocks = splitTextIntoBlocks(rawContent);
        const res = await fetchWithRetry("https://api.notion.com/v1/pages", {
            method: "POST",
            headers: NOTION_HEADERS,
            body: JSON.stringify({
                parent: { database_id: INBOX_DB },
                properties: {
                    "Name": { title: [{ text: { content: title } }] },
                    "Source": { select: { name: sourceName } },
                    "Statut": { select: { name: "Nouveau" } }
                },
                children: blocks.slice(0, 100),
            })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || "Erreur Notion");
        }
        console.log(`✅ Inbox : ${title}`);
    } catch (error) {
        console.error(`❌ Erreur Inbox (${sourceName}) : ${error.message}`);
    }
}

// --- Fathom ---

async function fetchAndPushFathom(lastSync) {
    if (!FATHOM_API_KEY) {
        console.log("ℹ️ FATHOM_API_KEY non définie — Fathom désactivé.");
        return;
    }

    try {
        const fathomConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "fathom-config.json"), "utf8"));
        if (fathomConfig.enabled === false) { console.log("ℹ️ Fathom désactivé via config."); return; }
    } catch { }

    console.log("📞 Récupération des appels Fathom...");

    const params = new URLSearchParams({ include_transcript: "true" });
    if (lastSync) params.set("created_after", lastSync);

    const res = await fetchWithRetry(`https://api.fathom.ai/external/v1/meetings?${params}`, {
        headers: { "X-Api-Key": FATHOM_API_KEY }
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(`Fathom API : ${err.message || res.statusText}`);
    }

    const data = await res.json();
    const calls = data.items || [];

    if (calls.length === 0) {
        console.log("ℹ️ Aucun nouvel appel Fathom.");
        return;
    }

    calls.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    console.log(`📞 ${calls.length} appel(s) trouvé(s) — push vers Inbox...`);

    for (const call of calls) {
        if (!call.transcript || call.transcript.length === 0) {
            console.log(`   ⏭️ "${call.title}" — pas de transcript.`);
            continue;
        }

        const callDate = call.created_at?.split('T')[0] || "date inconnue";
        const participants = (call.calendar_invitees || []).map(p => p.name || p.email);
        const transcript = call.transcript.map(t =>
            `[${t.start_time || ""}] ${t.speaker_name || "Inconnu"}: ${t.text}`
        ).join('\n');

        const content = `📞 ${call.title}\n📅 ${callDate}\n👥 ${participants.join(", ") || "Participants inconnus"}\n\n--- TRANSCRIPT ---\n${transcript}`;
        await createNotionInboxPage("fathom", content);
    }
}

// --- Comet ---

async function fetchAndPushComet(syncState, fetchTimestamp) {
    const cometSync = syncState.comet || null;
    const COMET_INTERVAL_MS = 3 * 60 * 60 * 1000;
    const cometAge = cometSync ? Date.now() - new Date(cometSync).getTime() : Infinity;

    if (cometAge < COMET_INTERVAL_MS) {
        console.log(`🔍 Comet : prochain sync dans ${Math.round((COMET_INTERVAL_MS - cometAge) / 60000)} min.`);
        return;
    }

    console.log(`🔍 Aspiration Comet ${cometSync ? `depuis ${cometSync}` : "(premier sync — dernières 24h)"}...`);

    try {
        const cometConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../mcp-comet-poc/config.json"), "utf8"));
        if (cometConfig.enabled === false) {
            console.log("ℹ️ Comet désactivé via config.");
            return;
        }
    } catch { }

    const cometArgs = { limit: 500 };
    if (cometSync) cometArgs.since = cometSync;
    const searchArgs = { limit: 200 };
    if (cometSync) searchArgs.since = cometSync;

    const [browsingData, searchData] = await Promise.all([
        connectAndCallMCP("comet", SERVERS.comet, "get_browsing_history", cometArgs),
        connectAndCallMCP("comet-search", SERVERS.comet, "get_search_terms", searchArgs),
    ]);

    if (browsingData || searchData) {
        const content = [
            browsingData ? `--- HISTORIQUE DE NAVIGATION ---\n${browsingData}` : null,
            searchData ? `--- TERMES DE RECHERCHE ---\n${searchData}` : null,
        ].filter(Boolean).join('\n\n');

        await createNotionInboxPage("comet", content);

        const state = getSyncState();
        state.comet = fetchTimestamp;
        saveSyncState(state);
        console.log("💾 Sync Comet sauvegardé.");
    }
}

// --- Main ---

async function main() {
    console.log("🚀 Exo OS — Tuyau d'ingestion\n");

    if (!process.env.NOTION_API_KEY || !INBOX_DB) {
        console.error("🛑 NOTION_API_KEY et NOTION_DB_INBOX requis dans .env !");
        process.exit(1);
    }

    // Lockfile
    if (fs.existsSync(LOCKFILE)) {
        const lockAge = Date.now() - fs.statSync(LOCKFILE).mtimeMs;
        if (lockAge < 10 * 60 * 1000) {
            console.error("🔒 Déjà en cours. Abandon.");
            process.exit(0);
        }
        console.log("⚠️ Lock périmé, nettoyage...");
    }
    fs.writeFileSync(LOCKFILE, String(process.pid));

    try {
        const syncState = getSyncState();
        const fetchTimestamp = new Date().toISOString();

        // 1. WhatsApp + iMessage en parallèle
        const whatsappSync = syncState.whatsapp || null;
        const imessageSync = syncState.imessage || null;

        console.log(`📥 WhatsApp ${whatsappSync ? `depuis ${whatsappSync}` : "(premier sync — 24h)"}...`);
        console.log(`📱 iMessage ${imessageSync ? `depuis ${imessageSync}` : "(premier sync — 24h)"}...`);

        const mcpArgs = { limit: 1000 };
        if (whatsappSync) mcpArgs.since = whatsappSync;
        const imessageArgs = { limit: 1000 };
        if (imessageSync) imessageArgs.since = imessageSync;

        const [whatsappData, imessageData] = await Promise.all([
            connectAndCallMCP("whatsapp", SERVERS.whatsapp, "get_latest_whatsapp_messages", mcpArgs),
            connectAndCallMCP("imessage", SERVERS.imessage, "get_latest_imessages", imessageArgs),
        ]);

        // 2. Push vers Inbox
        if (whatsappData) {
            await createNotionInboxPage("whatsapp", whatsappData);
            const state = getSyncState();
            state.whatsapp = fetchTimestamp;
            saveSyncState(state);
            console.log("💾 Sync WhatsApp sauvegardé.");
        }

        if (imessageData) {
            await createNotionInboxPage("imessage", imessageData);
            const state = getSyncState();
            state.imessage = fetchTimestamp;
            saveSyncState(state);
            console.log("💾 Sync iMessage sauvegardé.");
        }

        // 3. Fathom → Inbox
        const fathomSync = syncState.fathom || null;
        await fetchAndPushFathom(fathomSync);
        if (FATHOM_API_KEY) {
            const state = getSyncState();
            state.fathom = fetchTimestamp;
            saveSyncState(state);
            console.log("💾 Sync Fathom sauvegardé.");
        }

        // 4. Comet → Inbox
        await fetchAndPushComet(syncState, fetchTimestamp);

        console.log("\n✨ Ingestion terminée. Les agents Notion prennent le relais.");
    } finally {
        try { fs.unlinkSync(LOCKFILE); } catch { }
    }
}

main().catch(error => {
    console.error("Erreur critique:", error);
    try { fs.unlinkSync(LOCKFILE); } catch { }
    process.exit(1);
});
