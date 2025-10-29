/**
 * Shared error handling utilities for MCP tools
 */

/**
 * Formats database errors into actionable, LLM-friendly messages
 */
export function handleDatabaseError(error: unknown, operation: string): string {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Check for common error patterns and provide specific guidance
  if (errorMessage.includes('UNIQUE constraint')) {
    return `Error: Duplicate entry detected. This knowledge may already exist in the corpus. Try retrieving existing entries first with agent_knowledge_retrieve.`;
  }

  if (errorMessage.includes('NOT NULL constraint')) {
    return `Error: Required field missing. Ensure all required parameters (agent, feature, summary) are provided.`;
  }

  if (errorMessage.includes('no such table')) {
    return `Error: Database not initialized. The knowledge corpus database may need to be reset. Contact system administrator.`;
  }

  // Generic error with operation context
  return `Error: ${operation} failed: ${errorMessage}. Please verify your inputs and try again.`;
}

/**
 * Validates feature slug format and provides helpful error message
 */
export function validateFeatureSlug(feature: string): { valid: boolean; error?: string } {
  if (!/^[a-z0-9-]+$/.test(feature)) {
    return {
      valid: false,
      error: `Invalid feature slug "${feature}". Feature slugs must be lowercase alphanumeric with hyphens only. Examples: "user-authentication", "global-modal-system", "api-integration"`,
    };
  }

  if (feature.length < 3) {
    return {
      valid: false,
      error: `Feature slug "${feature}" too short. Use at least 3 characters for clarity. Example: "auth" -> "user-auth"`,
    };
  }

  if (feature.length > 100) {
    return {
      valid: false,
      error: `Feature slug "${feature}" too long. Keep it under 100 characters for readability.`,
    };
  }

  return { valid: true };
}
