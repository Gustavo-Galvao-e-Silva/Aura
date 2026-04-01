# 🚀 Supabase Migration Guide

**Goal:** Migrate from local PostgreSQL to Supabase for team collaboration
**Duration:** 15-20 minutes
**Why:** Supabase provides a centralized PostgreSQL database with native pgvector support

---

## 📋 Prerequisites

- [ ] Supabase account (sign up at https://supabase.com - free tier is perfect for development)
- [ ] Current Revellio codebase with Alembic migrations
- [ ] Local `.env` file access

---

## 🎯 Step 1: Create Supabase Project

### 1.1 Sign Up / Log In
```bash
# Go to https://supabase.com
# Click "Start your project" (if new) or "New Project"
```

### 1.2 Create Project
- **Organization:** Create new or select existing
- **Project Name:** `revellio-dev` (or whatever you prefer)
- **Database Password:** Generate a strong password (save this!)
- **Region:** Choose closest to your location (e.g., `us-west-1` for California)
- **Pricing Plan:** Free tier is fine for development

**⏱️ Wait 2-3 minutes for database to spin up**

---

## 🔑 Step 2: Get Connection Strings

### 2.1 Navigate to Database Settings
1. In Supabase dashboard, click **Settings** (gear icon, bottom left)
2. Click **Database** in the sidebar
3. Scroll down to **Connection string** section

### 2.2 Copy Both Connection Strings

You'll see multiple connection modes. We need two:

**A. Direct Connection (for Alembic migrations)**
```
Session mode (port 5432)
postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:5432/postgres
```

**B. Transaction Pooler (for FastAPI runtime)**
```
Transaction mode (port 6543)
postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

**Key Differences:**
- Port 5432 = Direct connection (stable, for schema changes)
- Port 6543 = Pooled connection (fast, for app queries)

**🔐 Security Tip:** Replace `[YOUR-PASSWORD]` with the actual password you created in Step 1.2

---

## 🛠️ Step 3: Enable pgvector Extension

Revellio uses pgvector for semantic search (384-dim embeddings in `audit_log` table).

### Option A: Via Supabase Dashboard (Recommended)
1. Go to **Database** → **Extensions** (in left sidebar)
2. Search for `vector`
3. Click **Enable** next to `vector`
4. Wait 10 seconds for activation

### Option B: Via SQL Editor
```sql
-- Go to SQL Editor in Supabase dashboard
CREATE EXTENSION IF NOT EXISTS vector;
```

**Verify it worked:**
```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
-- Should return 1 row
```

---

## ⚙️ Step 4: Update Your Configuration

### 4.1 Update `.env` File

**Current (local database):**
```env
# Old local setup
DATABASE_URL=postgresql://postgres:example@127.0.0.1:5432/postgres
DB_USER=postgres
DB_PASSWORD=example
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=postgres
```

**New (Supabase):**
```env
# === Supabase Database (Transaction Pooler for FastAPI) ===
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres

# Individual components (optional, DATABASE_URL takes precedence)
DB_USER=postgres.[PROJECT-REF]
DB_PASSWORD=[YOUR-PASSWORD]
DB_HOST=aws-0-us-west-1.pooler.supabase.com
DB_PORT=6543
DB_NAME=postgres

# === Alembic Migration URL (Direct Connection) ===
# Create a separate file: .env.migration for running migrations
# DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:5432/postgres
```

**Why Two URLs?**
- **FastAPI (Port 6543):** Your app uses the pooler for thousands of async queries
- **Alembic (Port 5432):** Migrations need a stable direct connection to alter schemas

### 4.2 Create `.env.migration` File

Create a separate file for running migrations:

```bash
cd src/server
touch .env.migration
```

**Contents of `.env.migration`:**
```env
# Direct connection for Alembic migrations (Port 5432)
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:5432/postgres
```

**Usage:**
```bash
# Run migrations with direct connection
env $(cat .env.migration | xargs) alembic upgrade head
```

### 4.3 Verify settings.py Works

Your `settings.py` already has the logic to handle this:

```python
# settings.py:49-54 (no changes needed!)
@property
def database_url(self) -> str:
    """Get database URL (use DATABASE_URL if set, otherwise construct from components)."""
    if self.DATABASE_URL:
        return self.DATABASE_URL
    return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
```

Since `DATABASE_URL` is set in `.env`, it will be used directly. ✅

---

## 🗄️ Step 5: Run Migrations Against Supabase

Now let's create all your tables in the Supabase database.

### 5.1 Test Connection First

```bash
cd src/server

# Test the connection using Python
python -c "
from my_fastapi_app.app.settings import settings
print(f'Database URL: {settings.database_url[:50]}...')
print(f'Host: {settings.DB_HOST}')
print(f'Port: {settings.DB_PORT}')
"
```

**Expected Output:**
```
Database URL: postgresql://postgres.abcd1234:[hidden]@aws-0-...
Host: aws-0-us-west-1.pooler.supabase.com
Port: 6543
```

### 5.2 Run Alembic Migrations

**Important:** Use the direct connection (port 5432) for migrations!

```bash
# Option A: Using .env.migration file
env $(cat .env.migration | xargs) alembic upgrade head

# Option B: Temporarily edit alembic.ini
# Change line: sqlalchemy.url = driver://user:pass@localhost/dbname
# To your Supabase direct URL (port 5432)
# Then run:
alembic upgrade head
```

**Expected Output:**
```
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade  -> abc123, initial_schema
INFO  [alembic.runtime.migration] Running upgrade abc123 -> def456, add_pgvector_extension
INFO  [alembic.runtime.migration] Running upgrade def456 -> ghi789, add_stablecoin_balances_and_transactions
```

### 5.3 Verify Tables Were Created

**Via Supabase Dashboard:**
1. Go to **Table Editor** (in left sidebar)
2. You should see:
   - `users`
   - `liabilities`
   - `audit_log`
   - `cotation_notify`
   - `alembic_version` (tracks migration state)

**Via SQL Editor:**
```sql
-- Check all tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check pgvector column exists
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'audit_log' AND column_name = 'reasoning_embedding';
-- Should show: reasoning_embedding | USER-DEFINED | vector
```

---

## ✅ Step 6: Test the Connection

### 6.1 Test Database Write

```bash
cd src/server

# Create a test user
python -c "
import asyncio
from sqlalchemy import select
from my_fastapi_app.app.db.session import AsyncSessionLocal
from db.models import Users

async def test_connection():
    async with AsyncSessionLocal() as db:
        # Create test user
        test_user = Users(
            fullname='Test Student',
            username='supabase_test',
            email='test@supabase.com',
            brl_balance=50000.0,
            usd_balance=0.0
        )
        db.add(test_user)
        await db.commit()
        print('✅ User created successfully!')

        # Verify it exists
        result = await db.execute(
            select(Users).filter(Users.username == 'supabase_test')
        )
        user = result.scalar_one_or_none()
        if user:
            print(f'✅ User found: {user.fullname}, BRL: R\${user.brl_balance}')
        else:
            print('❌ User not found')

asyncio.run(test_connection())
"
```

**Expected Output:**
```
✅ User created successfully!
✅ User found: Test Student, BRL: R$50000.0
```

### 6.2 Test pgvector Extension

```bash
# Test vector operations
python -c "
import asyncio
from sqlalchemy import text
from my_fastapi_app.app.db.session import AsyncSessionLocal

async def test_vector():
    async with AsyncSessionLocal() as db:
        # Create a test vector
        test_query = text('SELECT vector_dims(CAST(:vec AS vector)) AS dims')
        result = await db.execute(test_query, {'vec': '[1.0, 2.0, 3.0]'})
        dims = result.scalar()
        print(f'✅ pgvector is working! Test vector has {dims} dimensions')

asyncio.run(test_vector())
"
```

**Expected Output:**
```
✅ pgvector is working! Test vector has 3 dimensions
```

### 6.3 Test FastAPI Server

```bash
# Start the server (should connect to Supabase automatically)
cd src/server
uvicorn my_fastapi_app.app.main:app --reload

# In another terminal, test an endpoint
curl http://localhost:8000/health

# Test fetching the user we just created
curl http://localhost:8000/balances/supabase_test
```

**Expected Response:**
```json
{
  "username": "supabase_test",
  "brl_balance": 50000.0,
  "usd_balance": 0.0,
  "total_usd_equivalent": 9090.909090909092
}
```

---

## 👥 Step 7: Share Access With Your Teammate

### 7.1 Invite Teammate to Supabase Project

**Option A: Via Dashboard (Recommended)**
1. Go to **Settings** → **Team**
2. Click **Invite Member**
3. Enter teammate's email
4. Select role: **Developer** (can read/write data, run SQL)
5. They'll receive an invite email

**Option B: Share Connection String (Quick)**
If you just need them to connect their local backend:
1. Create a `.env.template` file in your repo:
   ```env
   # Copy this to .env and fill in the Supabase credentials
   DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres

   # Other required keys
   GOOGLE_API_KEY=your_key_here
   BROWSER_USE_API_KEY=your_key_here
   # ... etc
   ```

2. Share the actual password securely (Slack DM, 1Password, etc.)
3. They update their local `.env` and run the app

**🔐 Security Note:**
- The `.env` file should **never** be committed to git
- Add it to `.gitignore` if not already there
- Use different databases for dev/staging/production

### 7.2 Verify Teammate Can Connect

Your teammate should:
```bash
# Clone the repo
git clone <repo-url>
cd revellio/src/server

# Copy .env.template to .env and fill in credentials
cp .env.template .env
vim .env  # Add the Supabase credentials

# Test connection
python -c "
import asyncio
from sqlalchemy import select
from my_fastapi_app.app.db.session import AsyncSessionLocal
from db.models import Users

async def test():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Users))
        users = result.scalars().all()
        print(f'✅ Connected! Found {len(users)} users in database')

