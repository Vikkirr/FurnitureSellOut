#!/bin/bash
# Install on Dev (e.g. /home/vik/rsync-only.sh). chmod 700.
# In authorized_keys use: command="/home/vik/rsync-only.sh",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty <PUBLIC_KEY>
case "$SSH_ORIGINAL_COMMAND" in
  rsync\ --server\ --sender\ *) exec $SSH_ORIGINAL_COMMAND ;;
  *) echo "Access denied."; exit 1 ;;
esac
