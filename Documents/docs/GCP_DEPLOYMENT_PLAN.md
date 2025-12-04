# GCP Deployment Plan for ProjectFlow

## Overview
Deploy ProjectFlow to Google Cloud Platform using Cloud Run, Cloud SQL, and existing infrastructure. The plan uses existing environment variables from `.env` and the `cloudbuild.yaml` configuration.

## Prerequisites Check

### 1. Verify `.env` Contains Required Variables
Check your `.env` file has:
- `GOOGLE_PROJECT_ID` or `GCLOUD_PROJECT` - Your GCP project ID
- `DATABASE_URL` - PostgreSQL connection string (can be Neon or Cloud SQL)
- `SESSION_SECRET` - At least 32 characters
- `ALLOWED_ORIGINS` - Comma-separated list of allowed origins (optional)

### 2. GCP Account Setup
1. Go to [GCP Console](https://console.cloud.google.com)
2. Verify billing is enabled
3. Enable required APIs:
   ```bash
   gcloud services enable run.googleapis.com
   gcloud services enable sqladmin.googleapis.com
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable secretmanager.googleapis.com
   gcloud services enable logging.googleapis.com
   ```

## Phase 1: Database Setup

### Option A: Use Existing Neon Database (Quick Start)
- Keep `DATABASE_URL` pointing to Neon
- Proceed to Phase 2
- Can migrate to Cloud SQL later if needed

### Option B: Create Cloud SQL Instance (Recommended for Production)

1. **Create Cloud SQL PostgreSQL instance:**
   ```bash
   # Get project ID from .env
   PROJECT_ID=$(grep GOOGLE_PROJECT_ID .env | cut -d '=' -f2)
   
   gcloud sql instances create projectflow-db \
     --project=$PROJECT_ID \
     --database-version=POSTGRES_15 \
     --tier=db-f1-micro \
     --region=us-central1 \
     --root-password=$(openssl rand -base64 32)
   ```

2. **Create database:**
   ```bash
   gcloud sql databases create projectflow --instance=projectflow-db
   ```

3. **Create database user:**
   ```bash
   gcloud sql users create projectflow-user \
     --instance=projectflow-db \
     --password=$(openssl rand -base64 32)
   ```

4. **Get connection name:**
   ```bash
   CONNECTION_NAME=$(gcloud sql instances describe projectflow-db \
     --format="value(connectionName)")
   echo $CONNECTION_NAME
   ```

5. **Update DATABASE_URL:**
   - Format: `postgresql://projectflow-user:password@/projectflow?host=/cloudsql/$CONNECTION_NAME`
   - Store in Secret Manager (see Phase 2)

## Phase 2: Environment Variables Setup

### Store Secrets in Secret Manager

1. **Get project ID:**
   ```bash
   PROJECT_ID=$(grep GOOGLE_PROJECT_ID .env | cut -d '=' -f2)
   ```

2. **Store DATABASE_URL:**
   ```bash
   # Read from .env
   DATABASE_URL=$(grep DATABASE_URL .env | cut -d '=' -f2-)
   
   # Store in Secret Manager
   echo -n "$DATABASE_URL" | gcloud secrets create database-url \
     --project=$PROJECT_ID \
     --data-file=-
   ```

3. **Store SESSION_SECRET:**
   ```bash
   SESSION_SECRET=$(grep SESSION_SECRET .env | cut -d '=' -f2)
   echo -n "$SESSION_SECRET" | gcloud secrets create session-secret \
     --project=$PROJECT_ID \
     --data-file=-
   ```

4. **Store other secrets as needed:**
   ```bash
   # Example: Store API keys
   GEMINI_API_KEY=$(grep GEMINI_API_KEY .env | cut -d '=' -f2)
   echo -n "$GEMINI_API_KEY" | gcloud secrets create gemini-api-key \
     --project=$PROJECT_ID \
     --data-file=-
   ```

### Grant Cloud Run Access to Secrets
```bash
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
SERVICE_ACCOUNT="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding database-url \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor" \
  --project=$PROJECT_ID

gcloud secrets add-iam-policy-binding session-secret \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor" \
  --project=$PROJECT_ID
```

## Phase 3: Build and Push Docker Image

1. **Authenticate Docker:**
   ```bash
   gcloud auth configure-docker
   ```

2. **Build and push image:**
   ```bash
   PROJECT_ID=$(grep GOOGLE_PROJECT_ID .env | cut -d '=' -f2)
   
   # Build
   docker build -t gcr.io/$PROJECT_ID/projectflow:latest .
   
   # Push
   docker push gcr.io/$PROJECT_ID/projectflow:latest
   ```

## Phase 4: Deploy to Cloud Run

1. **Deploy service:**
   ```bash
   PROJECT_ID=$(grep GOOGLE_PROJECT_ID .env | cut -d '=' -f2)
   CONNECTION_NAME=$(gcloud sql instances describe projectflow-db \
     --format="value(connectionName)" 2>/dev/null || echo "")
   
   gcloud run deploy projectflow \
     --image gcr.io/$PROJECT_ID/projectflow:latest \
     --region us-central1 \
     --platform managed \
     --allow-unauthenticated \
     --set-env-vars "NODE_ENV=production,GOOGLE_PROJECT_ID=$PROJECT_ID,GCLOUD_PROJECT=$PROJECT_ID" \
     --set-secrets "DATABASE_URL=database-url:latest,SESSION_SECRET=session-secret:latest" \
     --add-cloudsql-instances $CONNECTION_NAME \
     --memory 2Gi \
     --cpu 2 \
     --timeout 300 \
     --max-instances 10 \
     --min-instances 0 \
     --port 5000
   ```

2. **Note the service URL** from the output (e.g., `https://projectflow-xxxxx-uc.a.run.app`)

## Phase 5: Database Migration

1. **Run migrations using Cloud Run job (recommended):**
   ```bash
   # Create a one-time Cloud Run job for migrations
   gcloud run jobs create projectflow-migrate \
     --image gcr.io/$PROJECT_ID/projectflow:latest \
     --region us-central1 \
     --set-env-vars "NODE_ENV=production,GOOGLE_PROJECT_ID=$PROJECT_ID,RUN_MIGRATIONS=true" \
     --set-secrets "DATABASE_URL=database-url:latest,SESSION_SECRET=session-secret:latest" \
     --add-cloudsql-instances $CONNECTION_NAME \
     --memory 1Gi \
     --cpu 1 \
     --command "node" \
     --args "dist/index.js","--migrate"
   ```

2. **Or run locally with Cloud SQL proxy:**
   ```bash
   # Download Cloud SQL proxy
   curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.linux.amd64
   chmod +x cloud-sql-proxy
   
   # Start proxy
   ./cloud-sql-proxy $CONNECTION_NAME &
   
   # Update DATABASE_URL temporarily
   export DATABASE_URL="postgresql://user:password@127.0.0.1:5432/projectflow"
   
   # Run migrations
   npm run db:push
   ```

3. **Verify schema:**
   ```bash
   npm run verify:schema
   ```

## Phase 6: Domain Configuration

1. **Map custom domain:**
   ```bash
   gcloud run domain-mappings create \
     --service projectflow \
     --domain yourdomain.com \
     --region us-central1
   ```

2. **Update DNS records:**
   - GCP will provide DNS records to add
   - Add A record or CNAME as instructed
   - Wait for DNS propagation (can take up to 48 hours)

3. **Update ALLOWED_ORIGINS in Secret Manager:**
   ```bash
   echo -n "https://yourdomain.com,https://www.yourdomain.com" | \
     gcloud secrets create allowed-origins \
     --project=$PROJECT_ID \
     --data-file=-
   
   # Update Cloud Run service
   gcloud run services update projectflow \
     --region us-central1 \
     --set-secrets "ALLOWED_ORIGINS=allowed-origins:latest"
   ```

## Phase 7: CI/CD Setup (Optional)

1. **Enable Cloud Build:**
   ```bash
   gcloud services enable cloudbuild.googleapis.com
   ```

2. **Update `cloudbuild.yaml`:**
   - Uncomment lines 74-89 (deployment step)
   - Update `_REGION` if different from `us-central1`

3. **Grant Cloud Build permissions:**
   ```bash
   PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
   gcloud projects add-iam-policy-binding $PROJECT_ID \
     --member="serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
     --role="roles/run.admin"
   
   gcloud projects add-iam-policy-binding $PROJECT_ID \
     --member="serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
     --role="roles/iam.serviceAccountUser"
   ```

4. **Create build trigger (if using GitHub):**
   ```bash
   gcloud builds triggers create github \
     --repo-name=<your-repo> \
     --repo-owner=<your-username> \
     --branch-pattern="^main$" \
     --build-config=cloudbuild.yaml \
     --project=$PROJECT_ID
   ```

## Phase 8: Monitoring & Logging

1. **Verify Cloud Logging:**
   ```bash
   gcloud logging read "resource.type=cloud_run_revision" \
     --limit 50 \
     --format json
   ```

2. **Set up alerts (optional):**
   - Go to Cloud Monitoring → Alerting
   - Create alert policies for:
     - Error rate > 5%
     - Latency > 1s (p95)
     - Memory usage > 80%

## Phase 9: Post-Deployment Verification

1. **Health check:**
   ```bash
   SERVICE_URL=$(gcloud run services describe projectflow \
     --region us-central1 \
     --format="value(status.url)")
   curl $SERVICE_URL/health
   ```

2. **Test authentication flow:**
   - Visit service URL
   - Test login/registration
   - Verify sessions work

3. **Test database connectivity:**
   - Create a test project
   - Verify data persists

4. **Verify environment variables:**
   ```bash
   gcloud run services describe projectflow \
     --region us-central1 \
     --format="value(spec.template.spec.containers[0].env)"
   ```

## Files to Create/Update

### 1. Create `.gcloudignore`
```gitignore
node_modules/
dist/
.env
.env.local
.env.*.local
*.log
.DS_Store
.git/
.vscode/
.idea/
coverage/
tests/
*.test.ts
*.spec.ts
playwright-report/
```

### 2. Create `server/.env.production` (template)
```env
NODE_ENV=production
PORT=5000
# GOOGLE_PROJECT_ID and GCLOUD_PROJECT will be set via Cloud Run env vars
# DATABASE_URL and SESSION_SECRET will be loaded from Secret Manager
```

### 3. Update `cloudbuild.yaml`
- Uncomment deployment step (lines 74-89)
- Verify `_REGION` matches your region

### 4. Create `Documents/docs/DEPLOYMENT.md`
- Document deployment process
- Include rollback procedures
- Document environment variables

## Rollback Plan

If deployment fails:

1. **Keep previous Cloud Run revision:**
   ```bash
   # List revisions
   gcloud run revisions list --service projectflow --region us-central1
   
   # Rollback to previous revision
   gcloud run services update-traffic projectflow \
     --to-revisions <PREVIOUS_REVISION>=100 \
     --region us-central1
   ```

2. **Or redeploy previous image:**
   ```bash
   gcloud run deploy projectflow \
     --image gcr.io/$PROJECT_ID/projectflow:<previous-tag> \
     --region us-central1
   ```

## Troubleshooting

### Common Issues

1. **"Permission denied" errors:**
   - Verify IAM roles are assigned correctly
   - Check service account permissions

2. **Database connection errors:**
   - Verify Cloud SQL instance is running
   - Check connection name format
   - Verify Cloud SQL proxy is configured

3. **Secret Manager access errors:**
   - Verify secrets exist: `gcloud secrets list`
   - Check IAM bindings for service account

4. **Build failures:**
   - Check Cloud Build logs
   - Verify Dockerfile builds locally
   - Check for missing dependencies

## Estimated Time
- Database setup: 15-30 minutes
- Environment setup: 10-15 minutes
- Build & deploy: 10-20 minutes
- Domain setup: 15-30 minutes
- Verification: 15-20 minutes
**Total: 1.5-2 hours**

## Notes
- Uses existing `Dockerfile` and `cloudbuild.yaml`
- Assumes `us-central1` region (can be changed in commands)
- Database can start with Neon, migrate to Cloud SQL later
- All sensitive values stored in Secret Manager
- Cloud Run auto-scales based on traffic (0-10 instances)
- Health check endpoint: `/health` (verify this exists in your app)

## Next Steps After Deployment
1. Configure payment system (from backlog)
2. Set up monitoring alerts
3. Configure backup strategy for Cloud SQL
4. Set up staging environment (optional)
5. Configure CDN (Cloud CDN) for static assets

