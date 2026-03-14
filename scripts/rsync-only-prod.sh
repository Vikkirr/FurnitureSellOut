#!/bin/sh
# Install on Prod as /root/rsync-only.sh. chmod 700.
# In root's authorized_keys use: command="/root/rsync-only.sh",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty <PUBLIC_KEY>
# Allows: rsync --server * ; systemctl stop/start * ; rm -f (only catalog.db* in data dir)
case "$SSH_ORIGINAL_COMMAND" in
  rsync\ --server\ *) exec $SSH_ORIGINAL_COMMAND ;;
  systemctl\ stop\ *) exec $SSH_ORIGINAL_COMMAND ;;
  systemctl\ start\ *) exec $SSH_ORIGINAL_COMMAND ;;
  rm\ -f\ /srv/furnitureapp/data/catalog.db\ /srv/furnitureapp/data/catalog.db-wal\ /srv/furnitureapp/data/catalog.db-shm) exec $SSH_ORIGINAL_COMMAND ;;
  *) echo "Access denied." 1>&2; exit 1 ;;
esac
