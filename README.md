# 🖨️ ระบบบริหารจัดการ เล็กสติ๊กเกอร์

> ระบบบริหารจัดการพนักงาน บันทึกการเข้างาน เงินเดือน งานผลิต งานส่ง และการเงินบริษัท สำหรับร้านเล็กสติ๊กเกอร์

สร้างโดย **AJ.NUI** &nbsp;|&nbsp; Version **1.5.0**

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![SQLite](https://img.shields.io/badge/SQLite-3-green?logo=sqlite)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38bdf8?logo=tailwindcss)
![Node](https://img.shields.io/badge/Node.js-22-brightgreen?logo=node.js)

---

## ✨ ฟีเจอร์หลัก

### 👥 จัดการพนักงาน
- ข้อมูลพนักงานพร้อมรูปภาพ
- บันทึกการเข้า-ออกงานด้วยระบบสแกนนิ้ว
- จัดการวันหยุดประจำปี
- ระบบการลา (ลาป่วย / ลากิจ / ลาพักร้อน) พร้อมขั้นตอนอนุมัติ

### 📊 รายงาน
- **รายวัน** — สรุปการเข้างาน มาสาย ขาดงาน พร้อม date navigator และ calendar picker
- **รายสัปดาห์** — ภาพรวมทีมพร้อม stats cards
- **รายเดือน** — สรุปชั่วโมงการทำงาน OT พร้อม drill-down รายคน
- **รายคน** — ประวัติการเข้างานแต่ละพนักงาน รวมถึงวันขาดงาน

### 💰 เงินเดือน
- คำนวณเงินเดือนอัตโนมัติจากชั่วโมงทำงาน
- รองรับ OT / ค่าเดินทาง / ค่าอาหาร / ค่าคอมมิชชั่น / เบี้ยขยัน
- ส่งออกสลิปเงินเดือน

### 🏭 บันทึกงานผลิต & งานส่ง
- บันทึกจำนวนผลผลิตรายวัน รายเครื่อง
- Dashboard ผลผลิต / งานส่ง แบบ real-time
- กำหนด assignment พนักงาน-เครื่องจักร

### 💹 การเงินบริษัท *(ใหม่ v1.3.0)*
- **Dashboard การเงิน** — สรุปกำไร/ขาดทุน พร้อม Bar Chart 12 เดือน และ Pie Chart สัดส่วนรายจ่าย
- **รายรับ** — บันทึกยอดส่งพิมพ์และรายรับอื่นๆ
- **รายจ่าย** — แยกประเภทคงที่/ผันแปร พร้อมระบบนำเข้ารายจ่ายประจำอัตโนมัติ
- **บัญชี OD** — ติดตามยอด OD แยกรายธนาคาร พร้อมคำนวณดอกเบี้ยอัตโนมัติ
- **Template รายจ่ายประจำ** — กำหนดรายจ่ายประจำล่วงหน้าและนำเข้าทีเดียว

### 👤 User Profile Self-Service *(ใหม่ v1.5.0)*
- แก้ไขข้อมูลส่วนตัว (เบอร์โทร, ธนาคาร, เลขบัญชี) ได้เองผ่าน popup modal จาก Sidebar
- เปลี่ยนรหัสผ่านด้วยตนเองพร้อม eye icon toggle แสดง/ซ่อนรหัสผ่าน

### ⚙️ ตั้งค่าระบบ
- จัดการวันหยุดสาธารณะ (Admin + Manager)
- อัปโหลดไฟล์สแกนนิ้วมือ (Admin + Manager)
- ตั้งค่าเวลาเข้า-ออกงาน, OT, ค่าปรับ

---

## 🆕 ประวัติการอัปเดต

### v1.5.0 — เมษายน 2569

#### 🆕 ฟีเจอร์ใหม่
- **👤 User Profile Self-Service** — พนักงานแก้ไขข้อมูลส่วนตัว (เบอร์โทร / ข้อมูลธนาคาร) และเปลี่ยนรหัสผ่านได้เองผ่าน popup modal จาก Sidebar user card โดยไม่ต้องผ่าน Admin
- **🔍 Drill-down รายเดือน → รายคน** — กดชื่อพนักงานในตาราง "สรุปรายบุคคล" (หน้ารายงานรายเดือน และหน้าภาพรวมการเข้างาน) เพื่อดูรายละเอียดการเข้างานของพนักงานคนนั้นได้ทันที
- **📋 วันขาดงานในประวัติรายคน** — หน้า "ข้อมูลพนักงานรายคน" แสดงวันที่ขาดงานในตาราง "ประวัติการเข้างาน" ครบทุกวัน ไม่ใช่แค่วันที่มีการสแกน
- **🟡 สถานะ "ไม่ได้แสกนเข้างาน"** — ระบบตรวจจับอัตโนมัติเมื่อพนักงานสแกนเฉพาะช่วงเลิกงาน (ครึ่งหลังของวันทำงาน) โดยไม่มีการสแกนเข้า จะได้รับสถานะใหม่ "ไม่ได้แสกนเข้างาน" แทนการนับเป็น "ขาดงาน"
- **📊 คอลัมน์ "ลา" ในภาพรวมการเข้างาน** — ตาราง "สรุปรายบุคคล" แสดงจำนวนวันลาแยกจากขาดงาน พร้อมกดดูรายละเอียดรายคนได้เลย

#### 🔧 ปรับปรุง UX
- **⌨️ กด ESC ปิด Modal ได้ทุกอัน** — ทุก Modal ในระบบปิดได้ด้วยปุ่ม ESC keyboard shortcut
- **🗑️ ลบส่วน "เบี้ยขยัน" ออกจากหน้าตั้งค่า** — ย้ายไปตั้งค่าในหน้า "เงินเดือน" แทน ลด clutter ในหน้า Settings
- **💻 Password input UX บน Desktop** — ช่องรหัสผ่านและปุ่ม eye toggle อยู่ใน border เดียวกัน ดูเรียบร้อยกว่าเดิม

---

### v1.4.1 — เมษายน 2569
- **🔒 Security hardening** — JWT guard ใน production, validate input length login, HSTS + Permissions-Policy headers, finance API validation
- **⏱️ Session timeout animation** — ตัวเลขนับถอยหลัง slide-in ทีละหลักเมื่อเปลี่ยนค่า
- **📊 Me page KPI fix** — เดือนปัจจุบันคำนวณจาก attendance จริง (cutoff วันนี้) แทน payroll record ที่อาจล้าสมัย
- **📈 Production dashboard labels** — แสดงยอดจริงบน bar chart ทุกกราฟ

### v1.4.0 — เมษายน 2569
- **🔒 อัปเกรด Next.js 15.5.15** — แก้ช่องโหว่ Denial of Service ใน Server Components (GHSA-q4gf-8mx6-v5v3)
- **📦 แทนที่ xlsx ด้วย exceljs** — ลบ library ที่มีช่องโหว่ Prototype Pollution + ReDoS ออก ใช้ exceljs แทนซึ่งมีอยู่แล้ว
- **⏱️ แก้ timezone ของไฟล์สแกน** — ExcelJS อ่าน datetime เป็น UTC ทำให้เวลาเร็วกว่าจริง 7 ชั่วโมง แก้โดย reinterpret UTC components เป็น local time ก่อนบันทึก
- **🗑️ ลบสแกนตามช่วงวันที่** — เพิ่มฟีเจอร์ลบข้อมูลสแกนเฉพาะช่วงวันที่ที่เลือก (ไม่ต้องลบทั้งหมด) ใน Settings
- **🏭 ระบบวันทำงานพิเศษ** — Admin/Manager กำหนดวันอาทิตย์หรือวันหยุดให้เป็นวันทำงานได้ ผูกกับระบบเงินเดือนอัตโนมัติ หน้า Daily แสดง badge "🏭 วันทำงานพิเศษ"
- **📅 Filter เดือนหน้ารายคน** — เพิ่ม dropdown เลือกเดือนในหน้าข้อมูลพนักงานรายคน auto-fill ช่วงวันที่ให้อัตโนมัติ
- **📊 แก้จำนวนขาดงานในเดือนปัจจุบัน** — Dashboard / รายเดือน / รายคน ตัดการนับวันขาดงานที่วันนี้ ไม่นับวันในอนาคตเป็นขาดงาน
- **⚙️ เมนูตั้งค่าอยู่ล่างสุด Sidebar** — แยก "ตั้งค่า" ไว้ล่างสุดพร้อม divider เพื่อให้หาง่าย
- **🔑 แก้ Login 500 Error** — rebuild better-sqlite3 ให้ตรงกับ Node.js 22 (ABI 127) หลังจาก npm install ใน Node 16 environment

### v1.3.0 — เมษายน 2569
- **💹 ระบบการเงินบริษัท** — Dashboard รายรับ/รายจ่าย กำไร/ขาดทุน พร้อม Bar Chart และ Pie Chart
- **📥 บันทึกรายรับ** — รองรับยอดส่งพิมพ์และรายรับอื่นๆ แยกประเภท
- **📤 บันทึกรายจ่าย** — แยกประเภทคงที่/ผันแปร กรองและดู summary รายเดือน
- **🔁 Template รายจ่ายประจำ** — กำหนด template ล่วงหน้า กด apply ครั้งเดียวนำเข้าได้ทั้งหมด (idempotent)
- **🏦 บัญชี OD** — บันทึกยอด OD แยกธนาคาร คำนวณดอกเบี้ยอัตโนมัติ (ยอด × rate / 12 / 100) พร้อมประวัติรายเดือน
- **🔒 Route protection** — `/finance` และ `/api/finance` ต้องการ Manager/Admin เท่านั้น
- **🛠️ dev:clean fix** — แก้ ENOENT `_buildManifest.js.tmp` โดย pre-create `.next/static/development` ก่อน Turbopack start
- **🚀 GitHub Actions** — เพิ่ม `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` รองรับ Node.js 24 runtime

### v1.2.0 — เมษายน 2569
- **🔐 Session Timeout** — Auto logout หลัง idle 30 นาที พร้อม warning modal countdown 5 นาที
- **🔄 Sliding Session** — Refresh token อัตโนมัติทุก 10 นาทีถ้ายังใช้งาน (JWT อายุ 8 ชั่วโมง)
- **📅 UX หน้ารายวัน** — เพิ่ม date navigator ← → และ calendar picker เหมือนหน้าบันทึกงานผลิต
- **🗓️ UX หน้ารายสัปดาห์ / รายเดือน** — เปลี่ยน dropdown เป็น navigator + ปุ่ม "ล่าสุด" พร้อม team stats cards
- **🏭 หน้าบันทึกงานผลิต** — เพิ่มปุ่ม "ล้างค่า" ต่อ slot และลบ field ชื่อรุ่นออก
- **👔 Manager permissions** — Manager จัดการวันหยุดและอัปโหลดไฟล์สแกนนิ้วได้
- **🔑 Confirm Password** — หน้าจัดการผู้ใช้มีช่องยืนยันรหัสผ่านพร้อม indicator สีแดง/เขียว real-time
- **⚡ Dev Turbopack** — เปลี่ยนเป็น Turbopack แทน webpack แก้ ENOENT race condition บน macOS
- **📝 Footer** — เพิ่มแถบ Copyright และ Version ด้านล่าง Sidebar

### v1.1.0
- ระบบบันทึกงานส่ง (Delivery) พร้อม Dashboard
- Dashboard ผลผลิต
- ระบบการลาพร้อมขั้นตอนอนุมัติ
- GitHub Actions CI/CD → EC2
- บันทึก Audit Log การใช้งาน

### v1.0.0
- ระบบหลัก: พนักงาน, การเข้างาน, เงินเดือน, งานผลิต
- Role-based access: Admin / Manager / User

---

## 🛠️ Tech Stack

| | |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Database | SQLite (better-sqlite3) |
| Styling | Tailwind CSS |
| Auth | JWT (httpOnly cookie, 8h expiry) |
| Bundler | Turbopack (dev) / Webpack (production build) |
| Runtime | Node.js 22 |
| Server | AWS EC2 Ubuntu + PM2 |
| CI/CD | GitHub Actions |

---

## 🚀 การติดตั้งและรัน

### Prerequisites
- Node.js 22+
- npm

### Local Development

```bash
# Clone repository
git clone https://github.com/Mrintania/Lek_Sticker-application.git
cd Lek_Sticker-application

# ติดตั้ง dependencies
npm install

# รัน dev server (Turbopack)
npm run dev

# หรือ รัน พร้อมล้าง cache
npm run dev:clean
```

เปิดที่ [http://localhost:3000](http://localhost:3000)

### Build & Production

```bash
npm run build
npm run start
```

### แก้ไข macOS file limit (กรณีเกิด ENOENT)

```bash
sudo bash scripts/fix-macos-filelimit.sh
```

---

## 🔐 Role & Permissions

| ฟีเจอร์ | Admin | Manager | User |
|---|:---:|:---:|:---:|
| Dashboard / รายงาน | ✅ | ✅ | ❌ |
| จัดการพนักงาน | ✅ | ✅ | ❌ |
| อนุมัติการลา | ✅ | ✅ | ❌ |
| บันทึกงานผลิต / ส่ง | ✅ | ✅ | ❌ |
| จัดการวันหยุด | ✅ | ✅ | ❌ |
| อัปโหลดสแกนนิ้ว | ✅ | ✅ | ❌ |
| **ระบบการเงินบริษัท** | ✅ | ✅ | ❌ |
| จัดการผู้ใช้งาน | ✅ | ❌ | ❌ |
| ดู Audit Log | ✅ | ❌ | ❌ |
| หน้าของฉัน / ใบลา | ✅ | ✅ | ✅ |
| **แก้ไขโปรไฟล์ตนเอง** | ✅ | ✅ | ✅ |

---

## 📁 โครงสร้างโปรเจค

```
lek_sticker/
├── app/                          # Next.js App Router
│   ├── api/
│   │   ├── auth/                 # login / logout / refresh / me
│   │   ├── employees/
│   │   ├── scans/
│   │   ├── production/
│   │   ├── delivery/
│   │   ├── payroll/
│   │   ├── leaves/
│   │   ├── holidays/
│   │   ├── me/                   # profile / password (self-service)
│   │   └── finance/              # summary / income / expenses / od / recurring
│   ├── dashboard/
│   ├── daily/ weekly/ monthly/ employee/
│   ├── production/
│   ├── delivery/
│   ├── payroll/
│   ├── finance/                  # dashboard / income / expenses / od / recurring
│   ├── settings/
│   └── admin/
├── components/
│   ├── layout/Sidebar.tsx
│   ├── ProfileModal.tsx          # User profile self-service popup
│   └── SessionTimeoutModal.tsx
├── hooks/
│   ├── useCurrentUser.ts
│   ├── useEscapeKey.ts           # ESC key handler for modals
│   └── useIdleTimeout.ts
├── lib/
│   ├── auth.ts
│   ├── db.ts
│   ├── processor.ts              # Attendance logic (incl. noCheckIn detection)
│   ├── reports.ts
│   └── formatters.ts
├── scripts/
│   └── fix-macos-filelimit.sh
└── .github/workflows/
    └── deploy.yml
```

---

## 📄 License

Private project — สงวนลิขสิทธิ์ © 2569 **AJ.NUI**