asyncio.run(test())
"
```

---

## 🎛️ Step 8: Configure Connection Pooler Settings (Optional)

If you start seeing connection errors under heavy load, you can tune the pooler.

### 8.1 Check Current Settings

In Supabase dashboard:
1. **Settings** → **Database** → **Connection Pooling**
2. You'll see:
   - **Pool Size:** Number of real Postgres connections (default: 15)
   - **Pool Mode:** `transaction` (each query gets a connection briefly)

### 8.2 Adjust If Needed

**Symptoms of needing more pool size:**
- Errors like `remaining connection slots are reserved`
- Slow queries during agent runs
- Multiple users running Aura simultaneously

**Solution:**
- Free tier: Increase pool size to 50 (if available)
- Paid tier: Can go up to 100+

**How to adjust:**
1. **Settings** → **Database** → scroll to **Connection Pooling**
2. Adjust **Pool Size** slider
3. Click **Save**

---

## 🧹 Step 9: Clean Up Local Database (Optional)

Since you're now using Supabase, you can stop running PostgreSQL locally.

### 9.1 Stop Docker Compose Database

```bash
cd src/server

# Stop just the database container
docker-compose stop postgres

# Or stop everything
docker-compose down

# Remove volumes (frees disk space)
docker-compose down -v
```

### 9.2 Update docker-compose.yml (Optional)

If you want to keep Docker Compose for running the backend, but remove the local database:

```yaml
# docker-compose.yml - REMOVE the postgres service

