# Deploying to Prod

After pulling the latest code on the Prod server, run these so the app and **admin UI** are updated:

1. **Install dependencies** (if `package.json` or lockfile changed):
   ```bash
   cd /srv/furnitureapp
   npm ci
   ```

2. **Build the frontend** (required so Admin gets new UI; output goes to `server/public/`):
   ```bash
   npm run build
   ```

3. **Restart the app** (use whichever you use on Prod):
   - systemd: `sudo systemctl restart furnitureapp`
   - or: `npm run restart` (only if the app is not run by systemd/PM2)

4. **Hard-refresh the browser** (Ctrl+Shift+R / Cmd+Shift+R) when opening the admin page so cached JS is dropped.

Sessions are stored on disk, so restarting the server does **not** log you out of the admin console.
