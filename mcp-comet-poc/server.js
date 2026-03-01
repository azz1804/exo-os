#!/usr/bin/env node

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const os = require("os");
const fs = require("fs");

let config = { enabled: true };
try {
    const configContent = fs.readFileSync(path.join(__dirname, "config.json"), "utf8");
    config = JSON.parse(configContent);
} catch (e) { }

// Comet (Chromium-based) — même schéma que Chrome
const originalDbPath = path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "Comet",
    "Default",
    "History"
);

// Copie locale pour éviter "Database is locked"
const dbCopyPath = path.join(__dirname, "History_copy.sqlite");

const server = new Server(
    {
        name: "comet-mcp",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Chrome epoch : microsecondes depuis le 1er janvier 1601
// Conversion → Unix seconds : (timestamp / 1_000_000) - 11_644_473_600
const CHROME_EPOCH_OFFSET = 11644473600;

function chromeTimeToISO(chromeTimestamp) {
    const unixSecs = (chromeTimestamp / 1000000) - CHROME_EPOCH_OFFSET;
    return new Date(unixSecs * 1000).toISOString();
}

function isoToChromeTime(isoDate) {
    const unixSecs = Math.floor(new Date(isoDate).getTime() / 1000);
    return (unixSecs + CHROME_EPOCH_OFFSET) * 1000000;
}

// Helper : copier la DB puis query
async function queryDatabase(sql, params) {
    return new Promise((resolve, reject) => {
        try {
            fs.copyFileSync(originalDbPath, dbCopyPath);
        } catch (err) {
            reject(new Error(`Failed to copy History DB: ${err.message}`));
            return;
        }

        const db = new sqlite3.Database(dbCopyPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                reject(new Error(`Failed to open DB copy: ${err.message}`));
                return;
            }
        });

        db.all(sql, params, (err, rows) => {
            db.close();
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Appliquer les filtres communs (exclude_domains, max_age)
function applyCommonFilters(config, params) {
    let filters = "";
    if (config.permissions) {
        if (config.permissions.exclude_domains && config.permissions.exclude_domains.length > 0) {
            for (const domain of config.permissions.exclude_domains) {
                filters += ` AND u.url NOT LIKE ?`;
                params.push(`%${domain}%`);
            }
        }
    }
    return filters;
}

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "get_browsing_history",
                description: "Retrieves the full browsing history (all pages visited) from the Comet browser, with visit duration.",
                inputSchema: {
                    type: "object",
                    properties: {
                        limit: {
                            type: "number",
                            description: "Number of history items to retrieve (default: 200)",
                            default: 200
                        },
                        since: {
                            type: "string",
                            description: "ISO date string. Only return visits after this timestamp."
                        },
                        min_duration_secs: {
                            type: "number",
                            description: "Minimum visit duration in seconds (default: 5). Filters out quick page loads.",
                            default: 5
                        }
                    }
                },
            },
            {
                name: "get_search_terms",
                description: "Retrieves recent search queries typed in the browser (Google, Perplexity, etc.) with clean terms extracted from keyword_search_terms.",
                inputSchema: {
                    type: "object",
                    properties: {
                        limit: {
                            type: "number",
                            description: "Number of search terms to retrieve (default: 100)",
                            default: 100
                        },
                        since: {
                            type: "string",
                            description: "ISO date string. Only return searches after this timestamp."
                        }
                    }
                },
            },
        ],
    };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    // Reload config à chaque appel
    try {
        const configContent = fs.readFileSync(path.join(__dirname, "config.json"), "utf8");
        config = JSON.parse(configContent);
    } catch (e) { }

    if (config.enabled === false) {
        return { content: [{ type: "text", text: "Source désactivée dans config.json" }] };
    }

    // ==========================================
    // TOOL: get_browsing_history
    // ==========================================
    if (request.params.name === "get_browsing_history") {
        let limit = Math.min(request.params.arguments?.limit || 200, 500);
        if (config.permissions?.max_entries) {
            limit = Math.min(limit, config.permissions.max_entries);
        }
        const minDuration = request.params.arguments?.min_duration_secs
            ?? (config.permissions?.min_visit_duration_secs ?? 5);
        const since = request.params.arguments?.since;

        let query = `
            SELECT u.url, u.title, u.visit_count,
                datetime((v.visit_time / 1000000) - ${CHROME_EPOCH_OFFSET}, 'unixepoch', 'localtime') as date,
                v.visit_duration / 1000000 as duration_secs
            FROM visits v
            JOIN urls u ON u.id = v.url
            WHERE u.title IS NOT NULL AND u.title != ''
        `;
        const params = [];

        if (since) {
            const sinceChromeTime = isoToChromeTime(since);
            query += ` AND v.visit_time > ?`;
            params.push(sinceChromeTime);
        } else if (config.permissions?.max_age_hours) {
            const maxAgeMicros = config.permissions.max_age_hours * 3600 * 1000000;
            query += ` AND v.visit_time > (strftime('%s', 'now') + ${CHROME_EPOCH_OFFSET}) * 1000000 - ?`;
            params.push(maxAgeMicros);
        }

        if (minDuration > 0) {
            query += ` AND v.visit_duration > ?`;
            params.push(minDuration * 1000000);
        }

        query += applyCommonFilters(config, params);
        query += ` ORDER BY v.visit_time DESC LIMIT ?`;
        params.push(limit);

        try {
            const rows = await queryDatabase(query, params);

            const formatted = rows.map(row =>
                `[${row.date}] (${row.duration_secs}s) "${row.title}" | ${row.url}`
            ).join('\n');

            return {
                content: [{
                    type: "text",
                    text: formatted || "No browsing history found.",
                }],
            };
        } catch (error) {
            return {
                isError: true,
                content: [{ type: "text", text: `Error accessing browsing history: ${error.message}` }]
            };
        }
    }

    // ==========================================
    // TOOL: get_search_terms
    // ==========================================
    if (request.params.name === "get_search_terms") {
        let limit = Math.min(request.params.arguments?.limit || 100, 500);
        if (config.permissions?.max_entries) {
            limit = Math.min(limit, config.permissions.max_entries);
        }
        const since = request.params.arguments?.since;

        let query = `
            SELECT kst.term,
                u.url, u.title,
                datetime((u.last_visit_time / 1000000) - ${CHROME_EPOCH_OFFSET}, 'unixepoch', 'localtime') as date
            FROM keyword_search_terms kst
            JOIN urls u ON u.id = kst.url_id
            WHERE 1=1
        `;
        const params = [];

        if (since) {
            const sinceChromeTime = isoToChromeTime(since);
            query += ` AND u.last_visit_time > ?`;
            params.push(sinceChromeTime);
        } else if (config.permissions?.max_age_hours) {
            const maxAgeMicros = config.permissions.max_age_hours * 3600 * 1000000;
            query += ` AND u.last_visit_time > (strftime('%s', 'now') + ${CHROME_EPOCH_OFFSET}) * 1000000 - ?`;
            params.push(maxAgeMicros);
        }

        query += ` ORDER BY u.last_visit_time DESC LIMIT ?`;
        params.push(limit);

        try {
            const rows = await queryDatabase(query, params);

            const formatted = rows.map(row =>
                `[${row.date}] Search: "${row.term}" → ${row.title} | ${row.url}`
            ).join('\n');

            return {
                content: [{
                    type: "text",
                    text: formatted || "No search terms found.",
                }],
            };
        } catch (error) {
            return {
                isError: true,
                content: [{ type: "text", text: `Error accessing search terms: ${error.message}` }]
            };
        }
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
});

// Run server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Comet MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
