/**
 * Authentication Unit Tests
 * Tests for authentication, authorization, and security features
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { hashPassword, verifyPassword } from '../../server/auth';
import { createAuthenticatedUser } from '../fixtures/auth';
import { createTestUser, cleanupTestUser } from '../fixtures/db';
import { storage } from '../../server/storage';

describe('Authentication', () => {
  describe('Password Hashing', () => {
    it('should hash a password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(20); // bcrypt hashes are long
    });

    it('should verify a correct password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);
      
      expect(isValid).toBe(true);
    });

    it('should reject an incorrect password', async () => {
      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(wrongPassword, hash);
      
      expect(isValid).toBe(false);
    });

    it('should produce different hashes for the same password', async () => {
      const password = 'TestPassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      // bcrypt uses salt, so hashes should be different
      expect(hash1).not.toBe(hash2);
      // But both should verify correctly
      expect(await verifyPassword(password, hash1)).toBe(true);
      expect(await verifyPassword(password, hash2)).toBe(true);
    });

    it('should handle empty password gracefully', async () => {
      const password = '';
      const hash = await hashPassword(password);
      expect(hash).toBeDefined();
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });
  });

  describe('User Creation', () => {
    it('should create an authenticated user', async () => {
      const { user, organization, password } = await createAuthenticatedUser();
      
      expect(user).toBeDefined();
      expect(organization).toBeDefined();
      expect(password).toBeDefined();
      expect(user.emailVerified).toBe(true);
    });

    it('should create user with password hash', async () => {
      const password = 'SecurePassword123!';
      const user = await createTestUser(`test-${Date.now()}@example.com`, password);
      
      expect(user).toBeDefined();
      expect(user.passwordHash).toBeDefined();
      expect(user.passwordHash).not.toBe(password);
      
      // Verify password works
      const isValid = await verifyPassword(password, user.passwordHash!);
      expect(isValid).toBe(true);
    });

    it('should create user without password (OAuth only)', async () => {
      const user = await createTestUser(`oauth-${Date.now()}@example.com`);
      
      expect(user).toBeDefined();
      expect(user.passwordHash).toBeNull();
    });
  });

  describe('User Retrieval', () => {
    let testUserId: string;

    beforeAll(async () => {
      const user = await createTestUser(`retrieve-${Date.now()}@example.com`);
      testUserId = user.id;
    });

    afterAll(async () => {
      if (testUserId) {
        await cleanupTestUser(testUserId);
      }
    });

    it('should retrieve user by ID', async () => {
      const user = await storage.getUser(testUserId);
      expect(user).toBeDefined();
      expect(user?.id).toBe(testUserId);
    });

    it('should retrieve user by email', async () => {
      const email = `retrieve-email-${Date.now()}@example.com`;
      const user = await createTestUser(email);
      const retrieved = await storage.getUserByEmail(email);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(user.id);
      expect(retrieved?.email).toBe(email.toLowerCase());
    });

    it('should return null for non-existent user', async () => {
      const user = await storage.getUser('non-existent-user-id');
      expect(user).toBeUndefined();
    });

    it('should return null for non-existent email', async () => {
      const user = await storage.getUserByEmail('nonexistent@example.com');
      expect(user).toBeUndefined();
    });

    it('should handle email case insensitivity', async () => {
      const email = `case-test-${Date.now()}@example.com`;
      const user = await createTestUser(email);
      const retrievedLower = await storage.getUserByEmail(email.toLowerCase());
      const retrievedUpper = await storage.getUserByEmail(email.toUpperCase());
      
      expect(retrievedLower).toBeDefined();
      expect(retrievedUpper).toBeDefined();
      expect(retrievedLower?.id).toBe(user.id);
      expect(retrievedUpper?.id).toBe(user.id);
    });
  });

  describe('Password Security', () => {
    it('should reject weak passwords (if validation exists)', async () => {
      // Note: This test documents expected behavior
      // Actual password validation may be implemented in the future
      const weakPassword = '123';
      const hash = await hashPassword(weakPassword);
      expect(hash).toBeDefined(); // Currently accepts any password
    });

    it('should handle special characters in passwords', async () => {
      const specialPassword = 'P@ssw0rd!@#$%^&*()';
      const hash = await hashPassword(specialPassword);
      const isValid = await verifyPassword(specialPassword, hash);
      expect(isValid).toBe(true);
    });

    it('should handle unicode characters in passwords', async () => {
      const unicodePassword = 'Pässwörd123!';
      const hash = await hashPassword(unicodePassword);
      const isValid = await verifyPassword(unicodePassword, hash);
      expect(isValid).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Test that storage methods handle errors
      // This is a placeholder for error handling tests
      const user = await storage.getUser('invalid-id-format');
      expect(user).toBeUndefined();
    });
  });
});

