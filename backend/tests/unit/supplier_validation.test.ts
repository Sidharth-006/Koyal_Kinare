import { describe, it, expect } from 'vitest';
import { SupplierService } from '@/modules/supplier/supplier.service';
import { ValidationError } from '@/shared/errors';

describe('Supplier Validation Unit Tests', () => {
  describe('Name Validation', () => {
    it('should reject missing or empty name', () => {
      expect(() => SupplierService.validateName('')).toThrow(ValidationError);
      expect(() => SupplierService.validateName('   ')).toThrow(ValidationError);
      expect(() => SupplierService.validateName(null)).toThrow(ValidationError);
      expect(() => SupplierService.validateName(undefined)).toThrow(ValidationError);
    });

    it('should trim and return normalized name', () => {
      const normalized = SupplierService.validateName('  Fresh Agro Foods  ');
      expect(normalized).toBe('Fresh Agro Foods');
    });
  });

  describe('GSTIN Validation', () => {
    it('should accept null or undefined as optional', () => {
      expect(SupplierService.validateGSTIN(null)).toBeNull();
      expect(SupplierService.validateGSTIN(undefined)).toBeNull();
      expect(SupplierService.validateGSTIN('')).toBeNull();
      expect(SupplierService.validateGSTIN('   ')).toBeNull();
    });

    it('should accept valid 15-digit Indian GSTIN format', () => {
      const validGstin = '27AAPFU0939F1ZV';
      const result = SupplierService.validateGSTIN(validGstin);
      expect(result).toBe('27AAPFU0939F1ZV');

      const lowerValid = '27aapfu0939f1zv';
      expect(SupplierService.validateGSTIN(lowerValid)).toBe('27AAPFU0939F1ZV');
    });

    it('should reject invalid GSTIN format', () => {
      expect(() => SupplierService.validateGSTIN('INVALID_GSTIN')).toThrow(ValidationError);
      expect(() => SupplierService.validateGSTIN('27AAPFU0939F1Z')).toThrow(ValidationError); // 14 chars
      expect(() => SupplierService.validateGSTIN('27AAPFU0939F1ZVV')).toThrow(ValidationError); // 16 chars
      expect(() => SupplierService.validateGSTIN('27AAPFU0939F11V')).toThrow(ValidationError); // missing Z
    });
  });

  describe('Email Validation', () => {
    it('should accept null or undefined as optional', () => {
      expect(SupplierService.validateEmail(null)).toBeNull();
      expect(SupplierService.validateEmail(undefined)).toBeNull();
      expect(SupplierService.validateEmail('')).toBeNull();
    });

    it('should normalize valid email to lowercase', () => {
      expect(SupplierService.validateEmail('  Supplier@Example.Com  ')).toBe('supplier@example.com');
    });

    it('should reject invalid email format', () => {
      expect(() => SupplierService.validateEmail('not-an-email')).toThrow(ValidationError);
      expect(() => SupplierService.validateEmail('user@')).toThrow(ValidationError);
    });
  });

  describe('Contact Fields Normalization & Escape Check', () => {
    it('should trim phone numbers without modifying allowed characters', () => {
      expect(SupplierService.validatePhone('  +91 9876543210  ')).toBe('+91 9876543210');
      expect(SupplierService.validatePhone(null)).toBeNull();
    });

    it('should trim optional text and NOT HTML-escape values', () => {
      const rawText = 'Flat #4, Baker Street & Co. <HQ>';
      const result = SupplierService.validateOptionalText(rawText, 'Address');
      expect(result).toBe(rawText);
      expect(result).not.toContain('&amp;');
      expect(result).not.toContain('&lt;');
    });
  });
});
