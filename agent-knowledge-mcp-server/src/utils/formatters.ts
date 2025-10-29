/**
 * Response formatting utilities for different output formats
 */

import { KnowledgeEntry } from '../database.js';
import { ResponseFormat, CHARACTER_LIMIT } from '../constants.js';

/**
 * Formats knowledge entries as human-readable Markdown
 */
export function formatEntriesAsMarkdown(entries: KnowledgeEntry[], feature?: string): string {
  const lines: string[] = [];

  // Header
  if (feature) {
    lines.push(`# Knowledge for Feature: ${feature}`);
  } else {
    lines.push('# Knowledge Corpus Entries');
  }
  lines.push('');
  lines.push(`Found ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`);
  lines.push('');

  // Format each entry
  for (const entry of entries) {
    lines.push(`## ${entry.feature} - ${entry.agent}`);
    lines.push(`**ID**: \`${entry.id}\``);
    lines.push(`**Timestamp**: ${new Date(entry.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`);
    if (entry.branch) {
      lines.push(`**Branch**: \`${entry.branch}\``);
    }
    lines.push('');
    lines.push('### Summary');
    lines.push(entry.summary);
    lines.push('');

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      lines.push('### Metadata');
      for (const [key, value] of Object.entries(entry.metadata)) {
        lines.push(`- **${key}**: ${JSON.stringify(value)}`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Formats knowledge entries as JSON
 */
export function formatEntriesAsJSON(entries: KnowledgeEntry[]): string {
  return JSON.stringify(entries, null, 2);
}

/**
 * Truncates response if it exceeds character limit and adds truncation message
 */
export function truncateIfNeeded(
  content: string,
  originalCount: number,
  format: ResponseFormat
): { content: string; truncated: boolean; message?: string } {
  if (content.length <= CHARACTER_LIMIT) {
    return { content, truncated: false };
  }

  // Calculate how many entries to keep (rough estimate)
  const truncatedLength = CHARACTER_LIMIT * 0.8; // Leave room for message
  const truncatedContent = content.substring(0, truncatedLength);

  const truncationMessage = format === ResponseFormat.MARKDOWN
    ? `\n\n---\n\n**⚠️ Response Truncated**\n\nOriginal response was ${content.length} characters. Showing first ${truncatedContent.length} characters (approximately ${Math.floor((truncatedContent.length / content.length) * originalCount)} of ${originalCount} entries).\n\nTo see more results:\n- Add filters: Use \`feature\` or \`agent\` parameters to narrow results\n- Use pagination: Add \`limit\` and use the returned offset for next page\n- Retrieve specific entries: Use entry IDs to fetch individual knowledge entries`
    : `\n\n/* Response truncated from ${content.length} to ${truncatedContent.length} characters. Use filters (feature, agent) or pagination (limit, offset) to see specific results. */`;

  return {
    content: truncatedContent + truncationMessage,
    truncated: true,
    message: `Response truncated. Original: ${content.length} chars, ${originalCount} entries. Showing: ${truncatedContent.length} chars. Use filters or pagination to refine results.`,
  };
}
