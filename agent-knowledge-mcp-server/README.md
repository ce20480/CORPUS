# Agent Knowledge MCP Server

An MCP (Model Context Protocol) server that enables multi-agent workflows through shared knowledge corpus. Agents can share, retrieve, and update implementation knowledge to coordinate complex development tasks.

## Overview

This MCP server provides:
- **Tools**: CRUD operations for knowledge sharing
- **Resources**: Browse knowledge by feature via URI patterns
- **Prompts**: Guided workflows for knowledge sharing and orchestration

## Installation

```bash
npm install
npm run build
```

## Usage

### With Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "agent-knowledge": {
      "command": "node",
      "args": ["/absolute/path/to/agent-knowledge-mcp-server/build/index.js"]
    }
  }
}
```

### With Claude Code

Add to your MCP settings file:

```json
{
  "mcpServers": {
    "agent-knowledge": {
      "command": "node",
      "args": ["/absolute/path/to/agent-knowledge-mcp-server/build/index.js"]
    }
  }
}
```

### Development Mode

```bash
npm run dev
```

### Testing with MCP Inspector

```bash
npm run inspect
```

## Database Location

SQLite database is stored at: `~/.agent_knowledge_mcp/knowledge.db`

## Available Tools

**All tools follow the naming convention `agent_knowledge_{action}` to prevent conflicts with other MCP servers.**

### `agent_knowledge_share`
Share new knowledge about a feature to the corpus.

**Parameters**:
- `agent` (string): Your agent identifier (e.g., "frontend-agent", "research-agent")
- `feature` (string): Feature slug - lowercase alphanumeric with hyphens, 3-100 chars
- `summary` (string): Detailed summary (min 10 chars) - what you learned/implemented
- `branch` (string, optional): Git branch name
- `metadata` (object, optional): Additional structured data

**Annotations**: `readOnlyHint=false`, `destructiveHint=false`, `idempotentHint=false`

**Example**:
```typescript
{
  agent: "frontend-agent",
  feature: "global-modal-system",
  summary: "Implemented modal component with portal rendering...",
  branch: "feature/modal-system",
  metadata: {
    files: ["src/components/Modal.tsx", "src/hooks/useModal.ts"],
    status: "completed"
  }
}
```

### `agent_knowledge_retrieve`
Retrieve knowledge entries with filtering, pagination, and format options.

**Parameters**:
- `feature` (string, optional): Filter by feature identifier
- `agent` (string, optional): Filter by agent name
- `limit` (number, optional): Max results (1-100, default: 20)
- `offset` (number, optional): Pagination offset (default: 0)
- `response_format` ('markdown' | 'json', optional): Output format (default: 'markdown')

**Annotations**: `readOnlyHint=true`, `destructiveHint=false`, `idempotentHint=true`

**Example**:
```typescript
{
  feature: "global-modal-system",
  limit: 10,
  response_format: "markdown"
}
```

**Returns**: Paginated results with `has_more`, `next_offset`, and `total` count. Markdown format includes human-readable timestamps and organized sections.

### `agent_knowledge_update`
Update an existing knowledge entry by ID.

**Parameters**:
- `id` (string): Entry ID to update (get from retrieve)
- `summary` (string): Updated summary (min 10 chars) - replaces previous
- `metadata` (object, optional): Updated metadata - replaces previous if provided

**Annotations**: `readOnlyHint=false`, `destructiveHint=false`, `idempotentHint=true`

**Example**:
```typescript
{
  id: "1698765432000-abc123",
  summary: "Enhanced implementation with additional error handling...",
  metadata: {status: "completed"}
}
```

### `agent_knowledge_delete`
Delete a specific knowledge entry by ID. **Permanent operation.**

**Parameters**:
- `id` (string): Entry ID to delete

**Annotations**: `readOnlyHint=false`, `destructiveHint=true`, `idempotentHint=true`

**Example**:
```typescript
{ id: "1698765432000-abc123" }
```

### `agent_knowledge_delete_feature`
Delete ALL knowledge entries for a specific feature. **EXTREMELY DESTRUCTIVE.**

**Parameters**:
- `feature` (string): Feature identifier - deletes all entries for this feature

**Annotations**: `readOnlyHint=false`, `destructiveHint=true`, `idempotentHint=true`

**Example**:
```typescript
{ feature: "old-auth-system" }
```

### `agent_knowledge_delete_all`
Delete ALL knowledge from the entire corpus. **DANGEROUS - requires confirmation.**

**Parameters**:
- `confirm` (literal: "DELETE_ALL"): Must be exactly "DELETE_ALL" to proceed

**Annotations**: `readOnlyHint=false`, `destructiveHint=true`, `idempotentHint=true`

**Example**:
```typescript
{ confirm: "DELETE_ALL" }
```

## Available Resources

### `knowledge://features`
List all features with entry counts.

