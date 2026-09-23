import fs from 'fs';
import path from 'path';
import { pool } from './client';

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('Acquiring migration lock...');
    await client.query('SELECT pg_advisory_lock(123456)');
    console.log('Migration lock acquired.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const migrationsDir = path.join(process.cwd(), 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found.');
      return;
    }

    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      const { rows } = await client.query('SELECT name FROM _schema_migrations WHERE name = $1', [file]);
      if (rows.length === 0) {
        console.log(`Executing migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO _schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Migration ${file} executed successfully.`);
      } else {
        console.log(`Migration ${file} already executed.`);
      }
    }
    console.log('All migrations completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.query('SELECT pg_advisory_unlock(123456)');
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations();
}
