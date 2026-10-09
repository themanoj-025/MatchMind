#!/bin/bash
# ─── MatchMind Data Backup Script ─────────────────────────
# Creates a timestamped tarball of the JSON data directory
# and optionally uploads to S3-compatible storage.
#
# Usage:
#   ./scripts/backup-data.sh                          # local backup only
#   ./scripts/backup-data.sh --s3-bucket my-bucket     # backup + S3 upload
#   ./scripts/backup-data.sh --s3-bucket my-bucket --s3-endpoint https://s3.amazonaws.com
#
# Environment variables (optional):
#   AWS_ACCESS_KEY_ID       — S3 access key
#   AWS_SECRET_ACCESS_KEY   — S3 secret key
#   BACKUP_RETENTION_DAYS   — local backup retention (default: 30)
#
# Restore:
#   tar -xzf backup-2026-07-06T10-30-00.tar.gz -C /path/to/data/
#
# Schedule (crontab):
#   0 3 * * * /app/scripts/backup-data.sh --s3-bucket matchmind-backups

set -euo pipefail

# ─── Config ───────────────────────────────────────────────

DATA_DIR="${DATA_DIR:-./src/data}"
BACKUP_DIR="${BACKUP_DIR:-./.backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
BACKUP_FILE="backup-${TIMESTAMP}.tar.gz"
S3_BUCKET=""
S3_ENDPOINT=""

# Parse CLI args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --s3-bucket) S3_BUCKET="$2"; shift 2 ;;
    --s3-endpoint) S3_ENDPOINT="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ─── Create Backup ────────────────────────────────────────

echo "[backup] Creating backup directory: ${BACKUP_DIR}"
mkdir -p "${BACKUP_DIR}"

echo "[backup] Archiving ${DATA_DIR} → ${BACKUP_DIR}/${BACKUP_FILE}"
tar -czf "${BACKUP_DIR}/${BACKUP_FILE}" \
  --exclude='*.tmp' \
  --exclude='.backups' \
  -C "$(dirname "${DATA_DIR}")" "$(basename "${DATA_DIR}")"

BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
echo "[backup] Created backup: ${BACKUP_DIR}/${BACKUP_FILE} (${BACKUP_SIZE})"

# ─── Upload to S3 ─────────────────────────────────────────

if [ -n "${S3_BUCKET}" ]; then
  if command -v aws &> /dev/null; then
    echo "[backup] Uploading to s3://${S3_BUCKET}/${BACKUP_FILE}"

    AWS_ARGS=("s3" "cp" "${BACKUP_DIR}/${BACKUP_FILE}" "s3://${S3_BUCKET}/${BACKUP_FILE}")
    if [ -n "${S3_ENDPOINT}" ]; then
      AWS_ARGS+=( "--endpoint-url" "${S3_ENDPOINT}" )
    fi

    aws "${AWS_ARGS[@]}"

    echo "[backup] Upload complete: s3://${S3_BUCKET}/${BACKUP_FILE}"

    # Clean up old backups from S3 (retain last 30 days)
    THIRTY_DAYS_AGO=$(date -u -d "-${RETENTION_DAYS} days" +"%Y-%m-%d")
    echo "[backup] Cleaning S3 backups older than ${RETENTION_DAYS} days (before ${THIRTY_DAYS_AGO})"
    aws s3 ls "s3://${S3_BUCKET}/" | while read -r line; do
      FILE_DATE=$(echo "$line" | awk '{print $1}')
      FILE_NAME=$(echo "$line" | awk '{print $4}')
      if [[ "$FILE_DATE" < "$THIRTY_DAYS_AGO" ]] && [[ "$FILE_NAME" == backup-* ]]; then
        echo "[backup] Removing old S3 backup: ${FILE_NAME}"
        aws s3 rm "s3://${S3_BUCKET}/${FILE_NAME}"
      fi
    done
  else
    echo "[backup] WARNING: AWS CLI not found. Skipping S3 upload."
    echo "[backup] Install with: apt-get install awscli  OR  pip install awscli"
  fi
fi

# ─── Rotate Local Backups ─────────────────────────────────

echo "[backup] Rotating local backups older than ${RETENTION_DAYS} days"
find "${BACKUP_DIR}" -name "backup-*.tar.gz" -type f -mtime "+${RETENTION_DAYS}" -delete

echo "[backup] Backup complete: ${BACKUP_FILE}"