### `knowledge://{feature}`
All knowledge entries for a specific feature.

**Example**: `knowledge://global-modal-system`

### `knowledge://{feature}/{id}`
Individual knowledge entry by feature and ID.

**Example**: `knowledge://global-modal-system/1729123456789-abc123`

## Available Prompts

### `share_knowledge_workflow`
Guided workflow for sharing knowledge after completing work.

**Parameters**:
- `agent`: Your agent identifier
- `feature`: Feature you worked on

### `find_related_knowledge`
Search and analyze existing knowledge before starting work.

**Parameters**:
- `feature`: Feature to search for
- `agent` (optional): Filter by specific agent

### `orchestrate_feature`
Analyze feature status across all agents and coordinate next steps.

**Parameters**:
- `feature`: Feature to orchestrate

## Multi-Agent Workflow Example

### 1. Research Agent Plans Feature

```typescript
// Research agent uses prompt
find_related_knowledge({ feature: "user-authentication" })

// Then shares plan
agent_knowledge_share({
  agent: "research-agent",
  feature: "user-authentication",
  summary: "Plan v1: Use JWT tokens with refresh strategy...",
  metadata: { plan_version: 1 }
})
```

### 2. Frontend Agent Implements

```typescript
// Frontend agent retrieves plan
agent_knowledge_retrieve({
  feature: "user-authentication",
  response_format: "markdown"
})

// Implements and shares results
agent_knowledge_share({
  agent: "frontend-agent",
  feature: "user-authentication",
  summary: "Implemented login form and token storage...",
  branch: "feat/auth",
  metadata: {
    files: ["src/components/Login.tsx", "src/auth/tokenManager.ts"],
    status: "needs_backend"
  }
})
```

### 3. Orchestration Agent Coordinates

```typescript
// Orchestrator analyzes
orchestrate_feature({ feature: "user-authentication" })

// Shares insights
agent_knowledge_share({
  agent: "orchestration-agent",
  feature: "orchestration-insights",
  summary: "Auth feature: frontend 80% done, backend needed...",
  metadata: {
    next_agent: "backend-agent",
    blockers: ["API endpoints not implemented"]
  }
})
```

### 4. Research Agent Updates Plan

```typescript
// Research agent updates after discovering new requirements
agent_knowledge_update({
  id: "1729123456789-abc123",
  summary: "Plan v2: Adding OAuth support due to security requirements...",
  metadata: { plan_version: 2, breaking_changes: true }
})
```

## Best Practices

1. **Feature Naming**: Use lowercase-hyphenated slugs (e.g., `user-authentication`, `global-modal-system`)
2. **Agent Naming**: Use descriptive identifiers (e.g., `frontend-agent`, `research-agent`, `orchestration-agent`)
3. **Summary Quality**: Write detailed summaries with decisions, challenges, and next steps
4. **Metadata Usage**: Include file paths, dependencies, errors, and status flags
5. **Retrieve Before Share**: Always check existing knowledge before starting work
6. **Update vs New**: Update existing entries when refining; create new when adding distinct work

## Database Schema

```sql
CREATE TABLE knowledge_corpus (
  id TEXT PRIMARY KEY,
  agent TEXT NOT NULL,
  feature TEXT NOT NULL,
  summary TEXT NOT NULL,
  branch TEXT,
  metadata TEXT,  -- JSON
  timestamp TEXT NOT NULL
);
```

Indexes on: `feature`, `agent`, `timestamp`

## Development

### Build
```bash
npm run build
```

### Watch Mode
```bash
npm run dev
```

### Start Compiled
```bash
npm start
```

## License

MIT
