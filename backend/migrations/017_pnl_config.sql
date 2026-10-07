-- Migration 017: P&L Break-Even Configuration
-- Adds target_gross_margin_rate to target_settings for Phase 3 Module 4 break-even calculation.
-- NULL = not configured → break-even returns null with a clear reason (safe failure, no fabricated results).

ALTER TABLE target_settings
    ADD COLUMN IF NOT EXISTS target_gross_margin_rate NUMERIC(5, 4) DEFAULT NULL
        CHECK (
            target_gross_margin_rate IS NULL
            OR (target_gross_margin_rate > 0 AND target_gross_margin_rate < 1)
        );

COMMENT ON COLUMN target_settings.target_gross_margin_rate IS
    'Target gross margin rate for break-even calculation (e.g. 0.6000 = 60%). NULL means not configured.';
