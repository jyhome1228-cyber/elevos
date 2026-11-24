# ELEVOS Firebase beta setup

This is a private cloud-save beta, not an authoritative competitive multiplayer backend.

1. Create a Firebase project and register a Web app. Copy the public Web SDK configuration into firebase-config.js. Do not supply an Admin SDK key or service account credentials.
2. Enable Email/Password and Google providers in Authentication. Add jyhome1228-cyber.github.io to Authorized domains. Configure a support email for Google sign-in.
3. Create a Cloud Firestore database in production mode. Deploy firestore.rules using Firebase CLI or paste the rules in the console and publish. Do not use test mode.
4. Open the GitHub Pages site and use the Account menu. Sign in, then explicitly upload your current local career or restore a cloud save. Local data remains available without Firebase.
5. Test with two accounts: account A cannot read or write B's paths; signing out returns to guest storage; uploading guest data requires confirmation; cloud restores require confirmation. Test reload, different device, interrupted upload and concurrent writes.

## Storage
users/{uid}/career/main points to an immutable revision. Revisions contain separate chunk groups for core, players, matches, seasons, cups, scores, calendar, cards, economy. Chunks are deliberately small enough for Firestore document limits. Upload writes parts first, then atomically updates the pointer with a transaction that rejects stale revisions. Old revisions are retained; plan server-side retention and quota controls before public release. The current UI uses explicit manual backup/restore, not unattended synchronization.

## Before public release
Move match simulation, wallet, pack draws, rewards and leaderboard mutations to trusted server code. Client-owned backup documents cannot establish fair rankings. Admin privileges must use server-side custom claims and a separate privileged backend; do not expose admin keys to browsers. Add App Check, abuse limits, privacy policy, account deletion and data export, monitoring and automated security tests. No public ranking or admin console is enabled by this change.
