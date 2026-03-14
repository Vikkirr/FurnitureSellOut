# Sync DB from Dev (Prod pulls from Dev)

When running the app on **Prod**, "Sync DB from Dev" replaces Prod’s `catalog.db*` with copies from your Dev machine.

## 1. Prod: key and .env

On the **Prod** server:

1. **Create a key pair** (once) for syncing from Dev, e.g. in app root or `/srv/furnitureapp/.ssh/`:
   ```bash
   ssh-keygen -t ed25519 -f /srv/furnitureapp/.ssh/furniture_sync_dev_automation -N ""
   ```

2. **.env** on Prod must include:
   ```env
   SYNC_DEV_SSH_KEY_PATH=/srv/furnitureapp/.ssh/furniture_sync_dev_automation
   SYNC_DEV_HOST=192.168.2.64
   SYNC_DEV_USER=vik
   SYNC_DEV_DATA_PATH=/home/vik/Documents/FurnitureCatalogWeb/data
   ```
   Adjust `SYNC_DEV_HOST`, `SYNC_DEV_USER`, and `SYNC_DEV_DATA_PATH` if your Dev host/user/path differ.

3. **Permissions:** `chmod 600` the private key (the sync script does this at run time as well).

## 2. Dev: allow Prod to pull (rsync-only)

On your **Dev** machine (vik@192.168.2.64):

1. **Install the rsync-only script** so the Prod key can only run rsync (no shell):
   - Copy `scripts/rsync-only-dev.sh` to e.g. `/home/vik/rsync-only.sh`
   - `chmod 700 /home/vik/rsync-only.sh`

2. **Add Prod’s public key** to `~/.ssh/authorized_keys` with a forced command:
   ```text
   command="/home/vik/rsync-only.sh",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty ssh-ed25519 AAAA... your-comment
   ```
   Paste the **contents of** `furniture_sync_dev_automation.pub` (from Prod) after the options, on the same line.

3. Ensure `data/` (and `catalog.db*`) exists on Dev so rsync can read it.

After this, from the **Prod** admin UI, "Sync DB from Dev" will pull `catalog.db*` from Dev into Prod’s data dir.
