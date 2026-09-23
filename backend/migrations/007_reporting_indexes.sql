-- Migration 007: Performance & Reporting Indexes

CREATE INDEX IF NOT EXISTS idx_bills_business_date_status ON bills(business_date, status);
CREATE INDEX IF NOT EXISTS idx_bills_completed_at ON bills(completed_at);
CREATE INDEX IF NOT EXISTS idx_bill_lines_bill_id ON bill_lines(bill_id);
CREATE INDEX IF NOT EXISTS idx_payments_bill_id ON payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_payments_method_processed ON payments(payment_method, processed_at);
CREATE INDEX IF NOT EXISTS idx_expenses_business_date_voided ON expenses(business_date, is_voided);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON audit_logs(action, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_requested ON export_jobs(requested_by, created_at);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency(expires_at);
