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

const dbPath = path.join(os.homedir(), "Library", "Messages", "chat.db");

const server = new Server(
    { name: "imessage-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
);

// --- Database helper ---
function queryDatabase(sql, params) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                reject(new Error(`Failed to open iMessage database: ${err.message}`));
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

// --- Decode attributedBody (macOS Ventura+) ---
function decodeAttributedBody(buffer) {
    if (!buffer) return null;
    try {
        const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
        // Find NSString marker \x01+ then read length + text
        const marker = Buffer.from([0x01, 0x2B]);
        const idx = data.indexOf(marker);
        if (idx === -1) return null;

        let pos = idx + 2;
        let length = data[pos];

        if (length === 0x81) {
            // Next 1 byte is the length
            length = data[pos + 1];
            pos += 2;
        } else if (length === 0x82) {
            // Next 2 bytes are the length (big-endian)
            length = data.readUInt16BE(pos + 1);
            pos += 3;
        } else {
            pos += 1;
        }

        const text = data.subarray(pos, pos + length).toString("utf-8");
        // Clean: remove trailing NSDict/NSArchiver metadata that leaks into text
        // Cut at first non-printable control character (except newlines/tabs)
        const cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x80-\x9F\uFFFD].*/s, "").trim();
        return cleaned || null;
    } catch (e) {
        return null;
    }
}

// --- Register tools ---
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "get_latest_imessages",
                description: "Retrieves the latest iMessage/SMS messages from the local Messages database.",
                inputSchema: {
                    type: "object",
                    properties: {
                        limit: {
                            type: "number",
                            description: "Number of messages to retrieve (default: 100)",
                            default: 100
                        },
                        contact: {
                            type: "string",
                            description: "Optional phone number or email to filter by a specific contact."
                        },
                        since: {
                            type: "string",
                            description: "ISO date string. Only return messages after this timestamp."
                        }
                    }
                }
            },
            {
                name: "list_imessage_contacts",
                description: "Lists all iMessage/SMS contacts from the local Messages database.",
                inputSchema: {
                    type: "object",
                    properties: {}
                }
            }
        ]
    };
});

// --- Handle tool calls ---
server.setRequestHandler(CallToolRequestSchema, async (request) => {

    if (request.params.name === "get_latest_imessages") {
        // Reload config
        try {
            config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
        } catch (e) { }

        if (config.enabled === false) {
            return { content: [{ type: "text", text: "Source désactivée dans config.json" }] };
        }

        let limit = request.params.arguments?.limit || 100;
        if (config.permissions?.max_messages) {
            limit = Math.min(limit, config.permissions.max_messages);
        }
        const contactFilter = request.params.arguments?.contact;
        const since = request.params.arguments?.since;

        // Build query — COALESCE text and attributedBody
        let query = `
            SELECT
                m.ROWID,
                m.text,
                m.attributedBody,
                m.is_from_me,
                m.date,
                m.service,
                datetime(m.date / 1000000000 + strftime('%s', '2001-01-01'), 'unixepoch', 'localtime') as date_local,
                h.id as contact_id
            FROM message m
            LEFT JOIN handle h ON m.handle_id = h.ROWID
            WHERE (m.text IS NOT NULL OR m.attributedBody IS NOT NULL)
        `;
        const params = [];

        // Filter: since timestamp
        if (since) {
            const sinceDate = new Date(since);
            const appleEpochNano = (sinceDate.getTime() / 1000 - 978307200) * 1000000000;
            query += ` AND m.date > ?`;
            params.push(appleEpochNano);
        }

        // Filter: max age
        if (config.permissions?.max_age_hours) {
            const maxAgeNano = config.permissions.max_age_hours * 3600 * 1000000000;
            query += ` AND m.date > ((strftime('%s', 'now') - strftime('%s', '2001-01-01')) * 1000000000 - ?)`;
            params.push(maxAgeNano);
        }

        // Filter: specific contact
        if (contactFilter) {
            query += ` AND h.id LIKE ?`;
            params.push(`%${contactFilter}%`);
        }

        // Filter: contact whitelist
        if (config.permissions?.contacts
            && Array.isArray(config.permissions.contacts)
            && !config.permissions.contacts.includes("all")
            && config.permissions.contacts.length > 0) {
            const conditions = config.permissions.contacts.map(() => `h.id LIKE ?`).join(" OR ");
            query += ` AND (${conditions})`;
            for (const c of config.permissions.contacts) {
                params.push(`%${c}%`);
            }
        }

        // Filter: SMS
        if (config.permissions?.include_sms === false) {
            query += ` AND m.service = 'iMessage'`;
        }

        // Filter: exclude contacts
        if (config.permissions?.exclude_contacts?.length > 0) {
            for (const ex of config.permissions.exclude_contacts) {
                query += ` AND h.id NOT LIKE ?`;
                params.push(`%${ex}%`);
            }
        }

        // Filter: group chats
        if (config.permissions?.include_group_chats === false) {
            query += ` AND m.cache_roomnames IS NULL`;
        }

        query += ` ORDER BY m.date DESC LIMIT ?`;
        params.push(limit);

        try {
            const rows = await queryDatabase(query, params);

            const formattedMessages = rows.map(row => {
                // Decode message text
                let messageText = row.text;
                if (!messageText || messageText.trim() === "") {
                    messageText = decodeAttributedBody(row.attributedBody);
                }
                if (!messageText || messageText.trim() === "") return null;

                // Skip system/empty messages
                if (messageText.startsWith("\ufffc")) return null;

                const contact = row.contact_id || "Inconnu";
                const sender = row.is_from_me === 1 ? "Moi" : `${contact}`;
                const receiver = row.is_from_me === 1 ? `${contact}` : "Moi";

                return `[${row.date_local}] ${sender} → ${receiver}: ${messageText}`;
            }).filter(Boolean);

            // Reverse for chronological order (oldest first)
            formattedMessages.reverse();

            return {
                content: [{
                    type: "text",
                    text: formattedMessages.length > 0
                        ? formattedMessages.join("\n")
                        : "No messages found."
                }]
            };
        } catch (error) {
            return {
                isError: true,
                content: [{ type: "text", text: `Error accessing iMessage database: ${error.message}` }]
            };
        }
    }

    if (request.params.name === "list_imessage_contacts") {
        try {
            const rows = await queryDatabase(`
                SELECT h.id, h.service, COUNT(m.ROWID) as msg_count
                FROM handle h
                JOIN message m ON m.handle_id = h.ROWID
                GROUP BY h.id
                HAVING msg_count > 0
                ORDER BY msg_count DESC
            `, []);

            const contacts = rows.map(r => ({
                id: r.id,
                service: r.service,
                message_count: r.msg_count
            }));

            return {
                content: [{ type: "text", text: JSON.stringify(contacts) }]
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

// --- Run ---
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("iMessage MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
