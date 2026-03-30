# เล็กสติ๊กเกอร์ — ระบบบริหารการเข้างาน

> ระบบจัดการการเข้างาน ใบลา และเงินเดือนพนักงาน สำหรับบริษัท เล็กสติ๊กเกอร์

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![SQLite](https://img.shields.io/badge/SQLite-3-green?logo=sqlite)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38bdf8?logo=tailwindcss)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## ภาพรวมระบบ

ระบบนี้รองรับการทำงานครบวงจรสำหรับการบริหารบุคคล ประกอบด้วย:

| โมดูล | คำอธิบาย |
|-------|-----------|
| 📊 **Dashboard** | ภาพรวมสถิติการเข้างานทั้งองค์กร |
| 📅 **รายงานรายวัน** | ดูสถานะการมาของพนักงานรายวัน แก้ไขสถานะได้ |
| 🗓️ **รายงานรายสัปดาห์** | ตาราง Grid แสดงการมา/ขาด ทั้งสัปดาห์ |
| 📆 **รายงานรายเดือน** | สรุปสถิติการมาทำงาน ชั่วโมง และอัตราการมา |
| 👤 **รายงานรายคน** | ดูประวัติการมาของพนักงานแต่ละคนอย่างละเอียด |
| 🏖️ **ระบบการลา** | ขอลา อนุมัติ/ปฏิเสธใบลา พร้อม Badge แจ้งเตือน |
| 💰 **เงินเดือน** | คำนวณเงินเดือนรายเดือน รองรับพนักงานรายวัน/รายเดือน |
| 👥 **จัดการพนักงาน** | เพิ่ม แก้ไข ปิดใช้งานพนักงาน |
| 🔑 **จัดการผู้ใช้** | สร้างและบริหารบัญชีผู้ใช้ระบบ |
| ⚙️ **ตั้งค่า** | เวลาทำงาน วันหยุดนักขัตฤกษ์ เบี้ยขยัน |
| 🔍 **Audit Log** | บันทึกทุกการกระทำในระบบ (เฉพาะ Admin) |

---

## คุณสมบัติเด่น

- **นำเข้าข้อมูลจากเครื่องสแกนนิ้วมือ** — รองรับไฟล์ `.xlsx` จาก Fingertec/ZKTeco
- **ระบบ Role-Based Access Control** — Admin / Manager / User มีสิทธิ์ต่างกัน
- **คำนวณเงินเดือนอัตโนมัติ** — รายวัน/รายเดือน พร้อมเบี้ยขยันแบบขั้นบันได
- **ระบบวันหยุดนักขัตฤกษ์ไทย** — pre-seed ปี 2025–2026 + เพิ่มวันหยุดบริษัทเองได้
- **ระบบการลา** — ขอลา/อนุมัติ/ปฏิเสธ/แก้ไข พร้อมซิงก์กับเงินเดือนอัตโนมัติ
- **Audit Log ครบถ้วน** — บันทึกทุก Action พร้อม IP Address

---

## เทคโนโลยีที่ใช้

| เทคโนโลยี | เวอร์ชัน | บทบาท |
|-----------|---------|-------|
| [Next.js](https://nextjs.org/) | 14 | Full-stack Framework (App Router) |
| [TypeScript](https://www.typescriptlang.org/) | 5 | Type Safety |
| [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) | 11 | ฐานข้อมูล SQLite (synchronous) |
| [Tailwind CSS](https://tailwindcss.com/) | 3 | Styling |
| [Zustand](https://github.com/pmndrs/zustand) | 5 | State Management |
| [Recharts](https://recharts.org/) | 3 | กราฟและ Chart |
| [ExcelJS](https://github.com/exceljs/exceljs) | 4 | อ่านไฟล์ Excel |
| [bcryptjs](https://github.com/dcodeIO/bcrypt.js) | 3 | เข้ารหัส Password |
| [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) | 9 | JWT Authentication |

---

## ความต้องการของระบบ

| รายการ | ข้อกำหนด |
|--------|---------|
| Node.js | >= 18.17.0 |
| npm | >= 9.x |
| ระบบปฏิบัติการ | macOS, Linux, Windows |
| หน่วยความจำ | >= 512 MB RAM |

---

## การติดตั้ง

### 1. Clone โปรเจกต์

```bash
git clone https://github.com/Mrintania/Lek_Sticker-application.git
cd Lek_Sticker-application
```

### 2. ติดตั้ง Dependencies

```bash
npm install
```

### 3. ตั้งค่า Environment Variables (ถ้าจำเป็น)

สร้างไฟล์ `.env.local` ที่ root ของโปรเจกต์:

```env
# JWT Secret Key — เปลี่ยนเป็นค่าสุ่มที่ปลอดภัย
JWT_SECRET=your-super-secret-key-change-this-in-production

# (ไม่บังคับ) ที่อยู่ฐานข้อมูล — ค่าเริ่มต้นคือ ./attendance.db
# DB_PATH=./attendance.db
```

> **หมายเหตุ:** หากไม่สร้างไฟล์ `.env.local` ระบบจะใช้ค่า default และสร้างฐานข้อมูลอัตโนมัติเมื่อเริ่มครั้งแรก

### 4. รันระบบในโหมด Development

```bash
npm run dev
```

เปิดเบราว์เซอร์ไปที่ [http://localhost:3000](http://localhost:3000)

---

## บัญชีเริ่มต้น (Default Accounts)

เมื่อรันครั้งแรก ระบบจะสร้างบัญชีเริ่มต้นอัตโนมัติ:

| Username | Password | Role | สิทธิ์ |
|----------|----------|------|--------|
| `admin` | `admin123` | Admin | เข้าถึงได้ทุกส่วน |
| `manager` | `manager123` | Manager | จัดการพนักงาน อนุมัติใบลา คำนวณเงินเดือน |

> ⚠️ **สำคัญ:** กรุณาเปลี่ยน Password ทันทีหลังจากเข้าสู่ระบบครั้งแรก

---

## การ Build สำหรับ Production

```bash
# Build
npm run build

# รัน Production Server
npm start
```

---

## โครงสร้างโปรเจกต์

```
lek_sticker/
├── app/                        # Next.js App Router
│   ├── api/                    # API Routes
│   │   ├── auth/               # Login / Logout / Me
│   │   ├── attendance/         # ข้อมูลการมางาน + Override
│   │   ├── employees/          # จัดการพนักงาน
│   │   ├── holidays/           # วันหยุด
│   │   ├── leaves/             # ระบบการลา
│   │   ├── payroll/            # คำนวณเงินเดือน
│   │   ├── scans/              # นำเข้าข้อมูลสแกน
│   │   ├── settings/           # ตั้งค่าระบบ
│   │   ├── users/              # จัดการผู้ใช้
│   │   └── admin/              # Admin-only APIs (audit-logs, reset-scans)
│   ├── admin/
│   │   ├── audit/              # หน้าบันทึกการใช้งาน (Admin only)
│   │   └── users/              # จัดการผู้ใช้ (Admin only)
│   ├── dashboard/              # หน้า Dashboard
│   ├── daily/                  # รายงานรายวัน
│   ├── weekly/                 # รายงานรายสัปดาห์
│   ├── monthly/                # รายงานรายเดือน
│   ├── employee/               # รายงานรายคน
│   ├── employees/              # จัดการพนักงาน
│   ├── leaves/                 # ระบบการลา
│   ├── payroll/                # ระบบเงินเดือน
│   ├── settings/               # ตั้งค่าระบบ
│   └── login/                  # หน้า Login
├── components/
│   ├── attendance/             # StatusOverrideModal
│   ├── layout/                 # Sidebar
│   └── upload/                 # FileUpload
├── hooks/                      # Custom React Hooks
├── lib/
│   ├── audit.ts                # Audit Log helper
│   ├── auth.ts                 # JWT + Auth utilities
│   ├── db.ts                   # SQLite Database + Schema
│   ├── formatters.ts           # Date/Time formatters
│   ├── parser.ts               # Excel parser
│   ├── processor.ts            # Attendance logic
│   └── types.ts                # TypeScript types
├── store/                      # Zustand stores
├── attendance.db               # SQLite database (ไม่ถูก commit)
├── middleware.ts               # Next.js middleware (auth guard)
└── package.json
```

---

## การใช้งาน

### การนำเข้าข้อมูลสแกนนิ้ว

1. ไปที่ **ตั้งค่า → นำเข้าข้อมูลการสแกน**
2. อัปโหลดไฟล์ `.xlsx` จากเครื่องสแกนนิ้ว
3. ระบบจะ import และสร้างพนักงานใหม่อัตโนมัติถ้ายังไม่มีในระบบ

### การอนุมัติใบลา

1. ไปที่ **ระบบการลา**
2. Badge สีแดงบน Sidebar แสดงจำนวนใบลาที่รออนุมัติ
3. กดปุ่ม ✓ เพื่ออนุมัติ หรือ ✗ เพื่อปฏิเสธ

### การคำนวณเงินเดือน

1. ไปที่ **เงินเดือน**
2. เลือกปีและเดือน
3. กด "คำนวณเงินเดือน"
4. กดชื่อพนักงานเพื่อดูรายละเอียด

### สูตรการคำนวณเงินเดือน

**พนักงานรายวัน:**
```
รายได้ = อัตรารายวัน × วันทำงานจริง (ครึ่งวัน = 0.5)
```

**พนักงานรายเดือน (ขาดไม่เกิน 5 วัน):**
```
รายได้ = เงินเดือน (เต็ม) + เบี้ยขยัน
```

**พนักงานรายเดือน (ขาดเกิน 5 วัน → คิดรายวัน):**
```
อัตรารายวัน = เงินเดือน ÷ วันทำงานทั้งหมดในเดือน
รายได้ = อัตรารายวัน × วันทำงานจริง
```

### การตั้งค่าวันหยุด

1. ไปที่ **ตั้งค่า → วันหยุด**
2. เลือกปีที่ต้องการ
3. Toggle เปิด/ปิดวันหยุดนักขัตฤกษ์แต่ละวัน
4. เพิ่มวันหยุดบริษัทได้ตามต้องการ

---

## ระบบ Role และสิทธิ์

| สิทธิ์ | Admin | Manager | User |
|--------|:-----:|:-------:|:----:|
| ดูรายงานทุกคน | ✅ | ✅ | ❌ (เฉพาะตัวเอง) |
| อนุมัติ/ปฏิเสธใบลา | ✅ | ✅ | ❌ |
| คำนวณเงินเดือน | ✅ | ✅ | ❌ |
| จัดการพนักงาน | ✅ | ✅ | ❌ |
| จัดการผู้ใช้ | ✅ | ❌ | ❌ |
| ดู Audit Log | ✅ | ❌ | ❌ |
| ตั้งค่าระบบ | ✅ | ❌ | ❌ |
| ขอลา | ❌ | ❌ | ✅ |

---

## API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | เข้าสู่ระบบ |
| POST | `/api/auth/logout` | ออกจากระบบ |
| GET | `/api/auth/me` | ดูข้อมูลผู้ใช้ปัจจุบัน |

### Attendance
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/attendance?start=&end=&employeeId=` | ดึงข้อมูลการมา |
| POST | `/api/attendance/override` | แก้ไขสถานะการมา |
| DELETE | `/api/attendance/override` | ลบการแก้ไขสถานะ |

### Leaves
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leaves?status=` | ดึงรายการใบลา |
| POST | `/api/leaves` | สร้างใบลาใหม่ |
| PUT | `/api/leaves/[id]` | อนุมัติ/ปฏิเสธ/แก้ไขใบลา |
| DELETE | `/api/leaves/[id]` | ลบใบลา (soft delete) |

### Employees
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/employees` | ดึงรายชื่อพนักงาน |
| POST | `/api/employees` | เพิ่มพนักงาน |
| PUT | `/api/employees/[id]` | แก้ไขข้อมูลพนักงาน |
| DELETE | `/api/employees/[id]` | ปิดใช้งานพนักงาน |

### Payroll
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/payroll?year=&month=` | ดึงข้อมูลเงินเดือน |
| POST | `/api/payroll/calculate` | คำนวณเงินเดือน |
| GET | `/api/payroll/settings` | ดึงการตั้งค่าเงินเดือน |
| PUT | `/api/payroll/settings` | อัปเดตการตั้งค่าเงินเดือน |

### Holidays
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/holidays?year=` | ดึงรายการวันหยุด |
| POST | `/api/holidays` | เพิ่มวันหยุด |
| PUT | `/api/holidays/[id]` | แก้ไข/Toggle วันหยุด |
| DELETE | `/api/holidays/[id]` | ลบวันหยุดบริษัท |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/audit-logs` | ดึง Audit Logs (Admin only) |
| DELETE | `/api/admin/reset-scans?confirm=yes` | ล้างข้อมูลสแกน (Admin only) |

---

## ฐานข้อมูล (Schema)

ระบบใช้ SQLite ผ่าน `better-sqlite3` ตารางหลักได้แก่:

| ตาราง | คำอธิบาย |
|-------|----------|
| `users` | บัญชีผู้ใช้ระบบ |
| `employees` | ข้อมูลพนักงาน |
| `raw_scans` | ข้อมูลสแกนนิ้วดิบ |
| `scan_imports` | ประวัติการนำเข้าไฟล์ |
| `attendance_overrides` | การแก้ไขสถานะการมา |
| `leaves` | ใบลา (soft-delete) |
| `payroll_records` | ประวัติการคำนวณเงินเดือน |
| `holidays` | วันหยุดนักขัตฤกษ์และวันหยุดบริษัท |
| `work_settings` | การตั้งค่าเวลาทำงาน |
| `payroll_settings` | การตั้งค่าเงินเดือน/เบี้ยขยัน |
| `audit_logs` | บันทึก Audit ทุกการกระทำ |

---

## Troubleshooting

### ปัญหา: `Cannot find module 'better-sqlite3'`
```bash
npm install better-sqlite3
```

### ปัญหา: `Database is locked`
หยุด process ที่รันอยู่ทั้งหมดก่อน แล้วรัน `npm run dev` ใหม่

### ปัญหา: ข้อมูลไม่แสดงหลังนำเข้าไฟล์
ตรวจสอบรูปแบบไฟล์ Excel ต้องมีคอลัมน์: `EmployeeID`, `Name`, `Department`, `DateTime`

### ปัญหา: เงินเดือนคำนวณไม่ถูก
- ตรวจสอบว่าตั้งค่า `วันทำงาน` ถูกต้องในหน้าตั้งค่า
- ตรวจสอบวันหยุดว่า toggle ถูกต้อง
- ตรวจสอบว่าใบลาถูกอนุมัติแล้ว

---

## Changelog

### v1.0.0 (2025)
- ระบบรายงานการเข้างาน (รายวัน/สัปดาห์/เดือน/รายคน)
- ระบบการลา พร้อมอนุมัติ/ปฏิเสธ
- ระบบเงินเดือน รองรับรายวัน/รายเดือน + เบี้ยขยันขั้นบันได
- ระบบวันหยุดนักขัตฤกษ์ไทย + วันหยุดบริษัท
- Audit Log ครบถ้วนทุก Action
- Role-Based Access Control (Admin / Manager / User)
- Sidebar Badge แจ้งเตือนใบลารออนุมัติ

---

## ลิขสิทธิ์

Copyright © 2025 **เล็กสติ๊กเกอร์ (Lek Sticker)**

ซอฟต์แวร์นี้พัฒนาขึ้นสำหรับการใช้งานภายในบริษัทเล็กสติ๊กเกอร์
ดูรายละเอียดเพิ่มเติมได้ในไฟล์ [LICENSE](./LICENSE)

---

<div align="center">
  <sub>พัฒนาด้วย Next.js 14 + TypeScript + SQLite</sub>
</div>