# BEFORE:
services:
  postgres:
    image: postgres:16
    # ... (remove entire postgres service block)

  backend:
    depends_on:
      - postgres  # ← REMOVE this line

# AFTER:
services:
  backend:
    # No dependency on local postgres anymore
```

Now when you run `docker-compose up`, it only starts the backend, which connects to Supabase.

---

## 🐛 Troubleshooting

### Problem: "could not connect to server"

**Cause:** Wrong connection string or Supabase project not ready

**Solution:**
```bash
# Verify the URL is correct
echo $DATABASE_URL

# Check Supabase project status in dashboard
# Make sure it shows "Healthy" (green dot)

# Test raw connection
psql "postgresql://postgres.[REF]:[PASS]@aws-0-us-west-1.pooler.supabase.com:6543/postgres"
```

---

### Problem: "password authentication failed"

**Cause:** Wrong password in connection string

**Solution:**
1. Go to **Settings** → **Database** in Supabase
2. Click **Reset Database Password**
3. Copy new password
4. Update `.env` file with new password

---

### Problem: "relation does not exist"

**Cause:** Alembic migrations didn't run

**Solution:**
```bash
# Check which migrations have been applied
env $(cat .env.migration | xargs) alembic current

# If no migrations, run them
env $(cat .env.migration | xargs) alembic upgrade head

