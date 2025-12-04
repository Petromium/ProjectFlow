# Branding Update: Ganttium

> **Date:** 2025-01-04  
> **Status:** Complete

---

## Overview

The application has been rebranded from "ProjectFlow" to **Ganttium**.

**Domain:** Ganttium.com  
**App Name:** Ganttium

---

## Changes Made

### Documentation Files Updated

1. **Project Charter** (`Documents/docs/Project_Charter.md`)
   - Updated title from "ProjectFlow EPC PMIS" to "Ganttium EPC PMIS"

2. **Roadmap** (`Documents/docs/Roadmap.md`)
   - Updated title from "ProjectFlow Development Roadmap" to "Ganttium Development Roadmap"

3. **PWA Implementation** (`Documents/docs/PWA_IMPLEMENTATION.md`)
   - Updated references from "ProjectFlow PMIS" to "Ganttium"

4. **PWA Setup Guide** (`Documents/docs/PWA_SETUP_GUIDE.md`)
   - Updated VAPID_SUBJECT from `mailto:admin@projectflow.com` to `mailto:admin@ganttium.com`

### Application Files Updated

1. **Web App Manifest** (`client/public/manifest.json`)
   - Updated `name` from "ProjectFlow PMIS" to "Ganttium"
   - Updated `short_name` from "ProjectFlow" to "Ganttium"

2. **HTML Meta Tags** (`client/index.html`)
   - Updated `<title>` to "Ganttium - Project Management Information System"
   - Updated `apple-mobile-web-app-title` to "Ganttium"

3. **UI Components**
   - **LoginPage** (`client/src/pages/LoginPage.tsx`): Updated title to "Ganttium"
   - **InstallPrompt** (`client/src/components/InstallPrompt.tsx`): Updated text to "Install Ganttium"

4. **Backend Services**
   - **Push Notification Service** (`server/services/pushNotificationService.ts`): Updated VAPID_SUBJECT default
   - **VAPID Key Generator** (`server/scripts/generateVAPIDKeys.ts`): Updated default email
   - **Auth Service** (`server/auth.ts`): Updated session name
   - **Cloud Logging** (`server/services/cloudLogging.ts`): Updated log name from 'projectflow' to 'ganttium'

5. **IndexedDB** (`client/src/lib/indexeddb.ts`)
   - Updated database name from `ProjectFlowDB` to `GanttiumDB`
   - **Note:** Existing users will need to re-cache data as this creates a new database

---

## Environment Variables

Update your `.env` file with the new domain:

```env
# Push Notifications
VAPID_SUBJECT=mailto:admin@ganttium.com

# Cloud Logging (optional)
GCP_LOG_NAME=ganttium

# Domain (if used in configuration)
APP_DOMAIN=ganttium.com
```

---

## Migration Notes

### IndexedDB Database Name Change

The IndexedDB database name has been changed from `ProjectFlowDB` to `GanttiumDB`. This means:

- **Existing users:** Will need to re-cache data (will happen automatically on next use)
- **No data loss:** Server-side data is unaffected
- **Automatic migration:** The app will create the new database automatically

### VAPID Keys

If you've already generated VAPID keys, you don't need to regenerate them. However, update the `VAPID_SUBJECT` in your `.env` file to use the new domain.

---

## Next Steps

1. **Update Production Environment Variables**
   - Set `VAPID_SUBJECT=mailto:admin@ganttium.com`
   - Update `GCP_LOG_NAME=ganttium` if using Google Cloud Logging

2. **DNS Configuration**
   - Point `ganttium.com` to your production server
   - Configure SSL certificate for the new domain

3. **Update External References**
   - Update any external documentation or marketing materials
   - Update OAuth redirect URIs if using Google OAuth
   - Update email templates if they reference the old name

4. **User Communication**
   - Notify existing users of the rebranding
   - Update help documentation
   - Update support email addresses if needed

---

## Verification Checklist

- [x] Documentation updated
- [x] Manifest.json updated
- [x] HTML meta tags updated
- [x] UI components updated
- [x] Backend services updated
- [x] IndexedDB database name updated
- [ ] Environment variables updated in production
- [ ] DNS configured for ganttium.com
- [ ] SSL certificate configured
- [ ] OAuth redirect URIs updated
- [ ] Email templates updated
- [ ] User communication sent

---

**Last Updated:** 2025-01-04

