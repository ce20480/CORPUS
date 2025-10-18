"""
Agent Knowledge Server - Ultra-Pragmatic Implementation
A simple knowledge sharing system for multi-agent development.
Think of it as "git branches for knowledge" - no AI needed, just smart labeling!
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import sqlite3
import json
import os
from pathlib import Path
from contextlib import contextmanager, asynccontextmanager
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration with defaults
PORT = int(os.getenv("PORT", "8000"))
HOST = os.getenv("HOST", "0.0.0.0")
DEFAULT_LIMIT = int(os.getenv("DEFAULT_LIMIT", "10"))
DB_PATH = os.path.expanduser(os.getenv("DB_PATH", "~/.agent_knowledge/knowledge.db"))

# Ensure database directory exists
db_dir = os.path.dirname(DB_PATH)
Path(db_dir).mkdir(parents=True, exist_ok=True)

# Initialize database on startup using lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events"""
    # Startup
    init_database()
    logger.info(f"Server starting on {HOST}:{PORT}")
    yield
    # Shutdown
    logger.info("Server shutting down")

# Create FastAPI app with lifespan
app = FastAPI(
    title="Agent Knowledge Server",
    description="Share knowledge between AI agents working on different features/branches",
    version="1.0.0",
    lifespan=lifespan
)

# Pydantic models for request/response validation
class KnowledgeShare(BaseModel):
    agent: str = Field(..., description="Name of the agent sharing knowledge (e.g., 'backend-agent')")
    feature: str = Field(..., description="Feature/knowledge branch name (e.g., 'user-auth')")
    summary: str = Field(..., description="What was implemented/learned")
    branch: Optional[str] = Field(None, description="Git branch name (optional)")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional structured data")

class KnowledgeEntry(BaseModel):
    id: int
    agent: str
    feature: str
    summary: str
    branch: Optional[str]
    metadata: Optional[Dict[str, Any]]
    timestamp: str

class FeatureInfo(BaseModel):
    feature: str
    entry_count: int
    latest_update: str
    contributing_agents: List[str]

