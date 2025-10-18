# 🧠 Agent Knowledge Server

**A ultra-pragmatic knowledge sharing system for multi-agent development**

Think of this as "git branches for knowledge" - different AI agents working on separate features can share and retrieve implementation details without manual copy-paste.

## 🚀 Quick Start (60 seconds)

```bash
# Clone and enter directory
cd agent-knowledge-server

# Install dependencies (minimal - just 2!)
pip install -r requirements.txt

# Run the server
python server.py

# Server is now running at http://localhost:8000
# Test it: curl http://localhost:8000/health
```

## 🎯 Problem This Solves

When you have multiple AI coding agents working in different git branches/worktrees:
- **Backend agent** creates an API endpoint
- **Frontend agent** needs to know the API schema
- **Currently**: You manually copy-paste between agents
- **With this**: Agents automatically share and retrieve knowledge

## 📚 Core Concept

This is **"Git Branches for Knowledge"**:
- **Features** = Knowledge branches (e.g., "user-auth", "payment-api")
- **Agents** = Contributors to those branches
- **Summaries** = Knowledge commits
- **No AI needed** - Just smart labeling and filtering!

## 🤖 For AI Agents - Add This to Your Prompts

```
KNOWLEDGE SERVER INSTRUCTIONS:
Use the knowledge server at http://localhost:8000 to share and retrieve information.

Before starting a feature:
  curl "http://localhost:8000/retrieve?feature=FEATURE-NAME"

After completing work, share your knowledge:
  curl -X POST http://localhost:8000/share \
    -H "Content-Type: application/json" \
    -d '{
      "agent": "YOUR-AGENT-NAME",
      "feature": "FEATURE-NAME",
      "summary": "WHAT-YOU-IMPLEMENTED",
      "branch": "git-branch-name"
    }'

Use consistent feature names like: user-auth, payment-api, admin-dashboard
```

## 🔌 API Endpoints

### 1. Info Guide - `GET /`
Returns comprehensive documentation about how to use the server.
```bash
curl http://localhost:8000/
```

### 2. Share Knowledge - `POST /share`
Share what you've implemented or learned.
```bash
curl -X POST http://localhost:8000/share \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "backend-agent",
    "feature": "user-auth",
    "summary": "CREATED POST /api/auth/login - Accepts {email, password}, returns {token, expiresIn}. Token should be sent as Bearer token in Authorization header.",
    "branch": "feature/user-auth"
  }'
```

### 3. Retrieve Knowledge - `GET /retrieve`
Get relevant knowledge with optional filters.
```bash
# Get all knowledge for a feature
curl "http://localhost:8000/retrieve?feature=user-auth"

# Get knowledge from specific agent
curl "http://localhost:8000/retrieve?agent=backend-agent"

# Get knowledge for specific git branch
curl "http://localhost:8000/retrieve?branch=feature/user-auth"

# Combine filters
curl "http://localhost:8000/retrieve?feature=user-auth&agent=backend-agent&limit=5"
```

### 4. Recent Updates - `GET /recent`
See what's been shared recently across all features.
```bash
# Last 24 hours (default)
curl http://localhost:8000/recent

# Last 48 hours, max 10 results
curl "http://localhost:8000/recent?hours=48&limit=10"
```

### 5. List Features - `GET /features`
Discover what features are being worked on.
```bash
curl http://localhost:8000/features
```

Response:
```json
[
  {
    "feature": "user-auth",
    "entry_count": 8,
    "latest_update": "2024-01-15T14:30:00",
    "contributing_agents": ["backend-agent", "frontend-agent"]
  },
  {
    "feature": "payment-api",
    "entry_count": 5,
    "latest_update": "2024-01-15T13:15:00",
    "contributing_agents": ["backend-agent", "payment-agent"]
  }
]
```

### 6. Health Check - `GET /health`
Check server status and statistics.
```bash
curl http://localhost:8000/health
```

## 📋 Naming Conventions

### Features (Knowledge Branches)
Use kebab-case, be specific:
- ✅ `user-auth`
- ✅ `payment-processing`
- ✅ `admin-dashboard`
- ✅ `search-feature`
- ❌ `auth` (too vague)
- ❌ `UserAuth` (wrong case)

### Agents
Clearly identify the agent type:
- ✅ `backend-agent`
- ✅ `frontend-agent`
- ✅ `database-agent`
- ✅ `api-agent`
- ❌ `agent1` (not descriptive)

### Summary Format
Use the pattern: `[ACTION] [WHAT] - [DETAILS]`

Examples:
- `CREATED POST /api/users - Accepts {name, email}, returns {id, created_at}`
- `UPDATED User model - Added 'role' field with enum values: admin, user, guest`
- `CONFIGURED Redis - Cache user sessions with 5 minute TTL`
- `DESIGNED flow - User registration: validate -> create -> send email -> return token`

