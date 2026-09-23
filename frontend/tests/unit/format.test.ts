import { describe, it, expect } from 'vitest';
import { formatINR } from '../../src/lib/format';

describe('Format Utilities (formatINR)', () => {
  it('formats positive numbers as INR currency', () => {
    expect(formatINR(7850)).toContain('7,850.00');
    expect(formatINR('150.5')).toContain('150.50');
    expect(formatINR(0)).toContain('0.00');
  });

  it('formats negative numbers correctly', () => {
    expect(formatINR(-500)).toContain('-');
    expect(formatINR(-500)).toContain('500.00');
  });

  it('handles invalid inputs gracefully by returning ₹0.00', () => {
    expect(formatINR(NaN)).toContain('0.00');
    expect(formatINR('invalid')).toContain('0.00');
    expect(formatINR(null as any)).toContain('0.00');
    expect(formatINR(undefined as any)).toContain('0.00');
  });
});