# Database connection context manager
@contextmanager
def get_db():
    """Context manager for database connections"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Enable column access by name
    try:
        yield conn
    finally:
        conn.close()

# Initialize database on startup
def init_database():
    """Create tables and indexes if they don't exist"""
    with get_db() as conn:
        cursor = conn.cursor()

        # Create main knowledge table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS knowledge (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent TEXT NOT NULL,
                feature TEXT NOT NULL,
                branch TEXT,
                summary TEXT NOT NULL,
                metadata TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Create indexes for fast filtering
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_feature
            ON knowledge(feature)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_feature_timestamp
            ON knowledge(feature, timestamp DESC)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_timestamp
            ON knowledge(timestamp DESC)
        """)

        conn.commit()
        logger.info(f"Database initialized at {DB_PATH}")

# Note: Database initialization is now handled in the lifespan context manager above

# Root endpoint - Guide for AI agents
@app.get("/", response_model=Dict[str, Any])
async def get_info():
    """
    Guide endpoint for AI agents on how to use this knowledge system.
    Returns comprehensive documentation about the server's purpose and usage.
    """
    return {
        "service": "Agent Knowledge Server v1.0",
        "description": "Share knowledge between AI agents working on different features. Think of this like 'git branches for knowledge'.",

        "concept": {
            "metaphor": "Git branches for knowledge - each feature is a knowledge branch that agents contribute to",
            "benefits": [
                "No manual copy-paste between agents",
                "Persistent knowledge across sessions",
                "Simple filtering by feature/branch/agent",
                "Immediate availability - no complex AI needed"
            ]
        },

        "how_to_use": {
            "1_check_existing": "Before starting work, retrieve existing knowledge: GET /retrieve?feature=your-feature",
            "2_share_progress": "After implementing something, share it: POST /share",
            "3_be_consistent": "Use consistent feature names across all agents",
            "4_be_specific": "Include concrete details (endpoints, schemas, decisions) in summaries"
        },

        "naming_conventions": {
            "features": "Use kebab-case: user-auth, payment-api, admin-dashboard, search-feature",
            "agents": "Identify yourself clearly: backend-agent, frontend-agent, database-agent, api-agent",
            "branches": "Optional git branches: feature/user-auth, main, develop, hotfix/bug-123"
        },

        "summary_template": {
            "format": "[ACTION] [WHAT] - [DETAILS]",
            "examples": [
                "CREATED POST /api/auth/login - Accepts {email, password}, returns {token, expiresIn}",
                "UPDATED User model - Added 'last_login' and 'failed_attempts' fields",
                "CONFIGURED Redis cache - Session storage with 5 minute TTL",
                "DESIGNED payment flow - Stripe webhook -> SQS queue -> Lambda processor"
            ]
        },

        "endpoints": {
            "POST /share": "Share new knowledge about a feature",
            "GET /retrieve": "Get knowledge with filters (feature, branch, agent)",
            "GET /recent": "Get recent updates across all features",
            "GET /features": "List all knowledge branches with statistics",
            "DELETE /delete/{id}": "Delete specific knowledge entry by ID",
            "DELETE /delete/feature/{feature}": "Delete all entries for a feature (requires confirmation)",
            "DELETE /delete/all": "Clear entire database (requires confirmation)",
            "GET /health": "Check server status",
            "GET /docs": "Interactive API documentation (Swagger UI)"
        },

        "example_workflow": [
            "1. Backend agent creates auth endpoint",
            "2. Backend shares: POST /share with API details",
            "3. Frontend agent queries: GET /retrieve?feature=user-auth",
            "4. Frontend receives API schema and implements correctly",
            "5. Both agents stay synchronized without manual copying"
        ],

        "quick_test": "curl -X GET http://localhost:8000/health"
    }

# Share knowledge endpoint
@app.post("/share", response_model=Dict[str, Any])
async def share_knowledge(knowledge: KnowledgeShare):
    """
    Share new knowledge about a feature.
    This is how agents contribute to the knowledge base.
    """
    try:
        with get_db() as conn:
            cursor = conn.cursor()

            # Serialize metadata if provided
            metadata_json = json.dumps(knowledge.metadata) if knowledge.metadata else None

            # Insert new knowledge entry
            cursor.execute("""
                INSERT INTO knowledge (agent, feature, branch, summary, metadata)
                VALUES (?, ?, ?, ?, ?)
            """, (
                knowledge.agent,
                knowledge.feature,
                knowledge.branch,
                knowledge.summary,
                metadata_json
            ))

            conn.commit()
            knowledge_id = cursor.lastrowid

            logger.info(f"Knowledge shared - ID: {knowledge_id}, Agent: {knowledge.agent}, Feature: {knowledge.feature}")

            return {
                "status": "success",
                "message": "Knowledge shared successfully",
                "id": knowledge_id,
                "feature": knowledge.feature,
                "agent": knowledge.agent,
                "timestamp": datetime.now().isoformat()
            }

    except Exception as e:
        logger.error(f"Error sharing knowledge: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to share knowledge: {str(e)}")

# Retrieve knowledge endpoint
@app.get("/retrieve", response_model=List[KnowledgeEntry])
async def get_knowledge(
    feature: Optional[str] = Query(None, description="Filter by feature/knowledge branch"),
    branch: Optional[str] = Query(None, description="Filter by git branch"),
    agent: Optional[str] = Query(None, description="Filter by specific agent"),
    limit: int = Query(DEFAULT_LIMIT, description="Maximum number of results", ge=1, le=100)
):
    """
    Retrieve knowledge with optional filters.
    Returns newest entries first.
    """
    try:
        with get_db() as conn:
            cursor = conn.cursor()

            # Build query with filters
            query = "SELECT * FROM knowledge WHERE 1=1"
            params = []

            if feature:
                query += " AND feature = ?"
                params.append(feature)

            if branch:
                query += " AND branch = ?"
                params.append(branch)

            if agent:
                query += " AND agent = ?"
                params.append(agent)

            # Order by newest first
            query += " ORDER BY timestamp DESC LIMIT ?"
            params.append(limit)

            cursor.execute(query, params)
            rows = cursor.fetchall()

            # Convert to response models
            results = []
            for row in rows:
                metadata = json.loads(row['metadata']) if row['metadata'] else None
                results.append(KnowledgeEntry(
                    id=row['id'],
                    agent=row['agent'],
                    feature=row['feature'],
                    summary=row['summary'],
                    branch=row['branch'],
                    metadata=metadata,
                    timestamp=row['timestamp']
                ))

            logger.info(f"Retrieved {len(results)} knowledge entries - Filters: feature={feature}, branch={branch}, agent={agent}")
            return results

    except Exception as e:
        logger.error(f"Error retrieving knowledge: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve knowledge: {str(e)}")

# Get recent updates
@app.get("/recent", response_model=List[KnowledgeEntry])
async def get_recent(
    hours: int = Query(24, description="Look back N hours", ge=1, le=168),
    limit: int = Query(20, description="Maximum number of results", ge=1, le=100)
):
    """
    Get recent knowledge updates across all features.
    Useful for seeing what other agents have been working on.
    """
    try:
        with get_db() as conn:
            cursor = conn.cursor()

            # Calculate cutoff time
            cutoff = datetime.now() - timedelta(hours=hours)

            cursor.execute("""
                SELECT * FROM knowledge
                WHERE timestamp > ?
                ORDER BY timestamp DESC
                LIMIT ?
            """, (cutoff.isoformat(), limit))

            rows = cursor.fetchall()

            # Convert to response models
            results = []
            for row in rows:
                metadata = json.loads(row['metadata']) if row['metadata'] else None
                results.append(KnowledgeEntry(
                    id=row['id'],
                    agent=row['agent'],
                    feature=row['feature'],
                    summary=row['summary'],
                    branch=row['branch'],
                    metadata=metadata,
                    timestamp=row['timestamp']
                ))

            logger.info(f"Retrieved {len(results)} recent entries from last {hours} hours")
            return results

    except Exception as e:
        logger.error(f"Error getting recent knowledge: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get recent knowledge: {str(e)}")

# List all features (knowledge branches)
@app.get("/features", response_model=List[FeatureInfo])
async def list_features():
    """
    List all unique features (knowledge branches) with statistics.
    Helps agents discover what features are being worked on.
    """
    try:
        with get_db() as conn:
            cursor = conn.cursor()

            # Get feature statistics
            cursor.execute("""
                SELECT
                    feature,
                    COUNT(*) as entry_count,
                    MAX(timestamp) as latest_update,
                    GROUP_CONCAT(DISTINCT agent) as agents
                FROM knowledge
                GROUP BY feature
                ORDER BY latest_update DESC
            """)

            rows = cursor.fetchall()

            # Convert to response models
            results = []
            for row in rows:
                agents = row['agents'].split(',') if row['agents'] else []
                results.append(FeatureInfo(
                    feature=row['feature'],
                    entry_count=row['entry_count'],
                    latest_update=row['latest_update'],
                    contributing_agents=agents
                ))

            logger.info(f"Found {len(results)} unique features")
            return results

    except Exception as e:
        logger.error(f"Error listing features: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list features: {str(e)}")

# Health check endpoint
@app.get("/health", response_model=Dict[str, Any])
async def health_check():
    """
    Check server and database health.
    Useful for monitoring and debugging.
    """
    try:
        with get_db() as conn:
            cursor = conn.cursor()

            # Test database connection and get stats
            cursor.execute("SELECT COUNT(*) as total FROM knowledge")
            total_entries = cursor.fetchone()['total']

            cursor.execute("SELECT COUNT(DISTINCT feature) as total FROM knowledge")
            total_features = cursor.fetchone()['total']

            cursor.execute("SELECT COUNT(DISTINCT agent) as total FROM knowledge")
            total_agents = cursor.fetchone()['total']

            return {
                "status": "healthy",
                "database": "connected",
                "database_path": DB_PATH,
                "statistics": {
                    "total_entries": total_entries,
                    "total_features": total_features,
                    "total_agents": total_agents
                },
                "server_time": datetime.now().isoformat()
            }

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "error": str(e),
                "server_time": datetime.now().isoformat()
            }
        )

# Delete all entries (clear database) - Must come before parameterized routes
@app.delete("/delete/all", response_model=Dict[str, Any])
async def delete_all(
    confirm: bool = Query(False, description="Confirmation required to delete all entries")
):
    """
    Delete all knowledge entries from the database.
    Requires confirmation parameter to prevent accidental deletion.
    Use this for a fresh start.
    """
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="Confirmation required. Add ?confirm=true to delete all entries"
        )

    try:
        with get_db() as conn:
            cursor = conn.cursor()

            # Count total entries
            cursor.execute("SELECT COUNT(*) as count FROM knowledge")
            count = cursor.fetchone()['count']

            if count == 0:
                return {
                    "status": "no_action",
                    "count": 0,
                    "message": "Database is already empty"
                }

            # Delete all entries
            cursor.execute("DELETE FROM knowledge")
            conn.commit()

            logger.info(f"Deleted all {count} entries from database")

            return {
                "status": "deleted",
                "count": count,
                "message": f"Deleted all {count} entries. Database is now empty."
            }

    except Exception as e:
        logger.error(f"Error deleting all entries: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete all entries: {str(e)}")

# Delete specific entry by ID
@app.delete("/delete/{entry_id}", response_model=Dict[str, Any])
async def delete_entry(entry_id: int):
    """
    Delete a specific knowledge entry by its ID.
    Returns error if the entry doesn't exist.
    """
    try:
        with get_db() as conn:
            cursor = conn.cursor()

            # Check if entry exists
            cursor.execute("SELECT * FROM knowledge WHERE id = ?", (entry_id,))
            entry = cursor.fetchone()

            if not entry:
                raise HTTPException(status_code=404, detail=f"Entry with id {entry_id} not found")

            # Delete the entry
            cursor.execute("DELETE FROM knowledge WHERE id = ?", (entry_id,))
            conn.commit()

            logger.info(f"Deleted entry {entry_id}")

            return {
                "status": "deleted",
                "id": entry_id,
                "message": f"Knowledge entry {entry_id} deleted successfully"
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting entry: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete entry: {str(e)}")

# Delete all entries for a feature
@app.delete("/delete/feature/{feature_name}", response_model=Dict[str, Any])
async def delete_feature(
    feature_name: str,
    confirm: bool = Query(False, description="Confirmation required to delete all entries for a feature")
):
    """
    Delete all knowledge entries for a specific feature.
    Requires confirmation parameter to prevent accidental deletion.
    """
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="Confirmation required. Add ?confirm=true to delete all entries for this feature"
        )

    try:
        with get_db() as conn:
            cursor = conn.cursor()

            # Count entries to be deleted
            cursor.execute("SELECT COUNT(*) as count FROM knowledge WHERE feature = ?", (feature_name,))
            count = cursor.fetchone()['count']

            if count == 0:
                return {
                    "status": "no_action",
                    "feature": feature_name,
                    "count": 0,
                    "message": f"No entries found for feature '{feature_name}'"
                }

            # Delete all entries for the feature
            cursor.execute("DELETE FROM knowledge WHERE feature = ?", (feature_name,))
            conn.commit()

            logger.info(f"Deleted {count} entries for feature '{feature_name}'")

            return {
                "status": "deleted",
                "feature": feature_name,
                "count": count,
                "message": f"Deleted {count} entries for feature '{feature_name}'"
            }

    except Exception as e:
        logger.error(f"Error deleting feature entries: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete feature entries: {str(e)}")


# Run the server
if __name__ == "__main__":
    import uvicorn

    print("\n" + "="*60)
    print("🚀 Agent Knowledge Server Starting...")
    print("="*60)
    print(f"📍 Server URL: http://{HOST}:{PORT}")
    print(f"📚 API Docs: http://{HOST}:{PORT}/docs")
    print(f"💾 Database: {DB_PATH}")
    print("="*60)
    print("\nQuick test commands:")
    print(f"  curl http://localhost:{PORT}/health")
    print(f"  curl http://localhost:{PORT}/")
    print("\nPress Ctrl+C to stop the server")
    print("="*60 + "\n")

    uvicorn.run(app, host=HOST, port=PORT)