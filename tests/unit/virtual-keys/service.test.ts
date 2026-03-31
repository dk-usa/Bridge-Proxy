import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VirtualKeyService } from '../../../src/virtual-keys/service.js';
import type { VirtualKeyPersistence } from '../../../src/virtual-keys/persistence.js';
import type { VirtualKey } from '../../../src/db/schema-virtual-keys.js';

describe('VirtualKeyService', () => {
  let service: VirtualKeyService;
  let mockPersistence: {
    createKey: ReturnType<typeof vi.fn>;
    getKeyById: ReturnType<typeof vi.fn>;
    getKeyByValue: ReturnType<typeof vi.fn>;
    updateKey: ReturnType<typeof vi.fn>;
    deleteKey: ReturnType<typeof vi.fn>;
    listKeys: ReturnType<typeof vi.fn>;
    recordUsage: ReturnType<typeof vi.fn>;
    resetSpend: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockPersistence = {
      createKey: vi.fn(),
      getKeyById: vi.fn(),
      getKeyByValue: vi.fn(),
      updateKey: vi.fn(),
      deleteKey: vi.fn(),
      listKeys: vi.fn(),
      recordUsage: vi.fn(),
      resetSpend: vi.fn(),
    };
    service = new VirtualKeyService(mockPersistence as unknown as VirtualKeyPersistence);
  });

  describe('validateKey', () => {
    it('should return key for valid sk-{random} key', async () => {
      const validKey: VirtualKey = {
        id: 'test-id',
        key: 'sk-valid123',
        name: 'Test Key',
        enabled: true,
        spend: 0,
        createdAt: new Date().toISOString(),
        rotationEnabled: false,
      };
      mockPersistence.getKeyByValue.mockResolvedValue(validKey);

      const result = await service.validateKey('sk-valid123');

      expect(result).toEqual(validKey);
      expect(mockPersistence.getKeyByValue).toHaveBeenCalledWith('sk-valid123');
    });

    it('should return null for disabled key', async () => {
      const disabledKey: VirtualKey = {
        id: 'test-id',
        key: 'sk-disabled',
        name: 'Disabled Key',
        enabled: false,
        spend: 0,
        createdAt: new Date().toISOString(),
        rotationEnabled: false,
      };
      mockPersistence.getKeyByValue.mockResolvedValue(disabledKey);

      const result = await service.validateKey('sk-disabled');

      expect(result).toBeNull();
    });

    it('should return null for expired key', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const expiredKey: VirtualKey = {
        id: 'test-id',
        key: 'sk-expired',
        name: 'Expired Key',
        enabled: true,
        spend: 0,
        createdAt: new Date().toISOString(),
        expiresAt: pastDate.toISOString(),
        rotationEnabled: false,
      };
      mockPersistence.getKeyByValue.mockResolvedValue(expiredKey);

      const result = await service.validateKey('sk-expired');

      expect(result).toBeNull();
    });

    it('should return null when budget exceeded', async () => {
      const exceededKey: VirtualKey = {
        id: 'test-id',
        key: 'sk-exceeded',
        name: 'Exceeded Key',
        enabled: true,
        maxBudget: 10,
        spend: 12,
        createdAt: new Date().toISOString(),
        rotationEnabled: false,
      };
      mockPersistence.getKeyByValue.mockResolvedValue(exceededKey);

      const result = await service.validateKey('sk-exceeded');

      expect(result).toBeNull();
    });

    it('should return null for key not starting with sk-', async () => {
      const result = await service.validateKey('invalid-key');

      expect(result).toBeNull();
      expect(mockPersistence.getKeyByValue).not.toHaveBeenCalled();
    });

    it('should return null for non-existent key', async () => {
      mockPersistence.getKeyByValue.mockResolvedValue(null);

      const result = await service.validateKey('sk-nonexistent');

      expect(result).toBeNull();
    });

    it('should allow key with budget not yet exceeded', async () => {
      const validKey: VirtualKey = {
        id: 'test-id',
        key: 'sk-valid',
        name: 'Valid Key',
        enabled: true,
        maxBudget: 10,
        spend: 9.99,
        createdAt: new Date().toISOString(),
        rotationEnabled: false,
      };
      mockPersistence.getKeyByValue.mockResolvedValue(validKey);

      const result = await service.validateKey('sk-valid');

      expect(result).toEqual(validKey);
    });
  });

  describe('checkBudget', () => {
    it('should return allowed: false when spend + cost > maxBudget', async () => {
      const key: VirtualKey = {
        id: 'test-id',
        key: 'sk-test',
        name: 'Test Key',
        enabled: true,
        maxBudget: 10,
        spend: 9.5,
        createdAt: new Date().toISOString(),
        rotationEnabled: false,
      };
      mockPersistence.getKeyById.mockResolvedValue(key);

      const result = await service.checkBudget('test-id', 1);

      expect(result.allowed).toBe(false);
      expect(result.currentSpend).toBe(9.5);
      expect(result.limit).toBe(10);
    });

    it('should return allowed: true when spend + cost <= maxBudget', async () => {
      const key: VirtualKey = {
        id: 'test-id',
        key: 'sk-test',
        name: 'Test Key',
        enabled: true,
        maxBudget: 10,
        spend: 8,
        createdAt: new Date().toISOString(),
        rotationEnabled: false,
      };
      mockPersistence.getKeyById.mockResolvedValue(key);

      const result = await service.checkBudget('test-id', 1);

      expect(result.allowed).toBe(true);
      expect(result.currentSpend).toBe(8);
      expect(result.limit).toBe(10);
    });

    it('should return allowed: true when no budget set (unlimited)', async () => {
      const key: VirtualKey = {
        id: 'test-id',
        key: 'sk-test',
        name: 'Test Key',
        enabled: true,
        spend: 100,
        createdAt: new Date().toISOString(),
        rotationEnabled: false,
      };
      mockPersistence.getKeyById.mockResolvedValue(key);

      const result = await service.checkBudget('test-id', 50);

      expect(result.allowed).toBe(true);
      expect(result.currentSpend).toBe(100);
      expect(result.limit).toBeUndefined();
    });

    it('should return allowed: false when key not found', async () => {
      mockPersistence.getKeyById.mockResolvedValue(null);

      const result = await service.checkBudget('nonexistent', 1);

      expect(result.allowed).toBe(false);
    });
  });

  describe('recordUsage', () => {
    it('should increment spend and call persistence', async () => {
      await service.recordUsage('test-id', 0.05);

      expect(mockPersistence.recordUsage).toHaveBeenCalledWith('test-id', 0.05);
    });
  });

  describe('createKey', () => {
    it('should delegate to persistence', async () => {
      const newKey: VirtualKey = {
        id: 'new-id',
        key: 'sk-new',
        name: 'New Key',
        enabled: true,
        spend: 0,
        createdAt: new Date().toISOString(),
        rotationEnabled: false,
      };
      mockPersistence.createKey.mockResolvedValue(newKey);

      const result = await service.createKey({ name: 'New Key' });

      expect(result).toEqual(newKey);
      expect(mockPersistence.createKey).toHaveBeenCalledWith({ name: 'New Key' });
    });
  });

  describe('updateKey', () => {
    it('should delegate to persistence', async () => {
      const updatedKey: VirtualKey = {
        id: 'test-id',
        key: 'sk-test',
        name: 'Updated Name',
        enabled: true,
        spend: 0,
        createdAt: new Date().toISOString(),
        rotationEnabled: false,
      };
      mockPersistence.updateKey.mockResolvedValue(updatedKey);

      const result = await service.updateKey('test-id', { name: 'Updated Name' });

      expect(result).toEqual(updatedKey);
    });
  });

  describe('deleteKey', () => {
    it('should delegate to persistence', async () => {
      mockPersistence.deleteKey.mockResolvedValue(true);

      const result = await service.deleteKey('test-id');

      expect(result).toBe(true);
    });
  });

  describe('listKeys', () => {
    it('should delegate to persistence', async () => {
      const keys: VirtualKey[] = [
        {
          id: 'key-1',
          key: 'sk-key1',
          name: 'Key 1',
          enabled: true,
          spend: 0,
          createdAt: new Date().toISOString(),
          rotationEnabled: false,
        },
      ];
      mockPersistence.listKeys.mockResolvedValue(keys);

      const result = await service.listKeys('team-1');

      expect(result).toEqual(keys);
      expect(mockPersistence.listKeys).toHaveBeenCalledWith('team-1');
    });
  });

  describe('resetSpend', () => {
    it('should delegate to persistence', async () => {
      await service.resetSpend('test-id');

      expect(mockPersistence.resetSpend).toHaveBeenCalledWith('test-id');
    });
  });
});
