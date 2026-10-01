import { query } from '@/shared/database/client';
import { PoolClient } from 'pg';
import { Staff, CreateStaffDTO, UpdateStaffDTO, StaffListParams } from './staff.types';

export class StaffRepository {
  static async list(params: StaffListParams): Promise<Omit<Staff, 'salary_reference'>[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    // Filter by archived status
    if (params.archived === 'all') {
      // no filter
    } else if (params.archived === true || params.archived === 'true') {
      conditions.push(`is_archived = TRUE`);
    } else {
      // Default: active only
      conditions.push(`is_archived = FALSE`);
    }

    // Filter by role title
    if (params.roleTitle && params.roleTitle.trim()) {
      conditions.push(`LOWER(role_title) = LOWER($${idx++})`);
      values.push(params.roleTitle.trim());
    }

    // Search by full name or phone
    if (params.search && params.search.trim()) {
      conditions.push(`(LOWER(full_name) LIKE LOWER($${idx}) OR LOWER(role_title) LIKE LOWER($${idx}) OR phone LIKE $${idx})`);
      values.push(`%${params.search.trim()}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT 
        id,
        full_name,
        phone,
        role_title,
        TO_CHAR(joining_date, 'YYYY-MM-DD') AS joining_date,
        emergency_contact,
        notes,
        is_archived,
        created_by,
        updated_by,
        created_at,
        updated_at
      FROM staff
      ${whereClause}
      ORDER BY is_archived ASC, LOWER(full_name) ASC
    `;

    const { rows } = await query(sql, values);
    return rows;
  }

  static async findById(id: string, client?: PoolClient): Promise<Staff | null> {
    const sql = `
      SELECT 
        id,
        full_name,
        phone,
        role_title,
        TO_CHAR(joining_date, 'YYYY-MM-DD') AS joining_date,
        emergency_contact,
        salary_reference,
        notes,
        is_archived,
        created_by,
        updated_by,
        created_at,
        updated_at
      FROM staff
      WHERE id = $1
    `;
    const db = client || { query: (t: string, v: any[]) => query(t, v) };
    const { rows } = await db.query(sql, [id]);
    return rows[0] || null;
  }

  static async create(
    data: {
      fullName: string;
      phone: string | null;
      roleTitle: string;
      joiningDate: string;
      emergencyContact: string | null;
      salaryReference: string | null;
      notes: string | null;
    },
    adminId: string,
    client?: PoolClient
  ): Promise<Staff> {
    const sql = `
      INSERT INTO staff (
        full_name,
        phone,
        role_title,
        joining_date,
        emergency_contact,
        salary_reference,
        notes,
        created_by,
        updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
      RETURNING 
        id,
        full_name,
        phone,
        role_title,
        TO_CHAR(joining_date, 'YYYY-MM-DD') AS joining_date,
        emergency_contact,
        salary_reference,
        notes,
        is_archived,
        created_by,
        updated_by,
        created_at,
        updated_at
    `;
    const values = [
      data.fullName,
      data.phone,
      data.roleTitle,
      data.joiningDate,
      data.emergencyContact,
      data.salaryReference,
      data.notes,
      adminId
    ];

    const db = client || { query: (t: string, v: any[]) => query(t, v) };
    const { rows } = await db.query(sql, values);
    return rows[0];
  }

  static async update(
    id: string,
    data: {
      fullName?: string;
      phone?: string | null;
      roleTitle?: string;
      joiningDate?: string;
      emergencyContact?: string | null;
      salaryReference?: string | null;
      notes?: string | null;
    },
    adminId: string,
    client?: PoolClient
  ): Promise<Staff> {
    const updates: string[] = [];
    const values: any[] = [id, adminId];
    let idx = 3;

    if (data.fullName !== undefined) {
      updates.push(`full_name = $${idx++}`);
      values.push(data.fullName);
    }
    if (data.phone !== undefined) {
      updates.push(`phone = $${idx++}`);
      values.push(data.phone);
    }
    if (data.roleTitle !== undefined) {
      updates.push(`role_title = $${idx++}`);
      values.push(data.roleTitle);
    }
    if (data.joiningDate !== undefined) {
      updates.push(`joining_date = $${idx++}`);
      values.push(data.joiningDate);
    }
    if (data.emergencyContact !== undefined) {
      updates.push(`emergency_contact = $${idx++}`);
      values.push(data.emergencyContact);
    }
    if (data.salaryReference !== undefined) {
      updates.push(`salary_reference = $${idx++}`);
      values.push(data.salaryReference);
    }
    if (data.notes !== undefined) {
      updates.push(`notes = $${idx++}`);
      values.push(data.notes);
    }

    updates.push(`updated_by = $2`);
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    const sql = `
      UPDATE staff
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING 
        id,
        full_name,
        phone,
        role_title,
        TO_CHAR(joining_date, 'YYYY-MM-DD') AS joining_date,
        emergency_contact,
        salary_reference,
        notes,
        is_archived,
        created_by,
        updated_by,
        created_at,
        updated_at
    `;

    const db = client || { query: (t: string, v: any[]) => query(t, v) };
    const { rows } = await db.query(sql, values);
    return rows[0];
  }

  static async setArchivedStatus(
    id: string,
    isArchived: boolean,
    adminId: string,
    client?: PoolClient
  ): Promise<Staff> {
    const sql = `
      UPDATE staff
      SET is_archived = $2, updated_by = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING 
        id,
        full_name,
        phone,
        role_title,
        TO_CHAR(joining_date, 'YYYY-MM-DD') AS joining_date,
        emergency_contact,
        salary_reference,
        notes,
        is_archived,
        created_by,
        updated_by,
        created_at,
        updated_at
    `;
    const db = client || { query: (t: string, v: any[]) => query(t, v) };
    const { rows } = await db.query(sql, [id, isArchived, adminId]);
    return rows[0];
  }
}
