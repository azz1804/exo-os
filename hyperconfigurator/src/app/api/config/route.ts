import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Définition des chemins absolus vers les configs MCP existants (1 cran plus haut dans l'arborescence)
const BASE_DIR = path.resolve(process.cwd(), '..');
const CONFIGS = {
    whatsapp: path.join(BASE_DIR, 'mcp-whatsapp-poc', 'config.json'),
    comet: path.join(BASE_DIR, 'mcp-comet-poc', 'config.json'),
    dev: path.join(BASE_DIR, 'mcp-dev-poc', 'config.json'),
};

export async function GET() {
    try {
        const data: Record<string, any> = {};

        // On boucle sur nos 3 configs pour renvoyer leur état actuel JSON complet
        for (const [key, filePath] of Object.entries(CONFIGS)) {
            try {
                const fileContent = await fs.readFile(filePath, 'utf-8');
                data[key] = JSON.parse(fileContent);
            } catch (e) {
                console.error(`Erreur lecture ${key} config:`, e);
                data[key] = null;
            }
        }

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to read configs' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { source, config } = body;

        // Vérifie si la source demandée est valide (whatsapp, comet, dev)
        if (!CONFIGS[source as keyof typeof CONFIGS]) {
            return NextResponse.json({ error: 'Source de configuration invalide' }, { status: 400 });
        }

        // Validation basique : config doit être un objet avec enabled (boolean) et permissions (object)
        if (typeof config !== 'object' || config === null || Array.isArray(config)) {
            return NextResponse.json({ error: 'Config invalide : objet attendu' }, { status: 400 });
        }
        if (typeof config.enabled !== 'boolean') {
            return NextResponse.json({ error: 'Config invalide : enabled doit être un booléen' }, { status: 400 });
        }
        if (typeof config.permissions !== 'object' || config.permissions === null) {
            return NextResponse.json({ error: 'Config invalide : permissions doit être un objet' }, { status: 400 });
        }

        const filePath = CONFIGS[source as keyof typeof CONFIGS];

        // Ecriture directe et formattée avec 2 espaces dans le fichier .json sourçant (Hyperconfigurator)
        await fs.writeFile(filePath, JSON.stringify(config, null, 4), 'utf-8');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Erreur de sauvegarde de configuration :", error);
        return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
    }
}
