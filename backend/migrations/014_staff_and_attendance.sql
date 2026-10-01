-- Migration 014: Staff Directory and Attendance Records

-- 1. Attendance Status Enum
DO $$ BEGIN
    CREATE TYPE attendance_status AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'OFF_DAY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Staff Table
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(120) NOT NULL,
    phone VARCHAR(25),
    role_title VARCHAR(80) NOT NULL,
    joining_date DATE NOT NULL,
    emergency_contact VARCHAR(25),
    salary_reference NUMERIC(12, 2) CHECK (salary_reference IS NULL OR salary_reference >= 0),
    notes VARCHAR(1000),
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES admins(id),
    updated_by UUID REFERENCES admins(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Attendance Records Table
CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
    business_date DATE NOT NULL,
    status attendance_status NOT NULL,
    check_in_at TIMESTAMPTZ,
    check_out_at TIMESTAMPTZ,
    note VARCHAR(500),
    created_by UUID REFERENCES admins(id),
    updated_by UUID REFERENCES admins(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_attendance_staff_business_date UNIQUE (staff_id, business_date)
);

-- 4. Indexes for Filter and Join Performance
CREATE INDEX IF NOT EXISTS idx_staff_archived_role ON staff(is_archived, role_title);
CREATE INDEX IF NOT EXISTS idx_staff_name ON staff(LOWER(full_name));
CREATE INDEX IF NOT EXISTS idx_attendance_business_date ON attendance_records(business_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_staff_date ON attendance_records(staff_id, business_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_date_status ON attendance_records(business_date, status);
