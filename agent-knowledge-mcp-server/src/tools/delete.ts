import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { KnowledgeDatabase } from '../database.js';
import { handleDatabaseError } from '../utils/errors.js';

export function registerDeleteTools(server: McpServer, db: KnowledgeDatabase): void {
  // Tool 1: Delete by ID
  server.registerTool(
    'agent_knowledge_delete',
    {
      title: 'Delete Single Knowledge Entry',
      description: `Delete a specific knowledge entry by ID from the corpus.

Use this tool with caution to remove a single knowledge entry that is no longer needed, incorrect, or outdated. This is a permanent operation that cannot be undone. The entry is completely removed from the database.

Args:
  - id (string): Unique ID of the knowledge entry to delete. Get IDs from agent_knowledge_retrieve. Example: "1698765432000-abc123"

Returns:
  JSON object with schema:
  {
    "status": "success" | "not_found",
    "id": string,          // ID that was deleted (or attempted)
    "message": string      // Confirmation or error message
  }

Examples:
  - Use when: "Remove my test entry"
    -> agent_knowledge_delete(id="1698765432000-abc123")

  - Use when: "Delete outdated knowledge that was superseded"
    -> agent_knowledge_delete(id="1698765432000-abc123")

  - Don't use when: You want to delete all entries for a feature (use agent_knowledge_delete_feature instead)
  - Don't use when: You want to update the entry (use agent_knowledge_update instead)
  - Don't use when: You're not sure of the ID (retrieve it first with agent_knowledge_retrieve)

Error Handling:
  - If ID not found: Returns status="not_found" with suggestion to verify ID
  - If database delete fails: Returns specific error with suggested action
  - Warning: This operation is permanent and cannot be undone`,
      inputSchema: {
        id: z.string()
          .min(1, 'Entry ID is required')
          .describe('ID of the knowledge entry to delete'),
      },
      outputSchema: {
        status: z.enum(['success', 'not_found']),
        id: z.string(),
        message: z.string(),
      },
      annotations: {
        readOnlyHint: false,      // Modifies database
        destructiveHint: true,    // DESTRUCTIVE: Permanently deletes data
        idempotentHint: true,     // Deleting same ID multiple times has same effect
        openWorldHint: false,     // Closed system (local database)
      },
    },
    async ({ id }) => {
      try {
        const deleted = db.delete(id);

        if (!deleted) {
          const output = {
            status: 'not_found' as const,
            id,
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
          id,
          message: `Knowledge entry "${id}" deleted successfully. This operation cannot be undone.`,
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
                message: handleDatabaseError(error, 'Delete knowledge entry'),
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 2: Delete by feature
  server.registerTool(
    'agent_knowledge_delete_feature',
    {
      title: 'Delete All Knowledge for Feature',
      description: `Delete ALL knowledge entries for a specific feature from the corpus.

Use this tool with EXTREME CAUTION to remove all knowledge entries associated with a particular feature. This is useful when a feature is being completely removed or restarted from scratch. This operation is permanent and cannot be undone - all entries from all agents for this feature will be deleted.

Args:
  - feature (string): Feature identifier to delete all knowledge for. Example: "global-modal-system", "user-authentication"

Returns:
  JSON object with schema:
  {
    "status": "success",
    "feature": string,           // Feature that was deleted
    "deleted_count": number,     // Number of entries deleted
    "message": string            // Confirmation message
  }

Examples:
  - Use when: "Remove all knowledge about the old authentication system"
    -> agent_knowledge_delete_feature(feature="old-auth-system")

  - Use when: "Clear all entries for a cancelled feature"
    -> agent_knowledge_delete_feature(feature="cancelled-feature")

  - Don't use when: You only want to delete one specific entry (use agent_knowledge_delete instead)
  - Don't use when: You want to update entries (use agent_knowledge_update instead)
  - Don't use when: You're not sure - this deletes EVERYTHING for the feature

Error Handling:
  - If no entries found for feature: Still returns success with deleted_count=0
  - If database delete fails: Returns specific error with suggested action
  - Warning: This operation is EXTREMELY DESTRUCTIVE and cannot be undone`,
      inputSchema: {
        feature: z.string()
          .min(1, 'Feature identifier is required')
          .describe('Feature identifier to delete all knowledge for'),
      },
      outputSchema: {
        status: z.literal('success'),
        feature: z.string(),
        deleted_count: z.number(),
        message: z.string(),
      },
      annotations: {
        readOnlyHint: false,      // Modifies database
        destructiveHint: true,    // EXTREMELY DESTRUCTIVE: Deletes multiple entries
        idempotentHint: true,     // Same feature deletion has same effect
        openWorldHint: false,     // Closed system (local database)
      },
    },
    async ({ feature }) => {
      try {
        const count = db.deleteByFeature(feature);

        const output = {
          status: 'success' as const,
          feature,
          deleted_count: count,
          message: count > 0
            ? `Deleted ${count} knowledge ${count === 1 ? 'entry' : 'entries'} for feature "${feature}". This operation cannot be undone.`
            : `No knowledge entries found for feature "${feature}". Nothing was deleted.`,
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
                message: handleDatabaseError(error, 'Delete feature knowledge'),
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool 3: Delete all
  server.registerTool(
    'agent_knowledge_delete_all',
    {
      title: 'Delete ALL Knowledge (DANGEROUS)',
      description: `Delete ALL knowledge from the entire corpus. EXTREMELY DANGEROUS - use only when resetting the system.

This tool clears the ENTIRE knowledge database, removing all entries from all features and all agents. This is intended ONLY for system resets, testing, or when completely starting over. This operation is PERMANENT and CANNOT BE UNDONE.

Args:
  - confirm (literal "DELETE_ALL"): Must be exactly the string "DELETE_ALL" to confirm. This prevents accidental deletions.

Returns:
  JSON object with schema:
  {
    "status": "success",
    "deleted_count": number,     // Total number of entries deleted
    "message": string            // Confirmation message
  }

Examples:
  - Use when: "Reset the entire knowledge corpus for testing"
    -> agent_knowledge_delete_all(confirm="DELETE_ALL")

  - Use when: "Starting completely fresh"
    -> agent_knowledge_delete_all(confirm="DELETE_ALL")

  - Don't use when: You only want to delete one feature (use agent_knowledge_delete_feature instead)
  - Don't use when: You only want to delete one entry (use agent_knowledge_delete instead)
  - Don't use when: You're not ABSOLUTELY CERTAIN - this deletes EVERYTHING

Error Handling:
  - If confirm string is wrong: Returns error refusing to delete without proper confirmation
  - If database delete fails: Returns specific error with suggested action
  - Warning: THIS OPERATION DELETES EVERYTHING AND CANNOT BE UNDONE`,
      inputSchema: {
        confirm: z.literal('DELETE_ALL').describe('Must be exactly "DELETE_ALL" to confirm this destructive operation'),
      },
      outputSchema: {
        status: z.literal('success'),
        deleted_count: z.number(),
        message: z.string(),
      },
      annotations: {
        readOnlyHint: false,      // Modifies database
        destructiveHint: true,    // MOST DESTRUCTIVE: Deletes entire database
        idempotentHint: true,     // Running multiple times has same effect
        openWorldHint: false,     // Closed system (local database)
      },
    },
    async ({ confirm }) => {
      try {
        // Double-check confirmation
        if (confirm !== 'DELETE_ALL') {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({
                  status: 'error',
                  message: 'Confirmation failed. To delete ALL knowledge from the corpus, you must provide confirm="DELETE_ALL" exactly. This safety check prevents accidental data loss.',
                }, null, 2),
              },
            ],
            isError: true,
          };
        }

        const count = db.deleteAll();

        const output = {
          status: 'success' as const,
          deleted_count: count,
          message: count > 0
            ? `DELETED ALL ${count} knowledge ${count === 1 ? 'entry' : 'entries'} from the corpus. The knowledge database is now empty. This operation cannot be undone.`
            : 'Knowledge corpus was already empty. No entries were deleted.',
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
                message: handleDatabaseError(error, 'Delete all knowledge'),
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
