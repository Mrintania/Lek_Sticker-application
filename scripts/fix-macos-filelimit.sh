#!/bin/bash
# แก้ไข macOS file limit สำหรับ Next.js + Turbopack dev server
# รันด้วย: sudo bash scripts/fix-macos-filelimit.sh

echo "🔧 กำลังเพิ่ม macOS file limit..."

# เพิ่มทันที (จนกว่าจะ reboot)
sudo sysctl -w kern.maxfiles=524288
sudo sysctl -w kern.maxfilesperproc=524288
ulimit -n 65536

echo "✅ ค่าปัจจุบัน:"
sysctl kern.maxfiles kern.maxfilesperproc

# ทำให้ถาวร (ต้อง reboot)
PLIST="/Library/LaunchDaemons/limit.maxfiles.plist"
sudo tee $PLIST > /dev/null << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>limit.maxfiles</string>
    <key>ProgramArguments</key>
    <array>
      <string>launchctl</string>
      <string>limit</string>
      <string>maxfiles</string>
      <string>524288</string>
      <string>524288</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>ServiceIPC</key>
    <false/>
  </dict>
</plist>
EOF

sudo chmod 644 $PLIST
sudo chown root:wheel $PLIST
sudo launchctl load -w $PLIST 2>/dev/null || true

# เพิ่ม ulimit ใน shell profile เพื่อให้มีผลทุก terminal session
ULIMIT_LINE="ulimit -n 65536"
for PROFILE in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.bash_profile"; do
  if [ -f "$PROFILE" ] && ! grep -q "ulimit -n 65536" "$PROFILE"; then
    echo "" >> "$PROFILE"
    echo "# Next.js / Turbopack file descriptor limit" >> "$PROFILE"
    echo "$ULIMIT_LINE" >> "$PROFILE"
    echo "✅ เพิ่ม ulimit ใน $PROFILE แล้ว"
  fi
done

echo ""
echo "✅ ตั้งค่าถาวรแล้ว (มีผลหลัง reboot)"
echo "💡 รีสตาร์ท terminal แล้วรัน: npm run dev"
