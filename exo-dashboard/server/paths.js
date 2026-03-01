import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PATHS = {
    orchestratorDir: path.resolve(__dirname, '../../mcp-client-orchestrator'),
    lastSync: path.resolve(__dirname, '../../mcp-client-orchestrator/last_sync.json'),
    orchestratorLog: path.resolve(__dirname, '../../mcp-client-orchestrator/logs/orchestrator.log'),
    errorLog: path.resolve(__dirname, '../../mcp-client-orchestrator/logs/error.log'),
    whatsappDb: path.join(os.homedir(), 'Library', 'Group Containers', 'group.net.whatsapp.WhatsApp.shared', 'ChatStorage.sqlite'),
    configs: {
        whatsapp: path.resolve(__dirname, '../../mcp-whatsapp-poc/config.json'),
        imessage: path.resolve(__dirname, '../../mcp-imessage-poc/config.json'),
        fathom: path.resolve(__dirname, '../../mcp-client-orchestrator/fathom-config.json'),
        comet: path.resolve(__dirname, '../../mcp-comet-poc/config.json'),
    }
};
