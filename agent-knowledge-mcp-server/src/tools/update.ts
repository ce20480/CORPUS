import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { KnowledgeDatabase } from '../database.js';
import { handleDatabaseError } from '../utils/errors.js';

export function registerUpdateTool(server: McpServer, db: KnowledgeDatabase): void {
  server.registerTool(
    'agent_knowledge_update',
    {
      title: 'Update Existing Knowledge Entry',
      description: `Update an existing knowledge entry by ID to refine or correct previously shared knowledge.

Use this tool when you need to revise, enhance, or correct knowledge that was previously shared to the corpus. This updates the summary and/or metadata of an existing entry while preserving the original ID, agent, and feature. The timestamp is updated to reflect when the modification was made.

Args:
  - id (string): Unique ID of the knowledge entry to update. You can get IDs from agent_knowledge_retrieve. Example: "1698765432000-abc123"

  - summary (string): Updated summary text. This completely replaces the previous summary. Include all relevant information as the old summary will be overwritten. Minimum 10 characters.

  - metadata (object, optional): Updated metadata object. If provided, this replaces the entire previous metadata. If omitted, the previous metadata is preserved.

Returns:
  JSON object with schema:
  {
    "status": "success" | "not_found",
    "id": string,              // Entry ID that was updated
    "feature": string,         // Feature slug (unchanged)
    "agent": string,           // Agent name (unchanged)
    "timestamp": string,       // New timestamp of the update
    "message": string          // Confirmation message
  }

Examples:
  - Use when: "I need to add more details to my previous knowledge entry"
    -> agent_knowledge_update(id="1698765432000-abc123", summary="Enhanced version with additional details about implementation...")

  - Use when: "I need to fix incorrect information I shared"
    -> agent_knowledge_update(id="1698765432000-abc123", summary="Corrected: The API actually uses OAuth 2.1, not 2.0...")

  - Use when: "I want to add metadata to an existing entry"
    -> agent_knowledge_update(id="1698765432000-abc123", summary="[same summary]", metadata={files: ["new-file.ts"], status: "completed"})

  - Don't use when: Sharing new knowledge (use agent_knowledge_share instead)
  - Don't use when: You don't have the entry ID (retrieve it first with agent_knowledge_retrieve)
  - Don't use when: The entry doesn't exist (you'll get a not_found status)

Error Handling:
  - If ID not found: Returns status="not_found" with helpful message to verify ID or use agent_knowledge_retrieve
  - If summary too short (<10 chars): Returns validation error asking for more detail
  - If database update fails: Returns specific error with suggested action
  - Note: You cannot change the agent or feature of an existing entry`,
      inputSchema: {
        id: z.string()
          .min(1, 'Entry ID is required')
          .describe('ID of the knowledge entry to update'),
        summary: z.string()
          .min(10, 'Summary must be at least 10 characters - provide detailed information')
          .describe('Updated summary text that will replace the previous summary'),
        metadata: z.record(z.any())
          .optional()
          .describe('Updated metadata (completely replaces previous metadata if provided)'),
      },
      outputSchema: {
        status: z.enum(['success', 'not_found']),
        id: z.string().optional(),
        feature: z.string().optional(),
        agent: z.string().optional(),
        timestamp: z.string().optional(),
        message: z.string(),
      },
      annotations: {
        readOnlyHint: false,      // Modifies database
        destructiveHint: false,   // Updates existing data but doesn't delete
        idempotentHint: true,     // Same update with same params has same effect
        openWorldHint: false,     // Closed system (local database)
      },
    },
    async ({ id, summary, metadata }) => {
      try {
        const updated = db.update(id, summary, metadata);

        if (!updated) {
          const output = {
            status: 'not_found' as const,
            message: `Knowledge entry with ID "${id}" not found. Verify the ID is correct or use agent_knowledge_retrieve to find existing entries.`,
          };
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(output, null, 2),
              },
            ],
            structuredContent: output,
          };
        }

        const output = {
          status: 'success' as const,
          id: updated.id,
          feature: updated.feature,
          agent: updated.agent,
          timestamp: updated.timestamp,
          message: `Knowledge entry "${id}" updated successfully. Feature: ${updated.feature}, Agent: ${updated.agent}`,
        };

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(output, null, 2),
            },
          ],
          structuredContent: output,
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                status: 'error',
                message: handleDatabaseError(error, 'Update knowledge'),
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
