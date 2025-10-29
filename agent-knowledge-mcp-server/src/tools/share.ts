import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { KnowledgeDatabase } from '../database.js';
import { handleDatabaseError, validateFeatureSlug } from '../utils/errors.js';

export function registerShareTool(server: McpServer, db: KnowledgeDatabase): void {
  server.registerTool(
    'agent_knowledge_share',
    {
      title: 'Share Knowledge to Corpus',
      description: `Share new knowledge about a feature to the multi-agent knowledge corpus.

Use this tool when you have completed work, discovered insights, made technical decisions, or want to communicate implementation details to other agents. This tool creates NEW knowledge entries and does NOT update existing ones.

Args:
  - agent (string): Your agent identifier. Use descriptive names like "frontend-agent", "research-agent", "testing-agent", or "backend-agent". This helps other agents know who contributed the knowledge.

  - feature (string): Feature identifier slug using lowercase alphanumeric characters with hyphens only. Examples: "user-authentication", "global-modal-system", "api-integration". Must be 3-100 characters.

  - summary (string): Detailed summary of what you learned, implemented, or discovered. Include:
    * What was accomplished or learned
    * Key technical decisions and rationale
    * Challenges encountered and solutions
    * Important file paths or code locations
    * Next steps or recommendations for other agents
    Minimum 10 characters. Be thorough - this is how agents coordinate!

  - branch (string, optional): Git branch name if this knowledge relates to specific branch work. Example: "feature/modal-system", "fix/auth-bug"

  - metadata (object, optional): Additional structured data such as:
    * files: Array of file paths modified
    * dependencies: Array of new dependencies added
    * errors: Array of errors encountered and fixed
    * status: Current status like "in-progress", "completed", "blocked"
    * plan_version: Version number if this is a plan

Returns:
  JSON object with schema:
  {
    "status": "success",
    "id": string,              // Generated unique ID (e.g., "1698765432000-abc123")
    "feature": string,         // Feature slug provided
    "agent": string,           // Agent name provided
    "timestamp": string,       // ISO 8601 timestamp of when knowledge was shared
    "message": string          // Confirmation message
  }

Examples:
  - Use when: "I just implemented the modal component"
    -> agent_knowledge_share(agent="frontend-agent", feature="global-modal-system", summary="Implemented reusable Modal component with portal rendering...", branch="feature/modals", metadata={files: ["src/Modal.tsx"], status: "completed"})

  - Use when: "I discovered the API requires authentication"
    -> agent_knowledge_share(agent="research-agent", feature="api-integration", summary="API requires OAuth 2.0 authentication. Tokens expire after 1 hour...", metadata={status: "in-progress"})

  - Don't use when: Updating existing knowledge entry (use agent_knowledge_update instead)
  - Don't use when: Just querying what others have shared (use agent_knowledge_retrieve instead)

Error Handling:
  - If feature slug is invalid (contains uppercase/spaces): Returns error with format guidance and examples
  - If summary too short (<10 chars): Returns error asking for more detailed summary
  - If database write fails: Returns specific error with suggested action
  - If feature slug too short (<3 chars): Suggests making it more descriptive`,
      inputSchema: {
        agent: z.string()
          .min(1, 'Agent name is required')
          .describe('Your agent name/identifier (e.g., "frontend-agent", "research-agent")'),
        feature: z.string()
          .regex(/^[a-z0-9-]+$/, 'Feature slug must be lowercase alphanumeric with hyphens')
          .min(3, 'Feature slug must be at least 3 characters')
          .max(100, 'Feature slug must not exceed 100 characters')
          .describe('Feature identifier (e.g., "global-modal-system", "user-auth")'),
        summary: z.string()
          .min(10, 'Summary must be at least 10 characters - provide detailed information')
          .describe('Detailed summary of what you learned, implemented, or discovered'),
        branch: z.string()
          .optional()
          .describe('Git branch name if relevant (e.g., "feature/modal-system")'),
        metadata: z.record(z.any())
          .optional()
          .describe('Additional structured data (files changed, errors encountered, status, etc.)'),
      },
      outputSchema: {
        status: z.literal('success'),
        id: z.string(),
        feature: z.string(),
        agent: z.string(),
        timestamp: z.string(),
        message: z.string(),
      },
      annotations: {
        readOnlyHint: false,      // This writes to database
        destructiveHint: false,    // Creates new entries, doesn't destroy existing
        idempotentHint: false,     // Each call creates a new entry with unique ID
        openWorldHint: false,      // Closed system (local database)
      },
    },
    async ({ agent, feature, summary, branch, metadata }) => {
      try {
        // Validate feature slug format with helpful error
        const validation = validateFeatureSlug(feature);
        if (!validation.valid) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({
                  status: 'error',
                  message: validation.error,
                }, null, 2),
              },
            ],
            isError: true,
          };
        }

        const entry = db.share(agent, feature, summary, branch, metadata);

        const output = {
          status: 'success' as const,
          id: entry.id,
          feature: entry.feature,
          agent: entry.agent,
          timestamp: entry.timestamp,
          message: `Knowledge shared successfully to feature "${feature}" by ${agent}. Entry ID: ${entry.id}`,
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
                message: handleDatabaseError(error, 'Share knowledge'),
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
