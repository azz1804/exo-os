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

const dbPath = path.join(
    os.homedir(),
    "Library",
    "Group Containers",
    "group.net.whatsapp.WhatsApp.shared",
    "ChatStorage.sqlite"
);

const server = new Server(
    {
        name: "whatsapp-mcp",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Helper function to query the database
function queryDatabase(sql, params) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                reject(new Error(`Failed to open WhatsApp database: ${err.message}`));
                return;
            }
            db.configure("busyTimeout", 5000);
            db.all(sql, params, (queryErr, rows) => {
                db.close();
                if (queryErr) reject(queryErr);
                else resolve(rows);
            });
        });
    });
}

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "get_latest_whatsapp_messages",
                description: "Retrieves the latest text messages from the local WhatsApp Desktop database.",
                inputSchema: {
                    type: "object",
                    properties: {
                        limit: {
                            type: "number",
                            description: "Number of messages to retrieve (default: 20)",
                            default: 20
                        },
                        contact_id: {
                            type: "string",
                            description: "Optional WhatsApp ID (JID/LID) to filter messages by a specific person."
                        },
                        since: {
                            type: "string",
                            description: "ISO date string (e.g. '2026-02-22T10:00:00'). Only return messages after this timestamp."
                        }
                    }
                },
            },
            {
                name: "list_whatsapp_contacts",
                description: "Retrieves the list of known individual WhatsApp contacts from the local database.",
                inputSchema: {
                    type: "object",
                    properties: {}
                }
            }
        ],
    };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "get_latest_whatsapp_messages") {
        try {
            const configContent = fs.readFileSync(path.join(__dirname, "config.json"), "utf8");
            config = JSON.parse(configContent);
        } catch (e) { }

        if (config.enabled === false) {
            return { content: [{ type: "text", text: "Source désactivée dans config.json" }] };
        }

        let limit = request.params.arguments?.limit || 20;
        if (config.permissions?.max_messages) {
            limit = Math.min(limit, config.permissions.max_messages);
        }
        const contactId = request.params.arguments?.contact_id;
        const since = request.params.arguments?.since;

        // Base query — JOIN via ZCHATSESSION (fonctionne avec JIDs classiques ET LIDs)
        let query = `
      SELECT
          m.ZTEXT as message,
          m.ZISFROMME as is_from_me,
          datetime(m.ZMESSAGEDATE + 978307200, 'unixepoch', 'localtime') as date,
          m.ZFROMJID as from_id,
          m.ZTOJID as to_id,
          cs.ZCONTACTJID as chat_jid,
          cs.ZPARTNERNAME as contact_name
      FROM ZWAMESSAGE m
      LEFT JOIN ZWACHATSESSION cs ON cs.Z_PK = m.ZCHATSESSION
      WHERE m.ZTEXT IS NOT NULL
      AND m.ZTEXT != ''
    `;
        const params = [];

        // Add filter if contact is specified
        if (contactId) {
            query += ` AND (cs.ZCONTACTJID LIKE ? OR m.ZFROMJID LIKE ? OR m.ZTOJID LIKE ?)`;
            params.push(`%${contactId}%`, `%${contactId}%`, `%${contactId}%`);
        }

        // Filtre temporel : uniquement les messages après le dernier sync
        if (since) {
            const sinceUnix = Math.floor(new Date(since).getTime() / 1000) - 978307200;
            query += ` AND m.ZMESSAGEDATE > ?`;
            params.push(sinceUnix);
        }

        if (config.permissions) {
            // Whitelist de contacts : matcher via la session de chat
            if (config.permissions.contacts
                && Array.isArray(config.permissions.contacts)
                && !config.permissions.contacts.includes("all")
                && config.permissions.contacts.length > 0) {
                const jids = config.permissions.contacts.map(c =>
                    c.includes('@') ? c : `${c}@s.whatsapp.net`
                );
                const placeholders = jids.map(() => '?').join(',');
                query += ` AND cs.ZCONTACTJID IN (${placeholders})`;
                params.push(...jids);
            }

            if (config.permissions.max_age_hours) {
                query += ` AND m.ZMESSAGEDATE > (strftime('%s', 'now') - 978307200 - ?)`;
                params.push(config.permissions.max_age_hours * 3600);
            }
            if (config.permissions.include_group_chats === false) {
                query += ` AND cs.ZCONTACTJID NOT LIKE '%@g.us'`;
            }
            if (config.permissions.exclude_contacts && config.permissions.exclude_contacts.length > 0) {
                const excludeConditions = config.permissions.exclude_contacts.map(() =>
                    `(cs.ZCONTACTJID NOT LIKE ? AND COALESCE(m.ZFROMJID,'') NOT LIKE ? AND COALESCE(m.ZTOJID,'') NOT LIKE ?)`
                ).join(' AND ');
                query += ` AND ${excludeConditions}`;
                for (const ex of config.permissions.exclude_contacts) {
                    params.push(`%${ex}%`, `%${ex}%`, `%${ex}%`);
                }
            }
        }

        query += ` ORDER BY m.ZMESSAGEDATE DESC LIMIT ?;`;
        params.push(limit);

        try {
            const rows = await queryDatabase(query, params);

            const formattedMessages = rows.map(row => {
                const contactLabel = row.contact_name
                    ? `${row.contact_name} [${row.chat_jid}]`
                    : (row.chat_jid || 'Inconnu');
                let sender, receiver;
                if (row.is_from_me === 1) {
                    sender = 'Moi';
                    receiver = contactLabel;
                } else {
                    sender = contactLabel;
                    receiver = 'Moi';
                }
                return `[${row.date}] ${sender} → ${receiver}: ${row.message}`;
            });

            // Inverser pour ordre chronologique (plus ancien en premier)
            formattedMessages.reverse();

            return {
                content: [
                    {
                        type: "text",
                        text: formattedMessages.join('\n') || "No messages found.",
                    },
                ],
            };
        } catch (error) {
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: `Error accessing WhatsApp database: ${error.message}`
                    }
                ]
            }
        }
    }

    if (request.params.name === "list_whatsapp_contacts") {
        let query = `
            SELECT DISTINCT
                ZCONTACTJID as jid,
                ZPARTNERNAME as name
            FROM ZWACHATSESSION
            WHERE (ZCONTACTJID LIKE '%@s.whatsapp.net' OR ZCONTACTJID LIKE '%@lid')
            AND ZCONTACTJID NOT LIKE '%@g.us'
            AND ZPARTNERNAME IS NOT NULL
            AND ZPARTNERNAME != ''
            ORDER BY ZPARTNERNAME ASC
        `;
        try {
            const rows = await queryDatabase(query, []);
            const contacts = rows.map(r => ({
                jid: r.jid,
                name: r.name,
                phone: r.jid.split('@')[0]
            }));
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(contacts)
                    }
                ]
            };
        } catch (error) {
            return {
                isError: true,
                content: [{ type: "text", text: `Error listing contacts: ${error.message}` }]
            };
        }
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
});

// Run server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("WhatsApp MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
