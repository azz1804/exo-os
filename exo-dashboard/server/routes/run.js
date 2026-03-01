import { Router } from 'express';
import { spawn } from 'child_process';
import { PATHS } from '../paths.js';

const router = Router();

let currentRun = null;

router.post('/', (req, res) => {
    if (currentRun && currentRun.running) {
        return res.status(409).json({ error: 'already_running', pid: currentRun.pid });
    }

    const output = [];
    const child = spawn('node', ['orchestrator.js'], {
        cwd: PATHS.orchestratorDir,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    currentRun = {
        running: true,
        pid: child.pid,
        startedAt: new Date().toISOString(),
        exitCode: null,
        output
    };

    child.stdout.on('data', (data) => output.push(data.toString()));
    child.stderr.on('data', (data) => output.push(data.toString()));

    child.on('close', (code) => {
        currentRun.running = false;
        currentRun.exitCode = code;
    });

    child.on('error', (err) => {
        currentRun.running = false;
        currentRun.exitCode = -1;
        output.push(`Process error: ${err.message}`);
    });

    res.json({ started: true, pid: child.pid });
});

router.get('/status', (req, res) => {
    if (!currentRun) {
        return res.json({ running: false, lastRun: null });
    }

    res.json({
        running: currentRun.running,
        pid: currentRun.pid,
        startedAt: currentRun.startedAt,
        exitCode: currentRun.exitCode,
        output: currentRun.output.join('')
    });
});

export default router;
