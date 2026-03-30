import Database from 'better-sqlite3'
import path from 'path'
import bcrypt from 'bcryptjs'

const DB_PATH = path.join(process.cwd(), 'attendance.db')

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema()

    // Migration: add tiered diligence bonus columns + soft-delete on leaves
    const migrations = [
      `ALTER TABLE payroll_settings ADD COLUMN tier1_threshold INTEGER DEFAULT 1`,
      `ALTER TABLE payroll_settings ADD COLUMN tier1_amount REAL DEFAULT 1000`,
      `ALTER TABLE payroll_settings ADD COLUMN tier2_threshold INTEGER DEFAULT 3`,
      `ALTER TABLE payroll_settings ADD COLUMN tier2_amount REAL DEFAULT 800`,
      `ALTER TABLE payroll_settings ADD COLUMN tier3_threshold INTEGER DEFAULT 5`,
      `ALTER TABLE payroll_settings ADD COLUMN tier3_amount REAL DEFAULT 500`,
      `ALTER TABLE payroll_settings ADD COLUMN monthly_max_absent REAL DEFAULT 3.5`,
      // Step-based diligence bonus (new system)
      `ALTER TABLE payroll_settings ADD COLUMN diligence_base_amount REAL DEFAULT 1000`,
      `ALTER TABLE payroll_settings ADD COLUMN diligence_step_amount REAL DEFAULT 150`,
      `ALTER TABLE payroll_settings ADD COLUMN diligence_max_days REAL DEFAULT 3`,
      // Soft delete for leaves
      `ALTER TABLE leaves ADD COLUMN deleted_at TEXT`,
      `ALTER TABLE leaves ADD COLUMN deleted_by TEXT`,
      // Audit log indexes
      `CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at)`,
    ]
    for (const sql of migrations) {
      try { db.exec(sql) } catch {}
    }

    // อัปเดตค่า monthly_max_absent เป็น 3.5 (กฎใหม่) ถ้ายังเป็นค่าเก่า (5)
    db.prepare(`UPDATE payroll_settings SET monthly_max_absent = 3.5 WHERE id = 1 AND monthly_max_absent = 5`).run()

    // Migration: add 'full_day' leave type (replace sick-without-cert)
    // Check if the leaves table already supports 'full_day'
    const leavesSchema = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='leaves'`).get() as { sql: string } | undefined
    if (leavesSchema && !leavesSchema.sql.includes('full_day')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS leaves_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employee_id TEXT NOT NULL,
          leave_type TEXT NOT NULL CHECK(leave_type IN ('sick','full_day','half_morning','half_afternoon')),
          date TEXT NOT NULL,
          has_medical_cert INTEGER DEFAULT 0,
          reason TEXT,
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
          approved_by TEXT,
          approved_at TEXT,
          reject_reason TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO leaves_new SELECT * FROM leaves;
        DROP TABLE leaves;
        ALTER TABLE leaves_new RENAME TO leaves;
      `)
    }
  }
  return db
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','manager','user')),
      employee_id TEXT,
      full_name TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS employees (
      employee_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      nickname TEXT,
      department TEXT,
      employment_type TEXT NOT NULL DEFAULT 'daily' CHECK(employment_type IN ('daily','monthly')),
      daily_rate REAL,
      monthly_salary REAL,
      start_date TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS work_settings (
      id INTEGER PRIMARY KEY,
      work_start_time TEXT DEFAULT '08:00',
      work_end_time TEXT DEFAULT '17:00',
      late_threshold_minutes INTEGER DEFAULT 15,
      early_leave_threshold_minutes INTEGER DEFAULT 30,
      min_work_hours REAL DEFAULT 8,
      half_day_hours REAL DEFAULT 4,
      work_days TEXT DEFAULT '0,1,2,3,4,5',
      single_scan_policy TEXT DEFAULT 'checkin_only',
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scan_imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT,
      imported_by TEXT,
      import_date TEXT DEFAULT (datetime('now')),
      date_range_start TEXT,
      date_range_end TEXT,
      record_count INTEGER
    );

    CREATE TABLE IF NOT EXISTS raw_scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      import_id INTEGER REFERENCES scan_imports(id),
      employee_id TEXT NOT NULL,
      employee_name TEXT,
      department TEXT,
      scan_datetime TEXT NOT NULL,
      direction TEXT DEFAULT 'C/In',
      recorded_by TEXT,
      UNIQUE(employee_id, scan_datetime)
    );

    CREATE TABLE IF NOT EXISTS attendance_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT NOT NULL,
      date TEXT NOT NULL,
      override_status TEXT NOT NULL,
      leave_id INTEGER,
      note TEXT,
      updated_by TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(employee_id, date)
    );

    CREATE TABLE IF NOT EXISTS leaves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT NOT NULL,
      leave_type TEXT NOT NULL CHECK(leave_type IN ('sick','half_morning','half_afternoon')),
      date TEXT NOT NULL,
      has_medical_cert INTEGER DEFAULT 0,
      reason TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      approved_by TEXT,
      approved_at TEXT,
      reject_reason TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payroll_settings (
      id INTEGER PRIMARY KEY,
      diligence_bonus_enabled INTEGER DEFAULT 1,
      diligence_bonus_amount REAL DEFAULT 500,
      sick_with_cert_exempt INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('thai_national', 'company')),
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payroll_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      working_days INTEGER,
      days_present INTEGER,
      days_absent INTEGER,
      days_sick_with_cert INTEGER DEFAULT 0,
      days_sick_no_cert INTEGER DEFAULT 0,
      days_half_day INTEGER DEFAULT 0,
      total_late_minutes INTEGER DEFAULT 0,
      base_pay REAL NOT NULL DEFAULT 0,
      diligence_bonus REAL DEFAULT 0,
      deductions REAL DEFAULT 0,
      total_pay REAL NOT NULL DEFAULT 0,
      is_finalized INTEGER DEFAULT 0,
      notes TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(employee_id, year, month)
    );
  `)

  // Seed default work settings
  const settings = db.prepare('SELECT id FROM work_settings WHERE id = 1').get()
  if (!settings) {
    db.prepare("INSERT INTO work_settings (id) VALUES (1)").run()
  }

  // Seed payroll settings
  const ps = db.prepare('SELECT id FROM payroll_settings WHERE id = 1').get()
  if (!ps) {
    db.prepare("INSERT INTO payroll_settings (id) VALUES (1)").run()
  }

  // Seed Thai national holidays (fixed-date) for 2025 and 2026
  const holidayExists = db.prepare("SELECT id FROM holidays LIMIT 1").get()
  if (!holidayExists) {
    const insertHoliday = db.prepare(
      `INSERT OR IGNORE INTO holidays (date, name, type) VALUES (?, ?, 'thai_national')`
    )
    const thaiHolidays = [
      // 2025
      ['2025-01-01', 'วันขึ้นปีใหม่'],
      ['2025-04-06', 'วันจักรี'],
      ['2025-04-13', 'วันสงกรานต์'],
      ['2025-04-14', 'วันสงกรานต์'],
      ['2025-04-15', 'วันสงกรานต์'],
      ['2025-05-01', 'วันแรงงานแห่งชาติ'],
      ['2025-05-04', 'วันฉัตรมงคล'],
      ['2025-07-28', 'วันเฉลิมพระชนมพรรษา รัชกาลที่ 10'],
      ['2025-08-12', 'วันแม่แห่งชาติ'],
      ['2025-10-23', 'วันปิยมหาราช'],
      ['2025-12-05', 'วันพ่อแห่งชาติ'],
      ['2025-12-10', 'วันรัฐธรรมนูญ'],
      ['2025-12-31', 'วันสิ้นปี'],
      // 2026
      ['2026-01-01', 'วันขึ้นปีใหม่'],
      ['2026-04-06', 'วันจักรี'],
      ['2026-04-13', 'วันสงกรานต์'],
      ['2026-04-14', 'วันสงกรานต์'],
      ['2026-04-15', 'วันสงกรานต์'],
      ['2026-05-01', 'วันแรงงานแห่งชาติ'],
      ['2026-05-04', 'วันฉัตรมงคล'],
      ['2026-07-28', 'วันเฉลิมพระชนมพรรษา รัชกาลที่ 10'],
      ['2026-08-12', 'วันแม่แห่งชาติ'],
      ['2026-10-23', 'วันปิยมหาราช'],
      ['2026-12-05', 'วันพ่อแห่งชาติ'],
      ['2026-12-10', 'วันรัฐธรรมนูญ'],
      ['2026-12-31', 'วันสิ้นปี'],
    ]
    const seedAll = db.transaction(() => {
      for (const [date, name] of thaiHolidays) insertHoliday.run(date, name)
    })
    seedAll()
  }

  // Seed default users
  const adminExists = db.prepare("SELECT id FROM users WHERE username = 'admin'").get()
  if (!adminExists) {
    const adminHash = bcrypt.hashSync('admin123', 10)
    const managerHash = bcrypt.hashSync('manager123', 10)
    db.prepare("INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, 'admin', 'ผู้ดูแลระบบ')").run('admin', adminHash)
    db.prepare("INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, 'manager', 'ผู้จัดการ')").run('manager', managerHash)
  }
}

export default getDb
