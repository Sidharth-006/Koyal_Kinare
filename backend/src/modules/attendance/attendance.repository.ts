import { query } from '@/shared/database/client';
import { PoolClient } from 'pg';
import { AttendanceRecord, SaveAttendanceRequestDTO } from './attendance.types';

export class AttendanceRepository {
  static async getDailyAttendanceRoster(businessDate: string): Promise<any[]> {
    const sql = `
      SELECT 
        s.id AS staff_id,
        s.full_name AS staff_name,
        s.role_title AS staff_role_title,
        s.is_archived,
        s.joining_date,
        ar.id AS attendance_id,
        $1::DATE AS business_date,
        ar.status,
        ar.check_in_at,
        ar.check_out_at,
        ar.note,
        ar.created_by,
        ar.updated_by,
        ar.created_at,
        ar.updated_at
      FROM staff s
      LEFT JOIN attendance_records ar 
        ON s.id = ar.staff_id AND ar.business_date = $1::DATE
      WHERE 
        -- Staff is active OR has an existing attendance record on this date
        (s.is_archived = FALSE OR ar.id IS NOT NULL)
        -- Staff must have joined on or before this business date
        AND s.joining_date <= $1::DATE
      ORDER BY s.is_archived ASC, LOWER(s.full_name) ASC
    `;

    const { rows } = await query(sql, [businessDate]);
    return rows;
  }

  static async findRecordByStaffAndDate(
    staffId: string,
    businessDate: string,
    client?: PoolClient
  ): Promise<AttendanceRecord | null> {
    const sql = `
      SELECT 
        ar.id,
        ar.staff_id,
        s.full_name AS staff_name,
        s.role_title AS staff_role_title,
        TO_CHAR(ar.business_date, 'YYYY-MM-DD') AS business_date,
        ar.status,
        ar.check_in_at,
        ar.check_out_at,
        ar.note,
        ar.created_by,
        ar.updated_by,
        ar.created_at,
        ar.updated_at
      FROM attendance_records ar
      JOIN staff s ON ar.staff_id = s.id
      WHERE ar.staff_id = $1 AND ar.business_date = $2::DATE
    `;

    const db = client || { query: (t: string, v: any[]) => query(t, v) };
    const { rows } = await db.query(sql, [staffId, businessDate]);
    return rows[0] || null;
  }

  static async upsertRecord(
    staffId: string,
    businessDate: string,
    data: SaveAttendanceRequestDTO,
    adminId: string,
    client?: PoolClient
  ): Promise<AttendanceRecord> {
    const sql = `
      INSERT INTO attendance_records (
        staff_id,
        business_date,
        status,
        check_in_at,
        check_out_at,
        note,
        created_by,
        updated_by
      ) VALUES ($1, $2::DATE, $3, $4, $5, $6, $7, $7)
      ON CONFLICT (staff_id, business_date) DO UPDATE
      SET 
        status = EXCLUDED.status,
        check_in_at = EXCLUDED.check_in_at,
        check_out_at = EXCLUDED.check_out_at,
        note = EXCLUDED.note,
        updated_by = EXCLUDED.updated_by,
        updated_at = CURRENT_TIMESTAMP
      RETURNING 
        id,
        staff_id,
        TO_CHAR(business_date, 'YYYY-MM-DD') AS business_date,
        status,
        check_in_at,
        check_out_at,
        note,
        created_by,
        updated_by,
        created_at,
        updated_at
    `;

    const values = [
      staffId,
      businessDate,
      data.status,
      data.checkInAt || null,
      data.checkOutAt || null,
      data.note || null,
      adminId
    ];

    const db = client || { query: (t: string, v: any[]) => query(t, v) };
    const { rows } = await db.query(sql, values);
    return rows[0];
  }

  static async getAttendanceByDateRange(
    from: string,
    to: string,
    staffId?: string
  ): Promise<AttendanceRecord[]> {
    const conditions: string[] = [
      `ar.business_date >= $1::DATE`,
      `ar.business_date <= $2::DATE`
    ];
    const values: any[] = [from, to];

    if (staffId && staffId.trim()) {
      conditions.push(`ar.staff_id = $3`);
      values.push(staffId.trim());
    }

    const sql = `
      SELECT 
        ar.id,
        ar.staff_id,
        s.full_name AS staff_name,
        s.role_title AS staff_role_title,
        s.is_archived,
        TO_CHAR(ar.business_date, 'YYYY-MM-DD') AS business_date,
        ar.status,
        ar.check_in_at,
        ar.check_out_at,
        ar.note,
        ar.created_by,
        ar.updated_by,
        ar.created_at,
        ar.updated_at
      FROM attendance_records ar
      JOIN staff s ON ar.staff_id = s.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY ar.business_date ASC, LOWER(s.full_name) ASC
    `;

    const { rows } = await query(sql, values);
    return rows;
  }
}