# Verify tables exist in Supabase dashboard
```

---

### Problem: "asyncpg.exceptions.UndefinedObjectError: type 'vector' does not exist"

**Cause:** pgvector extension not enabled

**Solution:**
```bash
# Enable via SQL Editor in Supabase
CREATE EXTENSION IF NOT EXISTS vector;

# Verify
SELECT * FROM pg_extension WHERE extname = 'vector';
```

---

### Problem: "too many connections"

**Cause:** Using direct connection (port 5432) for FastAPI instead of pooler (port 6543)

**Solution:**
```bash
# Check your .env DATABASE_URL
# Should end with :6543/postgres (pooler)
# NOT :5432/postgres (direct)

# Correct:
DATABASE_URL=postgresql://...pooler.supabase.com:6543/postgres

# Wrong:
DATABASE_URL=postgresql://...pooler.supabase.com:5432/postgres
```

---

## 📊 Monitoring Your Database

### View Active Connections

In Supabase dashboard:
1. **Database** → **Connection Pooling**
2. See real-time graph of connections in use

### View Query Performance

1. **Database** → **Query Performance**
2. See slow queries, connection counts, cache hit rates

### Set Up Alerts (Pro Plan)

1. **Settings** → **Alerts**
2. Get notified when:
   - Connections > 80% of pool
   - Disk usage > 90%
   - Query time > 1 second

---

## ✅ Migration Checklist

Before you consider the migration complete:

- [ ] Supabase project created
- [ ] pgvector extension enabled
- [ ] Both connection URLs saved (direct + pooler)
- [ ] `.env` updated with pooler URL (port 6543)
- [ ] `.env.migration` created with direct URL (port 5432)
- [ ] `.env` added to `.gitignore`
- [ ] Alembic migrations run successfully (`alembic upgrade head`)
- [ ] All tables visible in Supabase Table Editor
- [ ] Test user created successfully
- [ ] FastAPI server connects without errors
- [ ] Teammate can connect with shared credentials
- [ ] Local PostgreSQL stopped (optional)

---

## 🎉 You're Done!

You now have a production-grade PostgreSQL database with pgvector that:
- ✅ Both you and your teammate can access simultaneously
- ✅ Handles async FastAPI queries efficiently (connection pooler)
- ✅ Supports semantic search with 384-dim vectors
- ✅ Has automatic backups (Supabase handles this)
- ✅ Can be accessed from anywhere (not just localhost)

**Next Steps:**
1. Commit your code changes (`.env.template`, updated connection logic if any)
2. Share `.env` credentials securely with teammate
3. Start working on Phase 1 of the Stablecoin Integration Plan!

---

## 📚 Additional Resources

- **Supabase Docs:** https://supabase.com/docs
- **pgvector on Supabase:** https://supabase.com/docs/guides/ai/vector-columns
- **Connection Pooling:** https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler
- **Alembic Documentation:** https://alembic.sqlalchemy.org/en/latest/

---

**Questions or Issues?**
- Check Supabase dashboard logs: **Database** → **Logs**
- Test connection: `psql "your-connection-string"`
- Review Alembic migration history: `alembic history`

🚀 **Happy building with your teammate!**
