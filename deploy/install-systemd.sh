#!/bin/bash
# Run this script on the VM from the project root to install and enable the systemd service.
# Usage: ./deploy/install-systemd.sh
# Or:    bash deploy/install-systemd.sh

set -e
SERVICE_NAME="furniture-catalog"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKING_DIR="$PROJECT_DIR"
USER_NAME="${SUDO_USER:-$USER}"

if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run with sudo so it can install the service."
  echo "Run: sudo ./deploy/install-systemd.sh"
  exit 1
fi

# Generate service file with actual paths
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
sed -e "s|REPLACE_USER|$USER_NAME|g" -e "s|REPLACE_WORKING_DIR|$WORKING_DIR|g" \
  "$PROJECT_DIR/deploy/furniture-catalog.service" > "$SERVICE_FILE"

echo "Installed $SERVICE_FILE (User=$USER_NAME, WorkingDirectory=$WORKING_DIR)"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl start "$SERVICE_NAME"
echo "Service enabled and started. Check status with: sudo systemctl status $SERVICE_NAME"
