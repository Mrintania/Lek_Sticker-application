# 🖨️ ระบบบริหารจัดการ เล็กสติ๊กเกอร์

> ระบบบริหารจัดการพนักงาน บันทึกการเข้างาน เงินเดือน งานผลิต และงานส่ง สำหรับร้านเล็กสติ๊กเกอร์

สร้างโดย **AJ.NUI** &nbsp;|&nbsp; Version **1.2.0**

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
- **รายเดือน** — สรุปชั่วโมงการทำงาน OT
- **รายคน** — ประวัติการเข้างานแต่ละพนักงาน

### 💰 เงินเดือน
- คำนวณเงินเดือนอัตโนมัติจากชั่วโมงทำงาน
- รองรับ OT / ค่าเดินทาง / ค่าอาหาร / ค่าคอมมิชชั่น
- ส่งออกสลิปเงินเดือน

### 🏭 บันทึกงานผลิต & งานส่ง
- บันทึกจำนวนผลผลิตรายวัน รายเครื่อง
- Dashboard ผลผลิต / งานส่ง แบบ real-time
- กำหนด assignment พนักงาน-เครื่องจักร

### ⚙️ ตั้งค่าระบบ
- จัดการวันหยุดสาธารณะ (Admin + Manager)
- อัปโหลดไฟล์สแกนนิ้วมือ (Admin + Manager)
- ตั้งค่าเวลาเข้า-ออกงาน, OT, ค่าปรับ

---

## 🆕 ประวัติการอัปเดต

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
| จัดการผู้ใช้งาน | ✅ | ❌ | ❌ |
| ดู Audit Log | ✅ | ❌ | ❌ |
| หน้าของฉัน / ใบลา | ✅ | ✅ | ✅ |

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
│   │   └── holidays/
│   ├── dashboard/
│   ├── daily/ weekly/ monthly/ employee/
│   ├── production/
│   ├── delivery/
│   ├── payroll/
│   ├── settings/
│   └── admin/
├── components/
│   ├── layout/Sidebar.tsx
│   └── SessionTimeoutModal.tsx
├── hooks/
│   ├── useCurrentUser.ts
│   └── useIdleTimeout.ts
├── lib/
│   ├── auth.ts
│   ├── db.ts
│   └── formatters.ts
├── scripts/
│   └── fix-macos-filelimit.sh
└── .github/workflows/
    └── deploy.yml
```

---

## 📄 License

Private project — สงวนลิขสิทธิ์ © 2569 **AJ.NUI**
