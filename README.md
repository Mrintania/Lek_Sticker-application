# เล็กสติ๊กเกอร์ — ระบบบริหารจัดการพนักงาน

> ระบบจัดการการเข้างาน ใบลา เงินเดือน และบันทึกงานผลิต สำหรับบริษัทเล็กสติ๊กเกอร์

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![SQLite](https://img.shields.io/badge/SQLite-3-green?logo=sqlite)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38bdf8?logo=tailwindcss)

---

## ภาพรวมระบบ

| โมดูล | คำอธิบาย |
|-------|-----------|
| 📊 **Dashboard** | ภาพรวมสถิติการเข้างานทั้งองค์กร |
| 📅 **รายงานรายวัน** | สถานะมา/ขาดรายวัน พร้อมแสดงพนักงานที่ขาดงาน |
| 🗓️ **รายงานรายสัปดาห์** | ตาราง Grid แสดงการมา/ขาดทั้งสัปดาห์ |
| 📆 **รายงานรายเดือน** | สรุปสถิติการมาทำงาน ชั่วโมง และอัตราการมา |
| 👤 **รายงานรายคน** | ดูประวัติการมาของพนักงานแต่ละคนอย่างละเอียด |
| 🏖️ **ระบบการลา** | ขอลา อนุมัติ/ปฏิเสธใบลา พร้อม Badge แจ้งเตือน |
| 💰 **เงินเดือน** | คำนวณเงินเดือน 2 รอบ/เดือน รองรับรายวัน/รายเดือน พร้อมปรับเพิ่ม-หัก |
| 🖨️ **บันทึกงานผลิต** | บันทึกผลผลิตต่อเครื่องพิมพ์ต่อวัน พร้อม Dashboard |
| 🏠 **หน้าของฉัน** | พนักงาน User ดูข้อมูลตัวเองได้ทันที |
| 👥 **จัดการพนักงาน** | เพิ่ม แก้ไข ปิดใช้งานพนักงาน |
| 🔑 **จัดการผู้ใช้** | สร้างและบริหารบัญชีผู้ใช้ระบบ |
| ⚙️ **ตั้งค่า** | เวลาทำงาน วันหยุดนักขัตฤกษ์ เบี้ยขยัน นำเข้าข้อมูลสแกน |
| 🔍 **Audit Log** | บันทึกทุกการกระทำในระบบ (เฉพาะ Admin) |

---

## เทคโนโลยีที่ใช้

| เทคโนโลยี | บทบาท |
|-----------|-------|
| [Next.js 15](https://nextjs.org/) (App Router) | Full-stack Framework |
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

> ถ้าไม่กำหนด ระบบจะใช้ค่า default — ฐานข้อมูล `attendance.db` สร้างอัตโนมัติเมื่อ start ครั้งแรก

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
| เงินเดือน + ปรับเงินพิเศษ/หัก | ✓ | ✓ | — |
| บันทึกงานผลิต + Dashboard | ✓ | ✓ | — |
| จัดการพนักงาน | ✓ | ✓ | — |
| ตั้งค่า (วันหยุด + เบี้ยขยัน + นำเข้าสแกน) | ✓ | ✓ | — |
| จัดการผู้ใช้ | ✓ | — | — |
| Audit Log | ✓ | — | — |
| หน้าของฉัน (/me) | — | — | ✓ |
| ประวัติเงินเดือน (/me/payroll) | — | — | ✓ |

### หน้าของฉัน (User Dashboard)

เมื่อพนักงาน login จะ redirect ไป `/me` ซึ่งแสดง:
- KPI ประจำเดือน: มาทำงาน / ขาด-ลา / เวลาสาย / เบี้ยขยัน
- การเข้างานรายวันทั้งเดือน พร้อมเวลาเข้า-ออก
- สรุปการลา
- ประวัติเงินเดือนย้อนหลัง (เมนู sidebar) — แสดงเฉพาะเดือนที่ผ่านมาแล้ว

---

## สูตรการคำนวณเงินเดือน

ระบบแบ่งการจ่ายเงิน **2 รอบ/เดือน**:

| รอบ | ช่วงวันทำงาน | วันจ่าย |
|-----|-------------|---------|
| รอบที่ 1 | วันที่ 1–15 | วันที่ 15 |
| รอบที่ 2 | วันที่ 16–สิ้นเดือน | วันสุดท้ายของเดือน |

**พนักงานรายวัน:**
```
รายได้/รอบ = อัตรารายวัน × วันทำงานจริงในรอบ (ครึ่งวัน = 0.5)
```

**พนักงานรายเดือน:**
```
รายได้/รอบ = (เงินเดือน ÷ 2) + เบี้ยขยัน

กรณีขาดเกินเกณฑ์ต่อรอบ → คิดเป็นรายวัน:
  อัตรารายวัน = เงินเดือน ÷ วันทำงานทั้งหมดในเดือน
  รายได้ = อัตรารายวัน × วันทำงานจริงในรอบ
```

**เบี้ยขยัน (ตั้งค่าได้):**
```
เบี้ยขยันเริ่มต้น = 1,000 บาท/รอบ
หักทุก 0.5 วันที่ขาด = 150 บาท
ขาดเกิน 3 วัน/รอบ → เบี้ยขยัน = 0
```

**เงินเพิ่มพิเศษ / หัก (ปรับด้วยตนเอง):**
```
เงินสุทธิ = เงินเดือนพื้นฐาน + เบี้ยขยัน + เงินเพิ่มพิเศษ − หัก
```
> Manager สามารถเพิ่มเงิน (เช่น ค่าทำความสะอาด) หรือหักเงิน (เช่น เบิกล่วงหน้า) พร้อมหมายเหตุได้ต่อแต่ละรอบ

---

## โครงสร้างโปรเจกต์

```
app/
├── api/                    # API Routes (REST)
│   ├── auth/               # Login / Logout / Me
│   ├── attendance/         # ข้อมูลการมางาน + Override
│   ├── employees/          # จัดการพนักงาน
│   ├── leaves/             # ระบบการลา
│   ├── payroll/            # คำนวณเงินเดือน + settings + [id] adjustment
│   ├── production/         # ผลผลิต (machines, records, assignments, summary)
│   ├── holidays/           # วันหยุด
│   ├── settings/           # ตั้งค่าระบบ
│   ├── scans/              # นำเข้าข้อมูลสแกน + preview
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

components/
├── layout/Sidebar.tsx      # Role-aware navigation
└── upload/FileUpload.tsx   # 2-step scan import (preview → confirm)

lib/
├── db.ts                   # SQLite schema + migrations
├── audit.ts                # Audit log types + helpers
├── auth.ts                 # JWT utilities
├── formatters.ts           # Thai date/currency formatters
├── parser.ts               # Excel parser สำหรับไฟล์สแกน
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

### v1.3.0 — Payroll Adjustments & Settings Improvements

- **เงินเพิ่มพิเศษ / หัก** — Manager กรอกเงินเพิ่ม/หักต่อแต่ละ record พร้อมหมายเหตุ (ค่าทำความสะอาด, เบิกล่วงหน้า ฯลฯ)
- **ตั้งค่าเบี้ยขยัน** — ย้ายมาอยู่ใน Settings page ให้ Manager แก้ไขได้ (เงินฐาน, หักต่อ 0.5 วัน, วันขาดสูงสุด)
- **Settings เปิดให้ Manager** — Manager เข้าถึงหน้า Settings (วันหยุด, เบี้ยขยัน, นำเข้าสแกน) ได้แล้ว
- **Esc key ปิด Dialog** — ทุก modal/dialog ปิดด้วยปุ่ม Esc ได้
- **me/payroll ไม่แสดงเดือนอนาคต** — กรองเดือนที่ยังไม่ถึงออกจากประวัติเงินเดือน

### v1.2.0 — Bi-Monthly Payroll & UX Redesign

- **เงินเดือน 2 รอบ/เดือน** — รอบ 1 (1–15) และรอบ 2 (16–สิ้นเดือน) พร้อมตัวเลือกรอบใน UI
- **นำเข้าข้อมูลสแกน 2 ขั้นตอน** — Preview สถิติและรายชื่อก่อน แล้วกดยืนยันอีกครั้ง
- **รายงานรายวัน** — แสดงพนักงานที่ขาดงานพร้อม override ได้
- **Redesign หน้าบันทึกงานผลิต** — Card ต่อเครื่องพิมพ์ รองรับ mobile
- **ประวัติเงินเดือน (me/payroll)** — Accordion + Progress bar + Period badges
- **ปุ่มออกจากระบบ** — ย้ายเข้า User badge ใน Sidebar เป็น icon

### v1.1.0 — Production Tracking & Personal Dashboard

- **ระบบบันทึกงานผลิต** — บันทึกผลผลิตต่อเครื่องพิมพ์ต่อวัน
- **Dashboard ผลผลิต** — กราฟ BarChart พร้อม filter วัน/สัปดาห์/เดือน
- **หน้าของฉัน (/me)** — User role ดูข้อมูลตัวเองได้ทันทีหลัง login
- **ประวัติเงินเดือน (/me/payroll)** — ดูเงินเดือนย้อนหลัง + popup รายละเอียด
- **Login redirect ตาม role** — user → /me, admin/manager → /dashboard

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
  <sub>พัฒนาด้วย Next.js 15 + TypeScript + SQLite | Copyright © 2025 เล็กสติ๊กเกอร์</sub>
</div>
