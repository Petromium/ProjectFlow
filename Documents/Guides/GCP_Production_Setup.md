# Google Cloud Platform Production Setup Guide

This guide covers setting up Google Cloud Platform services for production deployment of ProjectFlow.

## Prerequisites

1. Google Cloud Project created
2. Google Cloud SDK installed (`gcloud` CLI)
3. Billing enabled on GCP project
4. Required APIs enabled (see below)

## Step 1: Enable Required APIs

Enable the following APIs in Google Cloud Console:

```bash
gcloud services enable \
  logging.googleapis.com \
  monitoring.googleapis.com \
  secretmanager.googleapis.com \
  storage-component.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  sqladmin.googleapis.com
```

Or enable via Console:
- Go to [APIs & Services > Library](https://console.cloud.google.com/apis/library)
- Search and enable each API listed above

## Step 2: Set Up Cloud Logging

Cloud Logging is automatically initialized when `GOOGLE_PROJECT_ID` is set in production.

### Configuration

Set environment variable:
```bash
export GOOGLE_PROJECT_ID=your-project-id
```

### Log Levels

The application uses structured logging with the following severity levels:
- `DEBUG`: Detailed debugging information
- `INFO`: General informational messages
- `WARNING`: Warning messages
- `ERROR`: Error messages
- `CRITICAL`: Critical errors requiring immediate attention

### Viewing Logs

1. **Via Console:**
   - Go to [Cloud Logging](https://console.cloud.google.com/logs)
   - Filter by log name: `projectflow`

2. **Via CLI:**
   ```bash
   gcloud logging read "logName=projects/YOUR_PROJECT_ID/logs/projectflow" --limit 50
   ```

## Step 3: Set Up Cloud Monitoring

Cloud Monitoring automatically tracks:
- API response times
- API request counts
- Error counts
- Database query times
- Active user counts
- WebSocket connections

### Viewing Metrics

1. **Via Console:**
   - Go to [Cloud Monitoring](https://console.cloud.google.com/monitoring)
   - Navigate to Metrics Explorer
   - Search for `custom.googleapis.com/api/response_time` or other custom metrics

2. **Create Dashboard:**
   - Go to Dashboards > Create Dashboard
   - Add charts for:
     - API Response Time (line chart)
     - API Request Count (bar chart)
     - Error Count (line chart)

## Step 4: Set Up Secret Manager

### Migrating Secrets from Environment Variables

1. **Create secrets in Secret Manager:**
   ```bash
   # Session secret
   echo -n "your-session-secret" | gcloud secrets create SESSION_SECRET --data-file=-
   
   # Database URL
   echo -n "postgresql://..." | gcloud secrets create DATABASE_URL --data-file=-
   
   # Other secrets
   echo -n "your-secret-value" | gcloud secrets create SECRET_NAME --data-file=-
   ```

2. **Grant access to Cloud Run service account:**
   ```bash
   PROJECT_ID=your-project-id
   PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
   SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
   
   gcloud secrets add-iam-policy-binding SESSION_SECRET \
     --member="serviceAccount:${SERVICE_ACCOUNT}" \
     --role="roles/secretmanager.secretAccessor"
   ```

3. **Update application:**
   - The application automatically uses Secret Manager in production
   - Secrets are cached for 5 minutes to reduce API calls
   - Falls back to environment variables if secret not found

### Best Practices

- **Never commit secrets to git**
- **Use Secret Manager for all production secrets**
- **Rotate secrets regularly**
- **Use different secrets for dev/staging/production**

## Step 5: Set Up Database Backups

### Create Backup Bucket

```bash
BUCKET_NAME=projectflow-backups-$(date +%s)
gsutil mb -l us-central1 gs://${BUCKET_NAME}
```

### Set Environment Variables

```bash
export GCS_BACKUP_BUCKET=projectflow-backups-xxxxx
export GCS_BACKUP_PREFIX=database-backups
export BACKUP_RETENTION_DAYS=30
export BACKUP_COMPRESS=true
```

### Schedule Automated Backups

**Option 1: Cloud Scheduler (Recommended)**

```bash
gcloud scheduler jobs create http backup-database \
  --schedule="0 2 * * *" \
  --uri="https://YOUR_CLOUD_RUN_URL/api/admin/backup" \
  --http-method=POST \
  --oidc-service-account-email=SERVICE_ACCOUNT_EMAIL \
  --time-zone="America/Los_Angeles"
```

**Option 2: Cron Job (if running on VM)**

Add to crontab:
```bash
0 2 * * * /path/to/node /path/to/server/scripts/backupDatabase.js
```

### Manual Backup

```bash
node server/scripts/backupDatabase.js
```

## Step 6: Set Up Cloud Build CI/CD

### Create Cloud Build Trigger

1. **Via Console:**
   - Go to [Cloud Build > Triggers](https://console.cloud.google.com/cloud-build/triggers)
   - Click "Create Trigger"
   - Connect your GitHub repository
   - Set trigger configuration:
     - Event: Push to branch
     - Branch: `^main$`
     - Build configuration: Cloud Build configuration file
     - Location: `cloudbuild.yaml`

2. **Via CLI:**
   ```bash
   gcloud builds triggers create github \
     --name="projectflow-ci-cd" \
     --repo-name="YOUR_REPO" \
     --repo-owner="YOUR_GITHUB_USERNAME" \
     --branch-pattern="^main$" \
     --build-config="cloudbuild.yaml"
   ```

### Build Configuration

The `cloudbuild.yaml` file defines:
1. Install dependencies
2. Type checking
3. Unit tests
4. Build client and server
5. Build Docker image
6. Push to Container Registry
7. (Optional) Deploy to Cloud Run

## Step 7: Deploy to Cloud Run

### Build and Push Image Manually

```bash
# Build image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/projectflow

# Deploy to Cloud Run
gcloud run deploy projectflow \
  --image gcr.io/YOUR_PROJECT_ID/projectflow \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,GOOGLE_PROJECT_ID=YOUR_PROJECT_ID" \
  --set-secrets="SESSION_SECRET=SESSION_SECRET:latest,DATABASE_URL=DATABASE_URL:latest"
```

### Environment Variables

Required environment variables:
- `NODE_ENV=production`
- `GOOGLE_PROJECT_ID`: Your GCP project ID
- `DATABASE_URL`: PostgreSQL connection string (use Secret Manager)
- `SESSION_SECRET`: Session encryption secret (use Secret Manager)
- `ALLOWED_ORIGINS`: Comma-separated list of allowed origins

Optional environment variables:
- `GCP_LOG_NAME`: Custom log name (default: `projectflow`)
- `GCS_BACKUP_BUCKET`: Backup bucket name
- `GCS_BACKUP_PREFIX`: Backup prefix (default: `database-backups`)
- `BACKUP_RETENTION_DAYS`: Backup retention days (default: 30)

## Step 8: Set Up Cloud Armor (WAF & DDoS Protection)

### Create Security Policy

```bash
gcloud compute security-policies create projectflow-waf \
  --description "WAF policy for ProjectFlow"
```

### Add Rules

```bash
# Rate limiting rule
gcloud compute security-policies rules create 1000 \
  --security-policy projectflow-waf \
  --expression "true" \
  --action "rate-based-ban" \
  --rate-limit-threshold-count 100 \
  --rate-limit-threshold-interval-sec 60 \
  --ban-duration-sec 600 \
  --conform-action allow \
  --exceed-action deny-429

# SQL injection protection
gcloud compute security-policies rules create 2000 \
  --security-policy projectflow-waf \
  --expression "request.path.matches('.*(union|select|insert|delete|update|drop|exec).*')" \
  --action deny-403
```

### Attach to Load Balancer

```bash
gcloud compute backend-services update BACKEND_SERVICE_NAME \
  --security-policy projectflow-waf \
  --global
```

## Step 9: Monitoring & Alerts

### Create Alert Policies

1. **High Error Rate Alert:**
   ```bash
   gcloud alpha monitoring policies create \
     --notification-channels=CHANNEL_ID \
     --display-name="High Error Rate" \
     --condition-threshold-value=10 \
     --condition-threshold-duration=300s \
     --condition-filter='resource.type="global" AND metric.type="custom.googleapis.com/errors/count"'
   ```

2. **Slow API Response Alert:**
   ```bash
   gcloud alpha monitoring policies create \
     --notification-channels=CHANNEL_ID \
     --display-name="Slow API Response" \
     --condition-threshold-value=1000 \
     --condition-threshold-duration=300s \
     --condition-filter='resource.type="global" AND metric.type="custom.googleapis.com/api/response_time"'
   ```

### Set Up Notification Channels

1. Go to [Monitoring > Alerting](https://console.cloud.google.com/monitoring/alerting)
2. Click "Edit Notification Channels"
3. Add email/SMS/PagerDuty channels

## Step 10: Cost Optimization

### Estimated Monthly Costs

- **Cloud Logging:** Free (50GB/month included)
- **Cloud Monitoring:** Free (150MB metrics/month included)
- **Secret Manager:** ~$1-5 (depending on number of secrets)
- **Cloud Storage (backups):** ~$1-5 (depending on database size)
- **Cloud Build:** Free (120 build-minutes/day included)
- **Cloud Run:** Pay per request (~$0.40 per million requests)
- **Cloud Armor:** ~$5-20 (depending on traffic)

**Total:** ~$10-30/month for typical usage

### Cost Optimization Tips

1. **Use Cloud Run** (pay per request) instead of always-on VMs
2. **Set up log retention policies** to avoid excessive log storage
3. **Use Cloud Storage lifecycle policies** for old backups
4. **Monitor costs** via [Billing Dashboard](https://console.cloud.google.com/billing)

## Troubleshooting

### Cloud Logging Not Working

1. Check `GOOGLE_PROJECT_ID` is set correctly
2. Verify Cloud Logging API is enabled
3. Check service account has `roles/logging.logWriter` permission

### Cloud Monitoring Not Working

1. Check `GOOGLE_PROJECT_ID` is set correctly
2. Verify Cloud Monitoring API is enabled
3. Check service account has `roles/monitoring.metricWriter` permission

### Secret Manager Access Denied

1. Verify service account has `roles/secretmanager.secretAccessor` role
2. Check secret exists: `gcloud secrets list`
3. Verify secret version exists: `gcloud secrets versions list SECRET_NAME`

### Backup Failures

1. Check `DATABASE_URL` is correct
2. Verify `pg_dump` is installed on the system
3. Check GCS bucket exists and is accessible
4. Verify service account has `roles/storage.objectCreator` permission

## Next Steps

1. Set up monitoring dashboards
2. Configure alert policies
3. Set up automated backups
4. Enable Cloud Armor WAF
5. Review security best practices
6. Set up cost budgets and alerts

## Additional Resources

- [Cloud Logging Documentation](https://cloud.google.com/logging/docs)
- [Cloud Monitoring Documentation](https://cloud.google.com/monitoring/docs)
- [Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)
- [Cloud Build Documentation](https://cloud.google.com/build/docs)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)

