/**
 * Generate VAPID Keys for Push Notifications
 * Run: npm run generate-vapid-keys
 */

import webpush from 'web-push';
import * as fs from 'fs';
import * as path from 'path';

const vapidKeys = webpush.generateVAPIDKeys();

console.log('\n🔑 VAPID Keys Generated:\n');
console.log('Public Key:');
console.log(vapidKeys.publicKey);
console.log('\nPrivate Key:');
console.log(vapidKeys.privateKey);
console.log('\n');

// Save to .env.example format
const envExample = `
# Push Notifications (VAPID Keys)
# Generate with: npm run generate-vapid-keys
VAPID_PUBLIC_KEY=${vapidKeys.publicKey}
VAPID_PRIVATE_KEY=${vapidKeys.privateKey}
VAPID_SUBJECT=mailto:admin@ganttium.com
`;

console.log('📝 Add these to your .env file:\n');
console.log(envExample);

// Optionally write to a file
const outputFile = path.resolve(import.meta.dirname, '..', 'vapid-keys.txt');
fs.writeFileSync(outputFile, envExample.trim());
console.log(`\n✅ Keys also saved to: ${outputFile}`);
console.log('⚠️  Remember to add these to your .env file and never commit them to git!\n');

