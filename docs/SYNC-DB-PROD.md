# Sync DB from Prod / Sync DB to Prod (Dev only)

Both buttons are used **on the Dev VM** only. They use the same key and `SYNC_PROD_*` env.

- **Sync DB from Prod** — Pull Prod’s `catalog.db*` into Dev (replace Dev’s DB with Prod’s).
- **Sync DB to Prod** — Push Dev’s `catalog.db*` to Prod (replace Prod’s DB with Dev’s).

## Dev: .env

On Dev, set (example):

```env
SYNC_PROD_SSH_KEY_PATH=./furniture_sync_prod_automation
SYNC_PROD_HOST=159.65.174.226
SYNC_PROD_USER=root
SYNC_PROD_DATA_PATH=/srv/furnitureapp/data
```

## Prod: allow both pull and push

Prod must allow the Dev key to run rsync in **sender** mode (for “Sync DB from Prod”) and **receiver** mode (for “Sync DB to Prod”).

1. On Prod, install or update the rsync-only script. Use the version in the repo that allows both:

   - Copy `scripts/rsync-only-prod.sh` to `/root/rsync-only.sh`
   - `chmod 700 /root/rsync-only.sh`

2. The script must allow:
   - `rsync --server --sender *` (Dev pulls from Prod)
   - `rsync --server *` (Dev pushes to Prod)

3. The script can also allow `systemctl stop <SERVICE>` and `systemctl start <SERVICE>` so the sync can stop the Prod app during transfer (see `scripts/rsync-only-prod.sh`; set SERVICE=furnitureapp or your service name).

4. In `/root/.ssh/authorized_keys`, the line for the Dev key should look like:
   ```text
   command="/root/rsync-only.sh",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty ssh-ed25519 AAAA... comment
   ```

If Prod’s script previously allowed only `--sender`, update it to also allow `--receiver` so “Sync DB to Prod” works.
