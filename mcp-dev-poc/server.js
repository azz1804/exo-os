#!/usr/bin/env node

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const simpleGit = require("simple-git");
const path = require("path");
const fs = require("fs");
const os = require("os");


let config = { enabled: true };
try {
    const configContent = fs.readFileSync(path.join(__dirname, "config.json"), "utf8");
    config = JSON.parse(configContent);
} catch (e) { }

const server = new Server(
    {
        name: "dev-mcp",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "get_current_coding_context",
                description: "Retrieves the current developer context from a given local Git repository path (latest commits, uncommitted changes, current branch).",
                inputSchema: {
                    type: "object",
                    properties: {
                        repo_path: {
                            type: "string",
                            description: "Absolute path to the local Git repository",
                        },
                        limit: {
                            type: "number",
                            description: "Number of recent commits to retrieve (default: 5)",
                            default: 5
                        }
                    },
                    required: ["repo_path"]
                },
            },
        ],
    };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "get_current_coding_context") {
        try {
            const configContent = fs.readFileSync(path.join(__dirname, "config.json"), "utf8");
            config = JSON.parse(configContent);
        } catch (e) { }

        if (config.enabled === false) {
            return { content: [{ type: "text", text: "Source désactivée dans config.json" }] };
        }

        let repoPath = request.params.arguments.repo_path;

        // Resolve ~ to home directory if present
        if (repoPath.startsWith('~')) {
            repoPath = path.join(os.homedir(), repoPath.slice(1));
        }

        if (config.permissions && config.permissions.repos && config.permissions.repos.length > 0) {
            if (!config.permissions.repos.includes(repoPath)) {
                return { isError: true, content: [{ type: "text", text: "Accès au repository non autorisé par config.json" }] };
            }
        }

        let limit = Math.min(request.params.arguments?.limit || 5, 20);
        if (config.permissions?.max_commits) {
            limit = Math.min(limit, config.permissions.max_commits);
        }

        if (!fs.existsSync(repoPath)) {
            return {
                isError: true,
                content: [{ type: "text", text: `Path does not exist: ${repoPath}` }]
            };
        }

        try {
            const git = simpleGit(repoPath);

            const isRepo = await git.checkIsRepo();
            if (!isRepo) {
                return {
                    isError: true,
                    content: [{ type: "text", text: `Path is not a Git repository: ${repoPath}` }]
                };
            }

            // Get current branch
            const branchSummary = await git.branch();
            const currentBranch = branchSummary.current;

            // Get latest commits
            const logSummary = await git.log({ maxCount: limit });
            const recentCommits = logSummary.all.map(c => `[${c.date}] ${c.author_name}: ${c.message}`).join('\n');

            // Get uncommitted changes (status)
            const statusSummary = await git.status();
            const modifiedFiles = statusSummary.modified.length > 0 ? statusSummary.modified.join(', ') : 'None';
            const newFiles = statusSummary.not_added.length > 0 ? statusSummary.not_added.join(', ') : 'None';

            let diffText = "";
            if (config.permissions?.include_diffs) {
                try {
                    diffText = await git.diff();
                } catch (e) { }
            }

            let todosText = "";
            if (config.permissions?.include_todos) {
                try {
                    const { execFileSync } = require("child_process");
                    const grepResult = execFileSync("grep", [
                        "-r", "-E", "TODO|FIXME",
                        repoPath,
                        "--exclude-dir=node_modules",
                        "--exclude-dir=.git",
                        "-m", "50"
                    ], { encoding: "utf-8", timeout: 5000 });
                    todosText = grepResult;
                } catch (e) { }
            }

            const report = `
=== DEV CONTEXT FOR: ${repoPath} ===
Branch: ${currentBranch}

[Uncommitted Changes]
Modified: ${modifiedFiles}
New/Untracked: ${newFiles}
${diffText ? '\n[Diff]\n' + diffText.slice(0, 1500) + '...' : ''}

[Recent Commits]
${recentCommits || 'No commits yet.'}
${todosText ? '\n[TODOs]\n' + todosText : ''}
      `.trim();

            return {
                content: [
                    {
                        type: "text",
                        text: report,
                    },
                ],
            };
        } catch (error) {
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: `Error accessing Git repository: ${error.message}`
                    }
                ]
            }
        }
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
});

// Run server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Dev MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
