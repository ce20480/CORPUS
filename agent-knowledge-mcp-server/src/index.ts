#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { KnowledgeDatabase } from './database.js';
import { registerShareTool } from './tools/share.js';
import { registerRetrieveTool } from './tools/retrieve.js';
import { registerUpdateTool } from './tools/update.js';
import { registerDeleteTools } from './tools/delete.js';
import { registerKnowledgeResources } from './resources/knowledge.js';
import { registerWorkflowPrompts } from './prompts/workflows.js';

// Logging to stderr (stdout reserved for JSON-RPC)
function log(message: string): void {
  console.error(`[agent-knowledge-mcp] ${message}`);
}

async function main() {
  try {
    log('Initializing agent knowledge MCP server...');

    // Initialize database
    const db = new KnowledgeDatabase();
    log('Database initialized');

    // Create MCP server
    const server = new McpServer(
      {
        name: 'agent-knowledge-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    // Register all capabilities BEFORE connect()
    log('Registering tools...');
    registerShareTool(server, db);
    registerRetrieveTool(server, db);
    registerUpdateTool(server, db);
    registerDeleteTools(server, db);
    log('Tools registered: agent_knowledge_share, agent_knowledge_retrieve, agent_knowledge_update, agent_knowledge_delete, agent_knowledge_delete_feature, agent_knowledge_delete_all');

    log('Registering resources...');
    registerKnowledgeResources(server, db);
    log('Resources registered: knowledge://features, knowledge://{feature}, knowledge://{feature}/{id}');

    log('Registering prompts...');
    registerWorkflowPrompts(server);
    log('Prompts registered: share_knowledge_workflow, find_related_knowledge, orchestrate_feature');

    // Connect via stdio transport
    log('Connecting to stdio transport...');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log('Server connected and ready');

    // Handle cleanup on exit
    process.on('SIGINT', async () => {
      log('Received SIGINT, shutting down...');
      db.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      log('Received SIGTERM, shutting down...');
      db.close();
      process.exit(0);
    });
  } catch (error) {
    log(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

main();
