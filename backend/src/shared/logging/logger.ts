import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'password',
      'password_hash',
      'token',
      'token_hash',
      'cookie',
      'headers.authorization',
      'headers.cookie',
      'phone',
      'email',
      'contactPerson',
      'contact_person',
      'gstin',
      'salaryReference',
      'salary_reference',
      'emergencyContact',
      'emergency_contact',
      'backup_reference',
      'backupReference',
      'user_agent_hash',
      'last_ip_hash',
      'rawToken'
    ],
    censor: '[REDACTED]'
  }
});
