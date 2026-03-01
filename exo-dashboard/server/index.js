import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Charger les variables d'env de l'orchestrator AVANT tout import de routes
dotenv.config({ path: path.resolve(__dirname, '../../mcp-client-orchestrator/.env') });

const app = express();
app.use(express.json());

// Routes API (importées après dotenv)
const { default: statusRouter } = await import('./routes/status.js');
const { default: logsRouter } = await import('./routes/logs.js');
const { default: runRouter } = await import('./routes/run.js');
const { default: sourcesRouter } = await import('./routes/sources.js');
const { default: statsRouter } = await import('./routes/stats.js');
const { default: extractRouter } = await import('./routes/extract.js');

app.use('/api/status', statusRouter);
app.use('/api/logs', logsRouter);
app.use('/api/run', runRouter);
app.use('/api/sources', sourcesRouter);
app.use('/api/stats', statsRouter);
app.use('/api/extract', extractRouter);

// Global error handler
app.use((err, req, res, _next) => {
    console.error(err.stack || err.message);
    res.status(500).json({ error: 'Internal server error' });
});

// En production : servir le build Vite
if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, '../dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

const PORT = process.env.DASHBOARD_PORT || 3200;
app.listen(PORT, '127.0.0.1', () => {
    console.log(`Exo OS Dashboard API running on http://127.0.0.1:${PORT}`);
});
