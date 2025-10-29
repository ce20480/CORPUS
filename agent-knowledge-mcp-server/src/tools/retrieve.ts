import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { KnowledgeDatabase } from '../database.js';
import { handleDatabaseError } from '../utils/errors.js';
import { ResponseFormat, DEFAULT_LIMIT, MAX_LIMIT } from '../constants.js';
import { formatEntriesAsMarkdown, formatEntriesAsJSON, truncateIfNeeded } from '../utils/formatters.js';

export function registerRetrieveTool(server: McpServer, db: KnowledgeDatabase): void {
  server.registerTool(
    'agent_knowledge_retrieve',
    {
      title: 'Retrieve Knowledge from Corpus',
      description: `Retrieve knowledge entries from the multi-agent knowledge corpus with filtering and pagination.

Use this tool to discover what other agents have learned, implemented, or documented about specific features. This is read-only and does NOT modify the corpus. Always check existing knowledge before starting new work to avoid duplication and learn from others' experience.

Args:
  - feature (string, optional): Filter by feature identifier. Example: "global-modal-system", "user-authentication". Omit to retrieve across all features.

  - agent (string, optional): Filter by agent name. Example: "frontend-agent", "research-agent". Omit to retrieve from all agents.

  - limit (number, optional): Maximum number of results to return. Must be between 1-${MAX_LIMIT}. Default: ${DEFAULT_LIMIT}. Use smaller limits for initial exploration, then paginate for more.

  - offset (number, optional): Number of results to skip for pagination. Default: 0. Use with limit to page through large result sets.

  - response_format ('markdown' | 'json', optional): Output format. Default: 'markdown'.
    * 'markdown': Human-readable formatted text with headers, timestamps in local format, and organized sections. Best for understanding and analysis.
    * 'json': Machine-readable structured data with all fields. Best for programmatic processing or when you need to extract specific data.

Returns:
  For response_format='markdown':
    Formatted markdown text with:
    - Feature and agent information
    - Human-readable timestamps
    - Organized summary and metadata sections
    - Pagination information if results truncated

  For response_format='json':
    JSON object with schema:
    {
      "status": "success",
      "count": number,           // Number of entries in this response
      "total": number,           // Total matching entries in database
      "offset": number,          // Current pagination offset
      "entries": [
        {
          "id": string,          // Entry ID (e.g., "1698765432000-abc123")
          "agent": string,       // Agent who shared this knowledge
          "feature": string,     // Feature slug
          "summary": string,     // Detailed knowledge summary
          "branch": string,      // Git branch (optional)
          "metadata": object,    // Additional data (optional)
          "timestamp": string    // ISO 8601 timestamp
        }
      ],
      "has_more": boolean,       // Whether more results available
      "next_offset": number      // Offset for next page (if has_more=true)
    }

Examples:
  - Use when: "What has been done on the modal system?"
    -> agent_knowledge_retrieve(feature="global-modal-system", response_format="markdown")

  - Use when: "Show me the latest 5 entries from the frontend agent"
    -> agent_knowledge_retrieve(agent="frontend-agent", limit=5, response_format="markdown")

  - Use when: "Get all knowledge as JSON for analysis"
    -> agent_knowledge_retrieve(response_format="json", limit=100)

  - Use when: "Page through results"
    -> agent_knowledge_retrieve(limit=20, offset=0)  // First page
    -> agent_knowledge_retrieve(limit=20, offset=20) // Second page

  - Don't use when: Adding new knowledge (use agent_knowledge_share instead)
  - Don't use when: Updating existing knowledge (use agent_knowledge_update instead)

Error Handling:
  - If no entries found: Returns "No knowledge entries found" message with suggestions to check feature name or try broader search
  - If invalid limit (<1 or >${MAX_LIMIT}): Returns error with valid range
  - If database query fails: Returns specific error with suggested action
  - If response exceeds ${truncateIfNeeded.length} characters: Automatically truncates with clear message about using filters/pagination`,
      inputSchema: {
        feature: z.string()
          .optional()
          .describe('Filter by feature identifier (e.g., "global-modal-system")'),
        agent: z.string()
          .optional()
          .describe('Filter by agent name (e.g., "frontend-agent")'),
        limit: z.number()
          .int()
          .min(1, `Limit must be at least 1`)
          .max(MAX_LIMIT, `Limit must not exceed ${MAX_LIMIT}`)
          .default(DEFAULT_LIMIT)
          .describe(`Maximum number of results to return (default: ${DEFAULT_LIMIT}, max: ${MAX_LIMIT})`),
        offset: z.number()
          .int()
          .min(0, 'Offset must be non-negative')
          .default(0)
          .describe('Number of results to skip for pagination (default: 0)'),
        response_format: z.nativeEnum(ResponseFormat)
          .default(ResponseFormat.MARKDOWN)
          .describe('Output format: "markdown" for human-readable or "json" for machine-readable'),
      },
      outputSchema: {
        status: z.literal('success'),
        count: z.number(),
        total: z.number().optional(),
        offset: z.number().optional(),
        entries: z.array(z.object({
          id: z.string(),
          agent: z.string(),
          feature: z.string(),
          summary: z.string(),
          branch: z.string().optional(),
          metadata: z.record(z.any()).optional(),
          timestamp: z.string(),
        })).optional(),
        has_more: z.boolean().optional(),
        next_offset: z.number().optional(),
        markdown: z.string().optional(),
        truncated: z.boolean().optional(),
        truncation_message: z.string().optional(),
      },
      annotations: {
        readOnlyHint: true,        // Does not modify database
        destructiveHint: false,    // Read-only operation
        idempotentHint: true,      // Same query always returns same results
        openWorldHint: false,      // Closed system (local database)
      },
    },
    async ({ feature, agent, limit, offset, response_format }) => {
      try {
        // Get all matching entries for total count
        const allEntries = db.retrieve(feature, agent);
        const total = allEntries.length;

        if (total === 0) {
          const noResultsMessage = feature
            ? `No knowledge entries found for feature "${feature}"${agent ? ` from agent "${agent}"` : ''}. Try:\n- Check the feature name spelling\n- Remove the agent filter to see all contributions\n- Use agent_knowledge_retrieve() without filters to see all available knowledge`
            : agent
              ? `No knowledge entries found from agent "${agent}". Try removing the agent filter or check the agent name spelling.`
              : 'No knowledge entries found in the corpus. Use agent_knowledge_share() to add the first entry!';

          return {
            content: [
              {
                type: 'text' as const,
                text: noResultsMessage,
              },
            ],
          };
        }

        // Apply pagination
        const paginatedEntries = allEntries.slice(offset, offset + limit);
        const has_more = total > offset + limit;
        const next_offset = has_more ? offset + limit : undefined;

        // Format response based on requested format
        let responseText: string;
        let output: any;

        if (response_format === ResponseFormat.MARKDOWN) {
          responseText = formatEntriesAsMarkdown(paginatedEntries, feature);

          // Add pagination info to markdown
          if (has_more || offset > 0) {
            responseText += `\n\n---\n\n**Pagination**: Showing entries ${offset + 1}-${offset + paginatedEntries.length} of ${total} total.\n`;
            if (has_more) {
              responseText += `More results available. Use offset=${next_offset} to see next page.\n`;
            }
          }

          // Check character limit and truncate if needed
          const truncation = truncateIfNeeded(responseText, paginatedEntries.length, response_format);
          responseText = truncation.content;

          output = {
            status: 'success' as const,
            count: paginatedEntries.length,
            total,
            offset,
            markdown: responseText,
            has_more,
            next_offset,
            truncated: truncation.truncated,
            truncation_message: truncation.message,
          };
        } else {
          // JSON format
          const jsonData = {
            status: 'success' as const,
            count: paginatedEntries.length,
            total,
            offset,
            entries: paginatedEntries,
            has_more,
            next_offset,
          };

          responseText = JSON.stringify(jsonData, null, 2);

          // Check character limit for JSON too
          const truncation = truncateIfNeeded(responseText, paginatedEntries.length, response_format);
          if (truncation.truncated) {
            // For JSON, we need to truncate the entries array instead
            const truncatedCount = Math.floor(paginatedEntries.length / 2);
            jsonData.entries = paginatedEntries.slice(0, truncatedCount);
            jsonData.count = truncatedCount;
            responseText = JSON.stringify({
              ...jsonData,
              truncated: true,
              truncation_message: truncation.message,
            }, null, 2);
          }

          output = jsonData;
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: responseText,
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
                message: handleDatabaseError(error, 'Retrieve knowledge'),
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
