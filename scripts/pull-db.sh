#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  pull-db.sh — ดึง attendance.db จาก EC2 มาใช้ใน Local
#
#  วิธีใช้:
#    bash scripts/pull-db.sh
#
#  ต้องการ:
#    - SSH key ที่เข้า EC2 ได้ (ระบุใน EC2_KEY_PATH)
#    - EC2_HOST / EC2_USER ตั้งค่าด้านล่าง หรือส่งเป็น env var
#      เช่น: EC2_HOST=1.2.3.4 bash scripts/pull-db.sh
# ─────────────────────────────────────────────────────────────

set -e

# ── Config ────────────────────────────────────────────────────
EC2_HOST="${EC2_HOST:-}"
EC2_USER="${EC2_USER:-ubuntu}"
EC2_KEY_PATH="${EC2_KEY_PATH:-~/.ssh/id_rsa}"
REMOTE_DB="/home/ubuntu/lek_sticker/attendance.db"
LOCAL_DB="./attendance.db"
BACKUP_DIR="./db-backups"
# ─────────────────────────────────────────────────────────────

# ตรวจสอบว่าระบุ EC2_HOST แล้ว
if [ -z "$EC2_HOST" ]; then
  echo "❌  กรุณาระบุ EC2_HOST"
  echo "    ตัวอย่าง: EC2_HOST=1.2.3.4 bash scripts/pull-db.sh"
  exit 1
fi

echo "🔗  เชื่อมต่อ ${EC2_USER}@${EC2_HOST} ..."

# Backup ไฟล์ local เดิม (ถ้ามี)
if [ -f "$LOCAL_DB" ]; then
  mkdir -p "$BACKUP_DIR"
  TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
  BACKUP_PATH="${BACKUP_DIR}/attendance_${TIMESTAMP}.db"
  cp "$LOCAL_DB" "$BACKUP_PATH"
  echo "💾  Backup ไฟล์เดิมไว้ที่ ${BACKUP_PATH}"
fi

# ดึง DB จาก EC2
echo "⬇️   กำลังดึง attendance.db จาก EC2 ..."
scp -i "$EC2_KEY_PATH" -o StrictHostKeyChecking=no \
  "${EC2_USER}@${EC2_HOST}:${REMOTE_DB}" "$LOCAL_DB"

echo "✅  ดึง DB สำเร็จ → ${LOCAL_DB}"
echo "    ขนาดไฟล์: $(du -sh $LOCAL_DB | cut -f1)"
echo ""
echo "👉  รัน 'npm run dev' เพื่อใช้ข้อมูล Production บน Local ได้เลย"
