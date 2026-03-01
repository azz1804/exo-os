import { NextResponse } from 'next/server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
    const mcpServerPath = path.resolve(process.cwd(), '..', 'mcp-whatsapp-poc', 'server.js');
    const configPath = path.resolve(process.cwd(), '..', 'mcp-whatsapp-poc', 'config.json');

    const transport = new StdioClientTransport({
        command: 'node',
        args: [mcpServerPath]
    });

    const client = new Client(
        {
            name: 'hyperconfigurator-client',
            version: '1.0.0',
        },
        {
            capabilities: {},
        }
    );

    try {
        // Connexion au serveur MCP (spawn du process)
        await client.connect(transport);

        // Call du nouveau tool sans arguments
        const result = await client.callTool({
            name: 'list_whatsapp_contacts',
            arguments: {}
        });

        let contacts = [];
        const mcpContent = result.content as any[];
        if (mcpContent && mcpContent.length > 0 && mcpContent[0].type === 'text') {
            try {
                contacts = JSON.parse(mcpContent[0].text);
            } catch (parseError) {
                console.error("Erreur de parsing JSON du tool MCP:", parseError);
            }
        }

        // Lecture du config.json pour voir l'état actuel des permissions "contacts"
        let authorized: string[] = ["all"];
        try {
            const configRaw = await fs.readFile(configPath, 'utf-8');
            const config = JSON.parse(configRaw);
            if (config.permissions?.contacts && Array.isArray(config.permissions.contacts)) {
                authorized = config.permissions.contacts;
            }
        } catch (fsError) {
            console.error("Erreur lecture config WhatsApp:", fsError);
        }

        return NextResponse.json({ contacts, authorized });
    } catch (error) {
        console.error("Erreur d'exécution du MCP pour les contacts:", error);
        return NextResponse.json({ error: 'Failed to fetch WhatsApp contacts via MCP.' }, { status: 500 });
    } finally {
        try { await client.close(); } catch (_) {}
    }
}
