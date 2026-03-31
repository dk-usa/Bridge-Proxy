import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  KeyRotationService,
  DEFAULT_GRACE_PERIOD_HOURS,
} from '../../../src/virtual-keys/rotation.js';
import type { VirtualKey } from '../../../src/db/schema-virtual-keys.js';

describe('KeyRotationService', () => {
  let rotationService: KeyRotationService;

  // Mock VirtualKeyService
  const mockVirtualKeyService = {
    getKeyById: vi.fn(),
    createKey: vi.fn(),
    updateKey: vi.fn(),
    listKeys: vi.fn(),
  };

  // Mock persistence
  const mockPersistence = {
    getKeyById: vi.fn(),
    updateKey: vi.fn(),
    listKeys: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create rotation service with mocked dependencies
    rotationService = new KeyRotationService(
      mockVirtualKeyService as never,
      mockPersistence as never
    );
  });

  describe('rotateKey', () => {
    it('should create new key and mark old for grace period', async () => {
      const oldKey: VirtualKey = {
        id: 'key-old',
        key: 'sk-old-key',
        name: 'Test Key',
        spend: 10,
        enabled: true,
        createdAt: new Date().toISOString(),
        rotationEnabled: true,
      };

      const newKey: VirtualKey = {
        id: 'key-new',
        key: 'sk-new-key',
        name: 'Test Key',
        spend: 0,
        enabled: true,
        createdAt: new Date().toISOString(),
        rotationEnabled: true,
        rotatedFrom: 'key-old',
      };

      mockVirtualKeyService.createKey.mockResolvedValue(newKey);
      mockPersistence.getKeyById.mockResolvedValueOnce(oldKey);
      mockPersistence.updateKey.mockResolvedValue({
        ...oldKey,
        rotatedTo: 'key-new',
        expiresAt: new Date(Date.now() + DEFAULT_GRACE_PERIOD_HOURS * 60 * 60 * 1000).toISOString(),
      });

      const result = await rotationService.rotateKey('key-old');

      expect(result.newKey.key).toBe('sk-new-key');
      expect(result.newKey.rotatedFrom).toBe('key-old');
      expect(result.oldKey.rotatedTo).toBe('key-new');
      expect(result.oldKey.expiresAt).toBeDefined();

      // Verify createKey was called with same settings
      expect(mockVirtualKeyService.createKey).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Key',
        })
      );
    });

    it('should throw error if key not found', async () => {
      mockPersistence.getKeyById.mockResolvedValue(null);

      await expect(rotationService.rotateKey('nonexistent')).rejects.toThrow('Key not found');
    });

    it('should preserve key settings on rotation', async () => {
      const oldKey: VirtualKey = {
        id: 'key-old',
        key: 'sk-old-key',
        name: 'Preserved Key',
        teamId: 'team-1',
        orgId: 'org-1',
        models: ['gpt-4', 'claude-3'],
        maxBudget: 100,
        budgetDuration: '30d',
        rpmLimit: 1000,
        tpmLimit: 100000,
        spend: 50,
        enabled: true,
        createdAt: new Date().toISOString(),
        rotationEnabled: true,
      };

      const newKey: VirtualKey = {
        id: 'key-new',
        key: 'sk-new-key',
        name: 'Preserved Key',
        teamId: 'team-1',
        orgId: 'org-1',
        models: ['gpt-4', 'claude-3'],
        maxBudget: 100,
        budgetDuration: '30d',
        rpmLimit: 1000,
        tpmLimit: 100000,
        spend: 0,
        enabled: true,
        createdAt: new Date().toISOString(),
        rotationEnabled: true,
        rotatedFrom: 'key-old',
      };

      mockPersistence.getKeyById.mockResolvedValue(oldKey);
      mockVirtualKeyService.createKey.mockResolvedValue(newKey);
      mockPersistence.updateKey.mockResolvedValue(oldKey);

      const result = await rotationService.rotateKey('key-old');

      // Verify all settings were preserved
      expect(mockVirtualKeyService.createKey).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Preserved Key',
          teamId: 'team-1',
          orgId: 'org-1',
          models: ['gpt-4', 'claude-3'],
          maxBudget: 100,
          budgetDuration: '30d',
          rpmLimit: 1000,
          tpmLimit: 100000,
        })
      );
    });
  });

  describe('getActiveKeys', () => {
    it('should return both old and new keys during grace period', async () => {
      const oldKey: VirtualKey = {
        id: 'key-old',
        key: 'sk-old-key',
        name: 'Test Key',
        spend: 10,
        enabled: true,
        createdAt: new Date().toISOString(),
        rotationEnabled: true,
        rotatedTo: 'key-new',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
      };

      const newKey: VirtualKey = {
        id: 'key-new',
        key: 'sk-new-key',
        name: 'Test Key',
        spend: 0,
        enabled: true,
        createdAt: new Date().toISOString(),
        rotationEnabled: true,
        rotatedFrom: 'key-old',
      };

      mockPersistence.getKeyById.mockImplementation(async (id: string) => {
        if (id === 'key-old') return oldKey;
        if (id === 'key-new') return newKey;
        return null;
      });

      const result = await rotationService.getActiveKeys('key-new');

      expect(result).toHaveLength(2);
      expect(result.map((k) => k.id)).toContain('key-old');
      expect(result.map((k) => k.id)).toContain('key-new');
    });

    it('should return only current key after grace period', async () => {
      const newKey: VirtualKey = {
        id: 'key-new',
        key: 'sk-new-key',
        name: 'Test Key',
        spend: 0,
        enabled: true,
        createdAt: new Date().toISOString(),
        rotationEnabled: true,
        rotatedFrom: 'key-old',
      };

      mockPersistence.getKeyById.mockResolvedValue(newKey);

      const result = await rotationService.getActiveKeys('key-new');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('key-new');
    });
  });

  describe('disableExpiredKeys', () => {
    it('should disable old keys after grace period', async () => {
      const expiredKey: VirtualKey = {
        id: 'key-expired',
        key: 'sk-expired-key',
        name: 'Expired Key',
        spend: 10,
        enabled: true,
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        rotationEnabled: true,
        rotatedTo: 'key-new',
        expiresAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
      };

      mockPersistence.listKeys.mockResolvedValue([expiredKey]);
      mockPersistence.updateKey.mockResolvedValue({ ...expiredKey, enabled: false });

      await rotationService.disableExpiredKeys();

      expect(mockPersistence.updateKey).toHaveBeenCalledWith('key-expired', { enabled: false });
    });

    it('should not disable keys still in grace period', async () => {
      const activeKey: VirtualKey = {
        id: 'key-active',
        key: 'sk-active-key',
        name: 'Active Key',
        spend: 10,
        enabled: true,
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        rotationEnabled: true,
        rotatedTo: 'key-new',
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), // 12 hours from now
      };

      mockPersistence.listKeys.mockResolvedValue([activeKey]);

      await rotationService.disableExpiredKeys();

      expect(mockPersistence.updateKey).not.toHaveBeenCalled();
    });
  });
});
