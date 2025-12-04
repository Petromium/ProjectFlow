# Marketing API Setup Guide

**Purpose:** Step-by-step instructions for configuring Google Analytics 4 and Search Console APIs for the admin dashboard.

---

## Prerequisites

1. Google Cloud Project (create at https://console.cloud.google.com)
2. Google Analytics 4 property (create at https://analytics.google.com)
3. Google Search Console property (verify site at https://search.google.com/search-console)

---

## Step 1: Create Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project (or create new one)
3. Navigate to **IAM & Admin** → **Service Accounts**
4. Click **Create Service Account**
5. Fill in:
   - **Name**: `projectflow-marketing-api`
   - **Description**: `Service account for Marketing Dashboard APIs`
6. Click **Create and Continue**
7. Skip role assignment (click **Continue**)
8. Click **Done**

---

## Step 2: Generate Service Account Key

1. Click on the newly created service account
2. Go to **Keys** tab
3. Click **Add Key** → **Create new key**
4. Select **JSON** format
5. Click **Create** (JSON file downloads automatically)
6. **Save this file securely** - you'll need it for credentials

---

## Step 3: Enable Required APIs

### Google Analytics Data API

1. Go to [API Library](https://console.cloud.google.com/apis/library)
2. Search for "Google Analytics Data API"
3. Click on it and click **Enable**

### Google Search Console API

1. In API Library, search for "Google Search Console API"
2. Click on it and click **Enable**

---

## Step 4: Configure Google Analytics 4 Access

1. Go to [Google Analytics](https://analytics.google.com)
2. Select your GA4 property
3. Click **Admin** (gear icon) → **Property Access Management**
4. Click **+** → **Add users**
5. Enter your service account email (found in the JSON file: `client_email`)
6. Select role: **Viewer**
7. Click **Add**

**Note**: Copy the Property ID (format: `123456789`) - you'll need it for `GOOGLE_ANALYTICS_PROPERTY_ID`

---

## Step 5: Configure Search Console Access

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Select your property
3. Click **Settings** → **Users and permissions**
4. Click **Add user**
5. Enter your service account email
6. Select permission: **Full**
7. Click **Add**

**Note**: Copy your site URL (format: `sc-domain:example.com` or `https://example.com`) - you'll need it for `GOOGLE_SEARCH_CONSOLE_SITE_URL`

---

## Step 6: Configure Environment Variables

### Option A: Environment Variables (Development)

Add to your `.env` file:

```bash
# Google Analytics 4
GOOGLE_ANALYTICS_PROPERTY_ID=123456789
GOOGLE_ANALYTICS_CREDENTIALS='{"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'

# Google Search Console
GOOGLE_SEARCH_CONSOLE_SITE_URL=sc-domain:example.com
GOOGLE_SEARCH_CONSOLE_CREDENTIALS='{"type":"service_account",...}'  # Same JSON as above
```

**Note**: The JSON must be a single-line string. Use a tool like `jq` to compress it:
```bash
cat service-account-key.json | jq -c
```

### Option B: Google Cloud Secret Manager (Production)

1. Go to [Secret Manager](https://console.cloud.google.com/security/secret-manager)
2. Click **Create Secret**
3. Name: `GOOGLE_ANALYTICS_CREDENTIALS`
4. Upload the JSON file content
5. Click **Create Secret**
6. Repeat for `GOOGLE_SEARCH_CONSOLE_CREDENTIALS`

Set environment variables:
```bash
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_ANALYTICS_PROPERTY_ID=123456789
GOOGLE_SEARCH_CONSOLE_SITE_URL=sc-domain:example.com
```

The service will automatically fetch credentials from Secret Manager.

---

## Step 7: Verify Configuration

1. Restart your server
2. Check server logs for:
   - `[GA4] Initialized for property: 123456789`
   - `[Search Console] Initialized for site: sc-domain:example.com`
3. Access Admin Dashboard → Marketing & SEO tab
4. Verify metrics are populated (not zeros)

---

## Troubleshooting

### "Property not found" Error
- Verify `GOOGLE_ANALYTICS_PROPERTY_ID` is correct (numeric, no `properties/` prefix)
- Ensure service account has access in GA4

### "Site not found" Error
- Verify `GOOGLE_SEARCH_CONSOLE_SITE_URL` format:
  - Domain property: `sc-domain:example.com`
  - URL prefix: `https://example.com`
- Ensure service account has access in Search Console

### "Permission denied" Error
- Verify APIs are enabled in Cloud Console
- Check service account has correct roles:
  - GA4: Viewer
  - Search Console: Full

### Credentials Not Found
- Check JSON file path and format
- Verify environment variables are set correctly
- For Secret Manager: Ensure `GOOGLE_PROJECT_ID` is set

### Placeholder Data Still Showing
- Check server logs for initialization messages
- Verify credentials are valid JSON
- Test API access manually using `gcloud auth application-default login`

---

## Security Best Practices

1. **Never commit credentials to Git**
   - Add `.env` to `.gitignore`
   - Use Secret Manager in production

2. **Rotate credentials regularly**
   - Generate new service account keys quarterly
   - Update Secret Manager secrets

3. **Limit service account permissions**
   - Use minimal required roles (Viewer for GA4, Full for Search Console)
   - Don't grant admin roles

4. **Monitor API usage**
   - Set up Cloud Monitoring alerts
   - Review API quotas in Cloud Console

---

## Testing

Run unit tests to verify services work:
```bash
npm test -- tests/unit/marketingAnalytics.test.ts
npm test -- tests/unit/searchConsole.test.ts
npm test -- tests/unit/leadScoring.test.ts
npm test -- tests/unit/seoHealth.test.ts
```

---

## Next Steps

Once APIs are configured:
1. Monitor metrics in Admin Dashboard
2. Set up automated SEO health checks (via scheduler)
3. Review lead scores and identify PQLs
4. Act on SEO recommendations

---

**Last Updated:** 2025-01-04  
**Status:** ✅ Phase 2 Complete

