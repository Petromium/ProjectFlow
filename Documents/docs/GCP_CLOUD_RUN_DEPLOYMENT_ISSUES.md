# GCP Cloud Run Deployment Issues & Fixes

## Issue Summary
GCP Cloud Build successfully built the container, but Cloud Run deployment failed.

## Root Causes Identified

### 1. Missing Health Check Endpoint ✅ FIXED
**Problem**: Dockerfile and Cloud Run expect `/health` endpoint, but it wasn't defined in routes.

**Fix**: Added health check endpoints:
- `GET /health` - Simple health check
- `GET /api/health` - API health check

**Location**: `server/routes.ts` (lines 153-160)

### 2. Environment Variable Validation Too Strict
**Problem**: In production mode, if validation fails, the app exits with `process.exit(1)`, causing Cloud Run to mark the container as failed.

**Required Environment Variables for Cloud Run**:
- `SESSION_SECRET` - Must be 32+ characters in production
- `DATABASE_URL` - PostgreSQL connection string
- `ALLOWED_ORIGINS` - Comma-separated list of allowed origins (optional but recommended)
- `PORT` - Set automatically by Cloud Run (defaults to 8080, but we use 5000)

**Fix**: Updated validation to mark SESSION_SECRET as required.

### 3. Cloud Run Port Configuration ✅ FIXED
**Problem**: Cloud Run sets `PORT` environment variable automatically (usually 8080), but our app was defaulting to 5000.

**Fix**: 
- Updated `server/app.ts` to default to `8080` instead of `5000`
- Updated Dockerfile to `EXPOSE 8080` and removed hardcoded `PORT=5000`
- Health check now uses `process.env.PORT` dynamically
- Local docker-compose still uses PORT=5000 for development

**Action Required**: None - Cloud Run will automatically set PORT=8080

### 4. Database Connection
**Problem**: Cloud Run needs to connect to Cloud SQL or external database.

**Required**: 
- `DATABASE_URL` must be set in Cloud Run environment variables or Secret Manager
- If using Cloud SQL, ensure Cloud SQL connection is configured in Cloud Run service

### 5. Startup Timeout
**Problem**: Cloud Run has a default startup timeout. If the app takes too long to start, it will fail.

**Current Issues That May Slow Startup**:
- Database connection attempts
- Redis connection attempts (may fail gracefully)
- Scheduler initialization

**Recommendation**: 
- Increase Cloud Run startup timeout if needed
- Ensure health check endpoint responds quickly (before full initialization)

## Deployment Checklist

### Before Deploying to Cloud Run:

1. **Set Environment Variables in Cloud Run**:
   ```bash
   SESSION_SECRET=<32+ character secret>
   DATABASE_URL=<your-database-url>
   NODE_ENV=production
   PORT=5000
   ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
   ```

2. **Or Use Secret Manager** (Recommended):
   ```bash
   # Store secrets
   echo -n "your-secret" | gcloud secrets create session-secret --data-file=-
   echo -n "your-db-url" | gcloud secrets create database-url --data-file=-
   
   # In Cloud Run, reference secrets:
   SESSION_SECRET=session-secret:latest
   DATABASE_URL=database-url:latest
   ```

3. **Configure Cloud Run Service**:
   - Container port: **5000**
   - CPU: 2 (minimum recommended)
   - Memory: 2Gi (minimum recommended)
   - Timeout: 300s (5 minutes)
   - Startup timeout: 60s (or higher if needed)
   - Health check: `/health`
   - Max instances: 10 (or as needed)
   - Min instances: 0 (for cost savings)

4. **If Using Cloud SQL**:
   - Enable Cloud SQL connection in Cloud Run service
   - Add Cloud SQL instance connection name
   - Grant Cloud Run service account access to Cloud SQL

5. **Test Health Endpoint**:
   ```bash
   curl https://your-service-url/health
   # Should return: {"status":"ok","timestamp":"..."}
   ```

## Next Steps

1. ✅ Health check endpoint added
2. ✅ Environment validation updated
3. ⏳ Test locally with production-like environment
4. ⏳ Deploy to Cloud Run with proper environment variables
5. ⏳ Monitor Cloud Run logs for any startup issues

## Common Cloud Run Errors

### "Container failed to start"
- Check Cloud Run logs for startup errors
- Verify environment variables are set correctly
- Ensure health check endpoint is accessible

### "Health check failed"
- Verify `/health` endpoint returns 200 OK
- Check that server is listening on correct port
- Ensure startup completes within timeout period

### "Connection refused"
- Database: Verify DATABASE_URL is correct
- Redis: May fail gracefully, but check REDIS_URL if needed
- Cloud SQL: Ensure connection is configured in Cloud Run service

### "Environment validation failed"
- Check that SESSION_SECRET is 32+ characters
- Verify DATABASE_URL format is correct
- Ensure ALLOWED_ORIGINS URLs are valid (if set)

