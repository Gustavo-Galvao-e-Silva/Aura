# 🐳 Revellio Docker Guide

This guide explains how to run Revellio using Docker Compose.

---

## 📋 Prerequisites

- Docker installed (https://docs.docker.com/get-docker/)
- Docker Compose installed (usually comes with Docker Desktop)
- `.env` file configured in `src/server/` (see `src/server/.env.example`)

---

## 🚀 Quick Start (Supabase Mode - Default)

This is the **recommended** setup for team development. It uses Supabase for the database.

```bash
# From project root
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**Access:**
- 🌐 **Frontend:** http://localhost:5173
- 🔌 **Backend API:** http://localhost:8000
- 📚 **API Docs:** http://localhost:8000/docs

---

## 📦 What Gets Started

### Default Mode (`docker-compose.yml`)
- ✅ **Backend** (FastAPI) - Port 8000
  - Connects to Supabase (cloud database)
  - Hot reload enabled (code changes update automatically)
  - All agents and API routes ready

- ✅ **Frontend** (React + Vite) - Port 5173
  - Hot reload enabled
  - Connects to backend on localhost:8000

### Local Mode (`docker-compose.local.yml`)
- ✅ **PostgreSQL + pgvector** (local database) - Port 5432
- ✅ **Adminer** (database UI) - Port 8080
- ✅ **Backend** (FastAPI) - Port 8000
- ✅ **Frontend** (React + Vite) - Port 5173

---

## 🔄 Different Ways to Run

### 1. Full Stack with Supabase (Default - Team Mode)

**Best for:** Working with teammates, production-like environment

```bash
# Start everything
docker-compose up -d

# View backend logs
docker-compose logs -f backend

# View frontend logs
docker-compose logs -f frontend

# View all logs
docker-compose logs -f

# Restart a specific service
docker-compose restart backend

# Stop everything
docker-compose down
```

**Requirements:**
- `.env` file in `src/server/` with Supabase `DATABASE_URL`

---

### 2. Full Stack with Local Database (Offline Mode)

**Best for:** Offline development, testing migrations, database experiments

```bash
# Start everything with local PostgreSQL
docker-compose -f docker-compose.local.yml up -d

# View logs
docker-compose -f docker-compose.local.yml logs -f

# Stop everything
docker-compose -f docker-compose.local.yml down

# Stop and remove volumes (clean slate)
docker-compose -f docker-compose.local.yml down -v
```

**Access:**
- 🗄️ **Adminer (DB UI):** http://localhost:8080
  - Server: `db`
  - Username: `postgres`
  - Password: `postgres`
  - Database: `revellio`

**When to use:**
- Working without internet
- Testing database migrations locally before applying to Supabase
- Experimenting with schema changes

---

### 3. Backend Only (No Frontend)

**Best for:** Backend-focused development, API testing

```bash
# From project root
docker-compose up -d backend

# Or with local database
docker-compose -f docker-compose.local.yml up -d db adminer backend
```

---

### 4. Frontend Only (Backend Running Elsewhere)

**Best for:** Frontend-focused development

```bash
# Make sure backend is running first (via Docker or locally)

# Start just frontend
docker-compose up -d frontend
```

**Note:** Frontend expects backend at `http://localhost:8000`

---

## 🛠️ Development Workflow

### Making Code Changes

Both backend and frontend have **hot reload** enabled:

**Backend Changes:**
1. Edit Python files in `src/server/`
2. Changes auto-detect and reload
3. Check logs: `docker-compose logs -f backend`

**Frontend Changes:**
1. Edit files in `src/client/`
2. Vite auto-reloads in browser
3. Check logs: `docker-compose logs -f frontend`

### Rebuilding After Dependency Changes

If you modify `pyproject.toml` or `package.json`:

```bash
# Rebuild and restart
docker-compose up -d --build

# Or rebuild specific service
docker-compose up -d --build backend
```

### Running Commands Inside Containers

```bash
# Backend: Run migrations
docker-compose exec backend alembic upgrade head

# Backend: Python shell
docker-compose exec backend python

# Backend: Run a script
docker-compose exec backend python scripts/verify-supabase.py

# Frontend: Install new npm package
docker-compose exec frontend npm install <package-name>

# Frontend: Shell
docker-compose exec frontend sh
```

---

## 🔍 Troubleshooting

### Backend won't start - "Connection refused"

**Problem:** Can't connect to Supabase

**Solution:**
```bash
# Check .env file exists and has correct DATABASE_URL
cat src/server/.env | grep DATABASE_URL

# Should show: postgresql://postgres.xxx:password@...supabase.com:6543/postgres
# Make sure port is 6543 (pooler), not 5432
```

### Frontend can't reach backend - "Network error"

**Problem:** Backend not running or wrong URL

**Solution:**
```bash
# Check backend is running
docker-compose ps

# Should show backend as "Up" and port 8000 mapped
# Test backend directly:
curl http://localhost:8000/health
```

### "port already in use" error

**Problem:** Another service using the same port

**Solution:**
```bash
# Check what's using the port
lsof -i :8000  # Backend
lsof -i :5173  # Frontend
lsof -i :5432  # Database (if using local mode)

# Stop the conflicting service or change port in docker-compose.yml
```

### Changes not reflecting - stale cache

**Problem:** Code changes not appearing

**Solution:**
```bash
# Force rebuild without cache
docker-compose up -d --build --force-recreate

# Or for specific service
docker-compose up -d --build --force-recreate backend
```

### Database migration issues

**Problem:** "relation does not exist" or migration errors

**Solution:**
```bash
# Check current migration state
docker-compose exec backend alembic current

# Run migrations
docker-compose exec backend alembic upgrade head

# If using local mode, make sure db is healthy:
docker-compose -f docker-compose.local.yml ps db
```

---

## 🧹 Cleaning Up

### Remove all containers and networks

```bash
docker-compose down
```

### Remove all containers, networks, AND volumes (fresh start)

```bash
# Local mode only (has volumes)
docker-compose -f docker-compose.local.yml down -v

# WARNING: This deletes all local database data!
```

### Remove all images (free disk space)

```bash
# Stop everything first
docker-compose down

# Remove images
docker-compose -f docker-compose.yml rm
docker-compose -f docker-compose.local.yml rm

# Or manually
docker image rm revellio-backend revellio-frontend
```

---

## 📊 Monitoring

### View resource usage

```bash
# See CPU, memory, network usage
docker stats

# Just for Revellio containers
docker stats revellio-backend revellio-frontend
```

### View container details

```bash
# Inspect backend container
docker inspect revellio-backend

# Get backend IP address
docker inspect revellio-backend | grep IPAddress
```

---

## 🔐 Environment Variables

### Backend (.env in src/server/)

Required:
- `DATABASE_URL` - Supabase connection string (port 6543)
- `GOOGLE_API_KEY` - Google Gemini API
- `BROWSER_USE_API_KEY` - Browser Use SDK
- `FRED_API_KEY` - FRED economic data
- `TAVILY_API_KEY` - News search
- `STELLAR_SECRET_KEY` - Blockchain transactions

Optional:
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` - Email sending
- `WISE_API_KEY` - Wise payment integration

### Frontend (.env in src/client/)

Optional:
- `VITE_API_URL` - Backend URL (defaults to http://localhost:8000)
- `VITE_CLERK_PUBLISHABLE_KEY` - Clerk authentication

---

## 👥 Team Collaboration

### For Your Teammate

1. **Share securely:**
   - `src/server/.env` file (contains Supabase credentials)
   - OR invite them to Supabase project

2. **They clone the repo:**
   ```bash
   git clone <repo-url>
   cd revellio
   ```

3. **They add .env file:**
   ```bash
   # Place .env in src/server/
   # (you sent them this file)
   ```

4. **They start the stack:**
   ```bash
   docker-compose up -d
   ```

5. **They're ready!** 🎉
   - Frontend: http://localhost:5173
   - Backend: http://localhost:8000/docs

**No Python, Node, or database setup needed!** Everything runs in Docker.

---

## 🚀 Ready for Phase 1

Once your Docker setup is working:

1. ✅ Docker Compose running successfully
2. ✅ Backend accessible at http://localhost:8000/docs
3. ✅ Frontend accessible at http://localhost:5173
4. ✅ Database tests passing (ran `scripts/verify-supabase.py`)

**Next:** Open `STABLECOIN_INTEGRATION_PLAN.md` and start Phase 1! 🎯

---

## 📚 Additional Resources

- **Docker Compose Docs:** https://docs.docker.com/compose/
- **Dockerfile Best Practices:** https://docs.docker.com/develop/dev-best-practices/
- **Supabase Docs:** https://supabase.com/docs
- **FastAPI Docs:** https://fastapi.tiangolo.com/
- **Vite Docs:** https://vitejs.dev/

---

**Questions or Issues?**
- Check logs: `docker-compose logs -f`
- Restart services: `docker-compose restart`
- Full cleanup: `docker-compose down && docker-compose up -d --build`
