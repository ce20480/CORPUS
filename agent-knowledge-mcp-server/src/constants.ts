/**
 * Shared constants for the agent knowledge MCP server
 */

// Maximum response size in characters to prevent overwhelming agent context
export const CHARACTER_LIMIT = 25000;

// Response format options
export enum ResponseFormat {
  MARKDOWN = 'markdown',
  JSON = 'json',
}

// Default pagination limits
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;
