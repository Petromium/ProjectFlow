# PWA Setup Guide

> **Quick Start:** Get your PWA up and running in 5 minutes

---

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database configured
- `.env` file with `DATABASE_URL` and `SESSION_SECRET`

---

## Step 1: Generate VAPID Keys

VAPID keys are required for push notifications. Generate them once:

```bash
npm run generate-vapid-keys
```

This will:
1. Generate public and private VAPID keys
2. Display them in the console
3. Save them to `vapid-keys.txt`

**⚠️ Important:** Copy the keys to your `.env` file:

```env
VAPID_PUBLIC_KEY=your-public-key-here
VAPID_PRIVATE_KEY=your-private-key-here
VAPID_SUBJECT=mailto:admin@ganttium.com
```

**Never commit VAPID keys to git!**

---

## Step 2: Start the Server

```bash
npm run dev
```

The PWA will be available at `http://localhost:5000`

---

## Step 3: Test PWA Features

### Service Worker Registration

1. Open Chrome DevTools → Application tab
2. Check "Service Workers" section
3. You should see `sw.js` registered and active

### Offline Mode

1. Open DevTools → Network tab
2. Check "Offline" checkbox
3. Navigate the app - it should work offline
4. Make changes - they'll be queued for sync

### Install Prompt

1. Visit the app in Chrome/Edge
2. After 3 seconds, an install prompt should appear
3. Click "Install" to add to home screen

### Push Notifications

1. Go to Settings page
2. Find "Push Notifications" section
3. Click "Enable Push Notifications"
4. Allow notifications when prompted
5. Test by triggering a notification (e.g., create a task)

---

## Troubleshooting

### Service Worker Not Registering

**Check:**
- Is the app served over HTTPS? (required for production)
- Is `sw.js` accessible at `/sw.js`?
- Check browser console for errors

**Fix:**
- Ensure `client/public/sw.js` exists
- Check Vite config includes public directory
- Verify server is serving static files correctly

### Push Notifications Not Working

**Check:**
- Are VAPID keys in `.env`?
- Is `VAPID_SUBJECT` set?
- Check browser console for errors

**Fix:**
1. Regenerate VAPID keys: `npm run generate-vapid-keys`
2. Add keys to `.env`
3. Restart server
4. Clear browser cache and re-subscribe

### Offline Mode Not Working

**Check:**
- Is IndexedDB accessible? (DevTools → Application → IndexedDB)
- Check service worker cache (DevTools → Application → Cache Storage)
- Verify network-first strategy is working

**Fix:**
- Clear service worker cache
- Unregister service worker and reload
- Check browser console for errors

---

## Production Deployment

### 1. Build the App

```bash
npm run build
```

### 2. Set Environment Variables

Ensure these are set in production:
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `DATABASE_URL`
- `SESSION_SECRET`

### 3. Serve Static Files

The built app is in `dist/public/`. Ensure your server serves:
- `/sw.js` (Service Worker)
- `/manifest.json` (Web App Manifest)
- `/favicon.png` (App icon)

### 4. HTTPS Required

PWAs require HTTPS in production. Ensure:
- SSL certificate is configured
- All requests redirect to HTTPS
- Service Worker is served over HTTPS

---

## Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Service Worker | ✅ | ✅ | ✅ | ✅ |
| Offline Caching | ✅ | ✅ | ✅ | ✅ |
| Install Prompt | ✅ | ✅ | ⚠️ Limited | ✅ |
| Push Notifications | ✅ | ✅ | ❌ | ✅ |
| Background Sync | ✅ | ✅ | ❌ | ✅ |

**Note:** Safari on iOS has limited PWA support. Some features may not work.

---

## Next Steps

1. **Customize Icons:** Replace `/favicon.png` with your app icon (192x192 and 512x512)
2. **Update Manifest:** Edit `client/public/manifest.json` with your app details
3. **Test Offline:** Test all features in offline mode
4. **Monitor Performance:** Use Lighthouse to audit PWA score
5. **User Testing:** Get feedback from users on offline experience

---

## Resources

- [Web App Manifest Spec](https://www.w3.org/TR/appmanifest/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [PWA Checklist](https://web.dev/pwa-checklist/)

---

**Last Updated:** 2025-01-04

