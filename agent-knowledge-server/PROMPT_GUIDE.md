# Knowledge Server Integration for AI Agents

## Quick Setup
- **Server URL**: `http://localhost:8001`
- **Full API docs**: `GET http://localhost:8001/`

## Decision Tree for Agents
1. **Starting new feature work?** → `GET /retrieve?feature=YOUR-FEATURE`
2. **Completed something?** → `POST /share` with details
3. **Need to refine your knowledge?** → `PUT /update/{id}` with improvements
4. **Need to know what's happening?** → `GET /recent`
5. **Exploring available work?** → `GET /features`
6. **Made a mistake?** → `DELETE /delete/{id}`
7. **Abandoning feature?** → `DELETE /delete/feature/{feature}?confirm=true`
8. **Fresh start needed?** → `DELETE /delete/all?confirm=true`

## Your Workflow

### 1. Before Starting Work
Check if knowledge exists for your feature:
```bash
GET http://localhost:8001/retrieve?feature=FEATURE-NAME
```

### 2. After Completing Work
Share what you've implemented:
```bash
POST http://localhost:8001/share
Content-Type: application/json

{
  "agent": "YOUR-AGENT-NAME",
  "feature": "FEATURE-NAME",
  "summary": "[ACTION] [WHAT] - [DETAILS]",
  "branch": "git-branch-name"  # optional
}
```

## Naming Conventions

| Type | Format | Examples |
|------|--------|----------|
| **Features** | kebab-case | `user-auth`, `payment-api`, `admin-dashboard` |
| **Agents** | role-based | `backend-agent`, `frontend-agent`, `database-agent` |
| **Branches** | git convention | `feature/user-auth`, `main`, `develop` |

## Summary Format Template
```
[ACTION] [WHAT] - [DETAILS]
```

### Actions:
- `CREATED` - New endpoint, component, or feature
- `UPDATED` - Modified existing code
- `CONFIGURED` - Setup or configuration changes
- `DESIGNED` - Architecture or flow decisions
- `FIXED` - Bug fixes or corrections

### Examples:
- `CREATED POST /api/auth/login - Accepts {email, password}, returns {token, expiresIn}`
- `UPDATED User model - Added role field with enum: admin, user, guest`
- `CONFIGURED Redis cache - 5 minute TTL for session tokens`
- `DESIGNED payment flow - Stripe webhook -> Queue -> Processor`

## Quick Examples

### Share Backend API Creation
```bash
curl -X POST http://localhost:8001/share \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "backend-agent",
    "feature": "user-auth",
    "summary": "CREATED POST /api/login - Accepts {email: string, password: string}, returns {token: string, expiresIn: 3600}"
  }'
```

### Retrieve Feature Knowledge
```bash
curl "http://localhost:8001/retrieve?feature=user-auth"
```

### Check Recent Activity
```bash
curl http://localhost:8001/recent
```

### List All Features
```bash
curl http://localhost:8001/features
```

## Knowledge Evolution Workflow

### Initial Share
When you first create a plan or implementation:
```bash
POST http://localhost:8001/share
Content-Type: application/json

{
  "agent": "research-agent",
  "feature": "user-auth",
  "summary": "DRAFT PLAN: Basic authentication system...",
  "metadata": {"status": "draft", "version": 1}
}
# Returns: {"id": 1, ...}
```

### Refine and Update
As you learn more or requirements change:
```bash
PUT http://localhost:8001/update/1
Content-Type: application/json

{
  "agent": "research-agent",
  "feature": "user-auth",
  "summary": "REFINED PLAN v2: Added rate limiting and MFA requirements...",
  "metadata": {"status": "ready", "version": 2}
}
```

### Best Practices for Updates
- Include version in metadata for tracking
- Add revision notes at the top of summary
- Keep the same feature name for consistency
- Update status in metadata (draft → refined → ready)

## Cleanup Operations

### Delete Specific Entry
If you made a mistake or shared incorrect information:
```bash
curl -X DELETE http://localhost:8001/delete/5
```

### Delete Feature's Knowledge
When abandoning or restarting a feature:
```bash
curl -X DELETE "http://localhost:8001/delete/feature/payment-api?confirm=true"
```

### Clear Entire Database
For a complete fresh start:
```bash
curl -X DELETE "http://localhost:8001/delete/all?confirm=true"
```

**Note:** Bulk deletions require `confirm=true` to prevent accidents.

## Best Practices

1. **Be Specific**: Include concrete technical details (endpoints, schemas, field names)
2. **Be Consistent**: Use the same feature names across all agents
3. **Be Timely**: Share knowledge immediately after implementing
4. **Be Complete**: Include all details another agent would need

## Integration Checklist

- [ ] Add this guide to your agent's system prompt
- [ ] Test connection with `GET http://localhost:8001/health`
- [ ] Use consistent feature naming with other agents
- [ ] Share knowledge after each implementation step
- [ ] Check for updates before starting new work

## Orchestration Support

An orchestration agent monitors the knowledge corpus and shares insights about:
- Missing integrations (e.g., backend without frontend)
- Naming inconsistencies
- Knowledge gaps
- Dependencies between features

Check orchestration insights:
```bash
curl "http://localhost:8001/retrieve?feature=orchestration-insights"
```

---

**Remember**: The key to success is **consistent naming**. Since we use exact matching (not AI), all agents must use identical feature names.