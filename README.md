# เล็กสติ๊กเกอร์ — ระบบบริหารจัดการพนักงาน

> ระบบจัดการการเข้างาน ใบลา เงินเดือน และบันทึกงานผลิต สำหรับบริษัทเล็กสติ๊กเกอร์

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![SQLite](https://img.shields.io/badge/SQLite-3-green?logo=sqlite)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38bdf8?logo=tailwindcss)

---

## ภาพรวมระบบ

| โมดูล | คำอธิบาย |
|-------|-----------|
| 📊 **Dashboard** | ภาพรวมสถิติการเข้างานทั้งองค์กร |
| 📅 **รายงานรายวัน** | ดูสถานะการมาของพนักงานรายวัน แก้ไขสถานะได้ |
| 🗓️ **รายงานรายสัปดาห์** | ตาราง Grid แสดงการมา/ขาด ทั้งสัปดาห์ |
| 📆 **รายงานรายเดือน** | สรุปสถิติการมาทำงาน ชั่วโมง และอัตราการมา |
| 👤 **รายงานรายคน** | ดูประวัติการมาของพนักงานแต่ละคนอย่างละเอียด |
| 🏖️ **ระบบการลา** | ขอลา อนุมัติ/ปฏิเสธใบลา พร้อม Badge แจ้งเตือน |
| 💰 **เงินเดือน** | คำนวณเงินเดือนรายเดือน รองรับพนักงานรายวัน/รายเดือน |
| 🖨️ **บันทึกงานผลิต** | บันทึกผลผลิตต่อเครื่องพิมพ์ต่อวัน พร้อม Dashboard |
| 🏠 **หน้าของฉัน** | พนักงาน User ดูข้อมูลตัวเองได้ทันที |
| 👥 **จัดการพนักงาน** | เพิ่ม แก้ไข ปิดใช้งานพนักงาน |
| 🔑 **จัดการผู้ใช้** | สร้างและบริหารบัญชีผู้ใช้ระบบ |
| ⚙️ **ตั้งค่า** | เวลาทำงาน วันหยุดนักขัตฤกษ์ เบี้ยขยัน |
| 🔍 **Audit Log** | บันทึกทุกการกระทำในระบบ (เฉพาะ Admin) |

---

## เทคโนโลยีที่ใช้

| เทคโนโลยี | บทบาท |
|-----------|-------|
| [Next.js 14](https://nextjs.org/) (App Router) | Full-stack Framework |
| [TypeScript 5](https://www.typescriptlang.org/) | Type Safety |
| [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) | ฐานข้อมูล SQLite (synchronous, WAL mode) |
| [Tailwind CSS 3](https://tailwindcss.com/) | Styling |
| [Recharts](https://recharts.org/) | กราฟและ Dashboard |
| [ExcelJS](https://github.com/exceljs/exceljs) | อ่านไฟล์ Excel จากเครื่องสแกน |
| [bcryptjs](https://github.com/dcodeIO/bcrypt.js) | เข้ารหัส Password |
| [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) | JWT Authentication |

---

## การติดตั้ง

### ความต้องการของระบบ
- Node.js >= 18.17.0
- npm >= 9.x

### ขั้นตอน

```bash
# 1. Clone โปรเจกต์
git clone https://github.com/Mrintania/Lek_Sticker-application.git
cd Lek_Sticker-application

# 2. ติดตั้ง dependencies
npm install

# 3. รัน dev server
npm run dev
```

เปิดเบราว์เซอร์ไปที่ [http://localhost:3000](http://localhost:3000)

### Environment Variables (ไม่บังคับ)

สร้างไฟล์ `.env.local`:

```env
JWT_SECRET=your-super-secret-key-change-this-in-production
```

> ถ้าไม่กำหนด ระบบจะใช้ค่า default ฐานข้อมูล `attendance.db` สร้างอัตโนมัติเมื่อ start ครั้งแรก

---

## บัญชีเริ่มต้น

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Admin |
| `manager` | `manager123` | Manager |

> ⚠️ กรุณาเปลี่ยน Password ทันทีหลังเข้าสู่ระบบครั้งแรก

---

## Role-Based Access

| Feature | Admin | Manager | User (พนักงาน) |
|---------|:-----:|:-------:|:--------------:|
| Dashboard ภาพรวม | ✓ | ✓ | — |
| รายงาน (รายวัน/สัปดาห์/เดือน/รายคน) | ✓ | ✓ | — |
| ระบบการลา | ✓ | ✓ | ✓ (ขอลาตัวเอง) |
| เงินเดือน | ✓ | ✓ | — |
| บันทึกงานผลิต + Dashboard | ✓ | ✓ | — |
| จัดการพนักงาน | ✓ | ✓ | — |
| จัดการผู้ใช้ | ✓ | — | — |
| Audit Log + ตั้งค่า | ✓ | — | — |
| หน้าของฉัน (/me) | — | — | ✓ |
| ประวัติเงินเดือน (/me/payroll) | — | — | ✓ |

### หน้าของฉัน (User Dashboard)

เมื่อพนักงาน login จะ redirect ไป `/me` ซึ่งแสดง:
- KPI ประจำเดือน: มาทำงาน / ขาด-ลา / เวลาสาย / เบี้ยขยัน
- การเข้างานรายวันทั้งเดือน พร้อมเวลาเข้า-ออก
- สรุปการลา + ยื่นใบลาในหน้าเดียว
- ประวัติเงินเดือนย้อนหลัง (เมนู sidebar)

---

## สูตรการคำนวณเงินเดือน

**พนักงานรายวัน:**
```
รายได้ = อัตรารายวัน × วันทำงานจริง (ครึ่งวัน = 0.5)
```

**พนักงานรายเดือน:**
```
รายได้ = เงินเดือน + เบี้ยขยัน (ถ้าขาดไม่เกินเกณฑ์)

กรณีขาดเกินเกณฑ์ → คิดเป็นรายวัน:
  อัตรารายวัน = เงินเดือน ÷ วันทำงานทั้งหมดในเดือน
  รายได้ = อัตรารายวัน × วันทำงานจริง
```

---

## โครงสร้างโปรเจกต์

```
app/
├── api/                    # API Routes (REST)
│   ├── auth/               # Login / Logout / Me
│   ├── attendance/         # ข้อมูลการมางาน + Override
│   ├── employees/          # จัดการพนักงาน
│   ├── leaves/             # ระบบการลา
│   ├── payroll/            # คำนวณเงินเดือน + settings
│   ├── production/         # ผลผลิต (machines, records, assignments, summary)
│   ├── holidays/           # วันหยุด
│   ├── settings/           # ตั้งค่าระบบ
│   ├── users/              # จัดการผู้ใช้
│   └── admin/              # Audit logs, reset scans
├── me/                     # Personal dashboard (user role)
│   └── payroll/            # ประวัติเงินเดือน (user role)
├── production/             # บันทึกงานผลิต
│   └── dashboard/          # Dashboard ผลผลิต
├── dashboard/              # Overview (admin/manager)
├── daily|weekly|monthly|employee/  # รายงาน
├── leaves/                 # ระบบการลา
├── payroll/                # ระบบเงินเดือน
├── employees/              # จัดการพนักงาน
├── settings/               # ตั้งค่า
├── admin/users|audit/      # Admin pages
└── login/                  # Login

components/layout/Sidebar.tsx   # Role-aware navigation
lib/
├── db.ts                   # SQLite schema + migrations
├── auth.ts                 # JWT utilities
├── formatters.ts           # Thai date/currency formatters
└── types.ts                # TypeScript types
middleware.ts               # Auth guard + role-based redirect
```

---

## npm Scripts

```bash
npm run dev          # Start dev server
npm run dev:clean    # Clear .next cache แล้ว start (ใช้เมื่อ cache เสีย)
npm run build        # Build for production
npm start            # Run production server
npx tsc --noEmit     # Type check (ไม่รบกวน dev server)
```

> **หมายเหตุ:** อย่ารัน `npm run build` ขณะ dev server กำลังทำงาน

---

## Troubleshooting

| ปัญหา | วิธีแก้ |
|-------|---------|
| Static assets 404 (`/_next/static/...`) | `npm run dev:clean` |
| `Cannot find module 'better-sqlite3'` | `npm install` |
| `Database is locked` | หยุด process ทั้งหมด แล้ว start ใหม่ |
| ข้อมูลไม่แสดงหลัง login | Logout แล้ว Login ใหม่ (refresh cookie) |

---

## Changelog

### v1.1.0 — Production Tracking + Personal Dashboard
- **ระบบบันทึกงานผลิต** — บันทึกผลผลิตต่อเครื่องพิมพ์ต่อวัน
- **Dashboard ผลผลิต** — กราฟ BarChart พร้อม filter วัน/สัปดาห์/เดือน
- **หน้าของฉัน (/me)** — User role ดูข้อมูลตัวเองได้ทันทีหลัง login
- **ประวัติเงินเดือน (/me/payroll)** — ดูเงินเดือนย้อนหลัง + popup รายละเอียด
- **Login redirect ตาม role** — user → /me, admin/manager → /dashboard
- **Logout confirmation modal**
- **แก้ active state ปุ่มวันนี้/สัปดาห์นี้** ใน production dashboard
- **แก้ช่องกรอกเบี้ยขยันล้น** (type=text inputMode=decimal)
- **Webpack memory cache** — ป้องกัน filesystem cache corruption

### v1.0.0 — Initial Release
- ระบบรายงานการเข้างาน (รายวัน/สัปดาห์/เดือน/รายคน)
- ระบบการลา พร้อมอนุมัติ/ปฏิเสธ
- ระบบเงินเดือน รองรับรายวัน/รายเดือน + เบี้ยขยันขั้นบันได
- วันหยุดนักขัตฤกษ์ไทย 2025–2026 + วันหยุดบริษัท
- Audit Log ทุก Action
- Role-Based Access Control (Admin / Manager / User)
- Sidebar Badge แจ้งเตือนใบลารออนุมัติ

---

<div align="center">
  <sub>พัฒนาด้วย Next.js 14 + TypeScript + SQLite | Copyright © 2025 เล็กสติ๊กเกอร์</sub>
</div>