## 💡 Example Workflow

### Scenario: Building User Authentication

**1. Backend Agent starts work:**
```bash
# Check if anyone has worked on this
curl "http://localhost:8000/retrieve?feature=user-auth"
# No results - this is a new feature
```

**2. Backend Agent implements login endpoint:**
```bash
curl -X POST http://localhost:8000/share \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "backend-agent",
    "feature": "user-auth",
    "summary": "CREATED POST /api/auth/login - Accepts {email: string, password: string}. Returns {token: string, expiresIn: number, userId: string}. Token is JWT, expires in 24 hours.",
    "branch": "feature/user-auth"
  }'
```

**3. Frontend Agent starts their work:**
```bash
# Check what backend has done
curl "http://localhost:8000/retrieve?feature=user-auth"

# Gets back:
# "CREATED POST /api/auth/login - Accepts {email: string, password: string}..."
# Now knows exactly how to call the API!
```

**4. Frontend Agent shares their implementation:**
```bash
curl -X POST http://localhost:8000/share \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "frontend-agent",
    "feature": "user-auth",
    "summary": "CREATED Login form component - Calls POST /api/auth/login, stores token in localStorage, redirects to /dashboard on success",
    "branch": "feature/user-auth"
  }'
```

## 🐍 Python Client Example

```python
import requests

class KnowledgeClient:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url

    def share(self, agent, feature, summary, branch=None):
        """Share knowledge about a feature"""
        return requests.post(
            f"{self.base_url}/share",
            json={
                "agent": agent,
                "feature": feature,
                "summary": summary,
                "branch": branch
            }
        ).json()

    def retrieve(self, feature=None, agent=None, branch=None, limit=10):
        """Retrieve knowledge with filters"""
        params = {}
        if feature: params['feature'] = feature
        if agent: params['agent'] = agent
        if branch: params['branch'] = branch
        params['limit'] = limit

        return requests.get(
            f"{self.base_url}/retrieve",
            params=params
        ).json()

# Usage
client = KnowledgeClient()

# Share knowledge
client.share(
    agent="backend-agent",
    feature="user-auth",
    summary="CREATED User model with email, password_hash, created_at fields"
)

# Retrieve knowledge
auth_knowledge = client.retrieve(feature="user-auth")
for entry in auth_knowledge:
    print(f"{entry['agent']}: {entry['summary']}")
```

## 📁 Technical Details

### Database
- **SQLite** - Just a file at `~/.agent_knowledge/knowledge.db`
- No Docker, no server, no configuration needed
- Survives restarts, portable, zero-maintenance

### Performance
- Indexes on `feature` and `timestamp` for fast queries
- Can handle thousands of entries efficiently
- Typical response time: < 10ms

### Dependencies (Minimal!)
- `fastapi` - Web framework
- `uvicorn` - ASGI server
- `python-dotenv` - Optional environment variables

That's it! No ML libraries, no vector databases, no complex setup.

## 🔧 Configuration (Optional)

Create a `.env` file to customize:
```env
PORT=8000
HOST=0.0.0.0
DEFAULT_LIMIT=10
DB_PATH=~/.agent_knowledge/knowledge.db
```

## 🚦 Running as a Background Service

### macOS/Linux
```bash
# Start in background
nohup python server.py > server.log 2>&1 &

# Check it's running
ps aux | grep server.py

# Stop it
pkill -f server.py
```

### With systemd (Linux)
Create `/etc/systemd/system/agent-knowledge.service`:
```ini
[Unit]
Description=Agent Knowledge Server
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/agent-knowledge-server
ExecStart=/usr/bin/python3 /path/to/agent-knowledge-server/server.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable agent-knowledge
sudo systemctl start agent-knowledge
```

## 🔄 Future Enhancements (If Needed)

This MVP solves the immediate problem. If you need more:

1. **Week 2**: Add vector search for semantic matching (when exact feature names aren't enough)
2. **Week 3**: Add MCP support for native IDE integration
3. **Month 1**: Add conflict detection (when agents share contradicting info)
4. **Month 2**: Add knowledge expiration/archiving
5. **Month 3**: Web UI for browsing knowledge

But honestly? **This simple version might be all you ever need.**

## 🤝 Contributing

This is designed to be hackable. The entire server is in one file (`server.py`). Feel free to:
- Add new endpoints
- Modify the schema
- Add authentication (if not running locally)
- Integrate with your tools

## 📝 License

MIT - Use however you want!

## 🎯 Remember

**The key to success is consistent naming!** Since we're not using AI/semantic search, agents must use the same feature names. Agree on naming conventions upfront and this system will work flawlessly.

---

Built with ❤️ for multi-agent development. Stop copy-pasting, start sharing knowledge automatically!