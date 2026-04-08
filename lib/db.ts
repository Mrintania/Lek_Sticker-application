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
      // Production tracking indexes
      `CREATE INDEX IF NOT EXISTS idx_machine_assignments_date ON machine_assignments(date)`,
      `CREATE INDEX IF NOT EXISTS idx_machine_assignments_employee ON machine_assignments(employee_id)`,
      `CREATE INDEX IF NOT EXISTS idx_production_records_date ON production_records(date)`,
      `CREATE INDEX IF NOT EXISTS idx_production_items_record ON production_items(record_id)`,
      // Payroll manual adjustments (เงินเพิ่มพิเศษ / หัก)
      `ALTER TABLE payroll_records ADD COLUMN extra_bonus REAL DEFAULT 0`,
      `ALTER TABLE payroll_records ADD COLUMN extra_bonus_note TEXT`,
      `ALTER TABLE payroll_records ADD COLUMN extra_deduction REAL DEFAULT 0`,
      `ALTER TABLE payroll_records ADD COLUMN extra_deduction_note TEXT`,
      // Performance indexes for frequent query patterns
      `CREATE INDEX IF NOT EXISTS idx_leaves_employee_id ON leaves(employee_id)`,
      `CREATE INDEX IF NOT EXISTS idx_leaves_employee_date ON leaves(employee_id, date)`,
      `CREATE INDEX IF NOT EXISTS idx_raw_scans_employee_id ON raw_scans(employee_id)`,
      `CREATE INDEX IF NOT EXISTS idx_payroll_records_employee_id ON payroll_records(employee_id)`,
      `CREATE INDEX IF NOT EXISTS idx_payroll_records_period ON payroll_records(year, month, period)`,
      `CREATE INDEX IF NOT EXISTS idx_attendance_overrides_employee_id ON attendance_overrides(employee_id)`,
      `ALTER TABLE employees ADD COLUMN phone TEXT`,
      `ALTER TABLE employees ADD COLUMN bank_name TEXT`,
      `ALTER TABLE employees ADD COLUMN bank_account_number TEXT`,
      `ALTER TABLE employees ADD COLUMN bank_account_name TEXT`,
      `ALTER TABLE employees ADD COLUMN prompt_pay_id TEXT`,
      `ALTER TABLE payroll_records ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'pending'`,
      `ALTER TABLE payroll_records ADD COLUMN payment_method TEXT`,
      `ALTER TABLE payroll_records ADD COLUMN payment_note TEXT`,
      `ALTER TABLE payroll_records ADD COLUMN paid_at TEXT`,
      `ALTER TABLE payroll_records ADD COLUMN paid_by TEXT`,
      `CREATE INDEX IF NOT EXISTS idx_payroll_records_payment_status ON payroll_records(payment_status)`,
      // Delivery records tables
      `CREATE TABLE IF NOT EXISTS delivery_records (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        date       TEXT NOT NULL UNIQUE,
        notes      TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS delivery_items (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id   INTEGER NOT NULL REFERENCES delivery_records(id) ON DELETE CASCADE,
        model_name  TEXT NOT NULL,
        quantity    INTEGER NOT NULL CHECK(quantity > 0),
        destination TEXT,
        sort_order  INTEGER DEFAULT 0,
        created_at  TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_delivery_records_date ON delivery_records(date)`,
      `CREATE INDEX IF NOT EXISTS idx_delivery_items_record ON delivery_items(record_id)`,
      // Finance tables
      `CREATE TABLE IF NOT EXISTS finance_recurring_templates (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_type   TEXT NOT NULL CHECK(expense_type IN ('fixed','variable')),
        category       TEXT NOT NULL,
        sub_category   TEXT,
        default_amount REAL NOT NULL DEFAULT 0,
        note           TEXT,
        is_active      INTEGER DEFAULT 1,
        created_by     TEXT,
        created_at     TEXT DEFAULT (datetime('now')),
        updated_at     TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS finance_income (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        year           INTEGER NOT NULL,
        month          INTEGER NOT NULL,
        income_type    TEXT NOT NULL CHECK(income_type IN ('print_order','other')),
        quantity       REAL,
        price_per_unit REAL,
        amount         REAL NOT NULL,
        category       TEXT,
        note           TEXT,
        entry_date     TEXT NOT NULL,
        created_by     TEXT,
        created_at     TEXT DEFAULT (datetime('now')),
        updated_at     TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS finance_expenses (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        year           INTEGER NOT NULL,
        month          INTEGER NOT NULL,
        expense_type   TEXT NOT NULL CHECK(expense_type IN ('fixed','variable')),
        category       TEXT NOT NULL,
        sub_category   TEXT,
        amount         REAL NOT NULL,
        note           TEXT,
        entry_date     TEXT NOT NULL,
        from_recurring INTEGER DEFAULT 0,
        recurring_id   INTEGER REFERENCES finance_recurring_templates(id),
        created_by     TEXT,
        created_at     TEXT DEFAULT (datetime('now')),
        updated_at     TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS finance_od_accounts (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        bank_name      TEXT NOT NULL,
        account_number TEXT NOT NULL,
        credit_limit   REAL NOT NULL DEFAULT 0,
        interest_rate  REAL NOT NULL DEFAULT 0,
        is_active      INTEGER DEFAULT 1,
        created_by     TEXT,
        created_at     TEXT DEFAULT (datetime('now')),
        updated_at     TEXT DEFAULT (datetime('now')),
        UNIQUE(bank_name, account_number)
      )`,
      `CREATE TABLE IF NOT EXISTS finance_od_entries (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        od_account_id  INTEGER NOT NULL REFERENCES finance_od_accounts(id) ON DELETE CASCADE,
        year           INTEGER NOT NULL,
        month          INTEGER NOT NULL,
        balance_used   REAL NOT NULL DEFAULT 0,
        interest_amount REAL NOT NULL DEFAULT 0,
        payment_amount REAL DEFAULT 0,
        note           TEXT,
        entry_date     TEXT NOT NULL,
        created_by     TEXT,
        created_at     TEXT DEFAULT (datetime('now')),
        updated_at     TEXT DEFAULT (datetime('now')),
        UNIQUE(od_account_id, year, month)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_finance_income_ym ON finance_income(year, month)`,
      `CREATE INDEX IF NOT EXISTS idx_finance_income_date ON finance_income(entry_date)`,
      `CREATE INDEX IF NOT EXISTS idx_finance_expenses_ym ON finance_expenses(year, month)`,
      `CREATE INDEX IF NOT EXISTS idx_finance_expenses_type ON finance_expenses(expense_type)`,
      `CREATE INDEX IF NOT EXISTS idx_finance_od_entries_ym ON finance_od_entries(year, month)`,
      `CREATE INDEX IF NOT EXISTS idx_finance_od_entries_account ON finance_od_entries(od_account_id)`,
    ]
    for (const sql of migrations) {
      try { db.exec(sql) } catch {}
    }

    // Seed finance recurring templates (ต้องทำหลัง migrations สร้าง table แล้ว)
    const recurringExists = db.prepare("SELECT id FROM finance_recurring_templates LIMIT 1").get()
    if (!recurringExists) {
      const insertTemplate = db.prepare(
        `INSERT OR IGNORE INTO finance_recurring_templates (expense_type, category, default_amount) VALUES (?, ?, ?)`
      )
      const templates: [string, string, number][] = [
        ['fixed', 'car_installment', 0],
        ['fixed', 'rent', 0],
        ['fixed', 'salary_total', 0],
        ['fixed', 'insurance', 0],
        ['variable', 'raw_materials', 0],
        ['variable', 'electricity', 0],
        ['variable', 'transport', 0],
        ['variable', 'maintenance', 0],
        ['variable', 'ot', 0],
      ]
      const seedTemplates = db.transaction(() => {
        for (const [type, cat, amt] of templates) insertTemplate.run(type, cat, amt)
      })
      seedTemplates()
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

    // Migration: add period column to payroll_records for bi-monthly payroll
    const payrollSchema = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='payroll_records'`).get() as { sql: string } | undefined
    if (payrollSchema && !payrollSchema.sql.includes('period')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS payroll_records_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employee_id TEXT NOT NULL,
          year INTEGER NOT NULL,
          month INTEGER NOT NULL,
          period INTEGER NOT NULL DEFAULT 1,
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
          UNIQUE(employee_id, year, month, period)
        );
        INSERT INTO payroll_records_new
          (id, employee_id, year, month, period, working_days, days_present, days_absent,
           days_sick_with_cert, days_sick_no_cert, days_half_day, total_late_minutes,
           base_pay, diligence_bonus, deductions, total_pay, is_finalized, notes, created_by, created_at)
        SELECT id, employee_id, year, month, 1, working_days, days_present, days_absent,
               days_sick_with_cert, days_sick_no_cert, days_half_day, total_late_minutes,
               base_pay, diligence_bonus, deductions, total_pay, is_finalized, notes, created_by, created_at
        FROM payroll_records;
        DROP TABLE payroll_records;
        ALTER TABLE payroll_records_new RENAME TO payroll_records;
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
      period INTEGER NOT NULL DEFAULT 1,
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
      UNIQUE(employee_id, year, month, period)
    );

    -- ระบบบันทึกงานการผลิต
    CREATE TABLE IF NOT EXISTS print_machines (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      code        TEXT NOT NULL UNIQUE,
      name        TEXT NOT NULL,
      description TEXT,
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_by  TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS machine_assignments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_id  INTEGER NOT NULL REFERENCES print_machines(id),
      date        TEXT NOT NULL,
      employee_id TEXT NOT NULL REFERENCES employees(employee_id),
      slot        INTEGER NOT NULL DEFAULT 1 CHECK(slot IN (1,2)),
      created_by  TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      UNIQUE(machine_id, date, slot)
    );

    CREATE TABLE IF NOT EXISTS production_records (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_id  INTEGER NOT NULL REFERENCES print_machines(id),
      date        TEXT NOT NULL,
      notes       TEXT,
      created_by  TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now')),
      UNIQUE(machine_id, date)
    );

    CREATE TABLE IF NOT EXISTS production_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id   INTEGER NOT NULL REFERENCES production_records(id) ON DELETE CASCADE,
      model_name  TEXT NOT NULL,
      quantity    INTEGER NOT NULL CHECK(quantity > 0),
      sort_order  INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS performance_evaluations (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id       TEXT NOT NULL REFERENCES employees(employee_id),
      period_start      TEXT NOT NULL,
      period_end        TEXT NOT NULL,
      evaluator         TEXT NOT NULL,
      score_attendance  REAL,
      score_production  REAL,
      score_behavior    REAL,
      notes             TEXT,
      raise_amount      REAL,
      status            TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved')),
      approved_by       TEXT,
      approved_at       TEXT,
      created_at        TEXT DEFAULT (datetime('now')),
      updated_at        TEXT DEFAULT (datetime('now')),
      UNIQUE(employee_id, period_start, period_end)
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
