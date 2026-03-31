import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { virtualKeysRoutes } from '../../../src/admin/virtual-keys.js';
import type { VirtualKeyService } from '../../../src/virtual-keys/service.js';
import type { KeyRotationService } from '../../../src/virtual-keys/rotation.js';
import type { VirtualKey } from '../../../src/db/schema-virtual-keys.js';

// Mock services
const mockVirtualKeyService = {
  listKeys: vi.fn(),
  createKey: vi.fn(),
  updateKey: vi.fn(),
  deleteKey: vi.fn(),
  resetSpend: vi.fn(),
  persistence: {
    getKeyById: vi.fn(),
  },
};

const mockKeyRotationService = {
  rotateKey: vi.fn(),
};

// Mock getVirtualKeyService
vi.mock('../../../src/virtual-keys/service.js', () => ({
  getVirtualKeyService: () => mockVirtualKeyService,
}));

// Mock getKeyRotationService
vi.mock('../../../src/virtual-keys/rotation.js', () => ({
  getKeyRotationService: () => mockKeyRotationService,
}));

// Mock logger
vi.mock('../../../src/config/index.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
  }),
}));

// Helper to build Fastify app
async function buildApp(): Promise<FastifyInstance> {
  const { default: Fastify } = await import('fastify');
  const app = Fastify();
  await app.register(virtualKeysRoutes, { prefix: '/admin' });
  return app;
}

describe('Admin Virtual Keys Routes', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('GET /admin/virtual-keys', () => {
    it('should list all virtual keys', async () => {
      const mockKeys: VirtualKey[] = [
        {
          id: 'key-1',
          key: 'sk-test1',
          name: 'Test Key 1',
          enabled: true,
          spend: 0,
          createdAt: new Date().toISOString(),
          rotationEnabled: false,
        },
        {
          id: 'key-2',
          key: 'sk-test2',
          name: 'Test Key 2',
          enabled: true,
          spend: 100,
          createdAt: new Date().toISOString(),
          rotationEnabled: false,
        },
      ];
      mockVirtualKeyService.listKeys.mockResolvedValue(mockKeys);

      app = await buildApp();
      const response = await app.inject({
        method: 'GET',
        url: '/admin/virtual-keys',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.keys).toHaveLength(2);
      expect(mockVirtualKeyService.listKeys).toHaveBeenCalledWith(undefined);
    });

    it('should filter keys by teamId', async () => {
      mockVirtualKeyService.listKeys.mockResolvedValue([]);

      app = await buildApp();
      const response = await app.inject({
        method: 'GET',
        url: '/admin/virtual-keys?teamId=team-123',
      });

      expect(response.statusCode).toBe(200);
      expect(mockVirtualKeyService.listKeys).toHaveBeenCalledWith('team-123');
    });
  });

  describe('GET /admin/virtual-keys/:id', () => {
    it('should return a specific key by id', async () => {
      const mockKey: VirtualKey = {
        id: 'key-1',
        key: 'sk-test',
        name: 'Test Key',
        enabled: true,
        spend: 0,
        createdAt: new Date().toISOString(),
        rotationEnabled: false,
      };
      mockVirtualKeyService.persistence.getKeyById.mockResolvedValue(mockKey);

      app = await buildApp();
      const response = await app.inject({
        method: 'GET',
        url: '/admin/virtual-keys/key-1',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.key.id).toBe('key-1');
    });

    it('should return 404 for non-existent key', async () => {
      mockVirtualKeyService.persistence.getKeyById.mockResolvedValue(null);

      app = await buildApp();
      const response = await app.inject({
        method: 'GET',
        url: '/admin/virtual-keys/nonexistent',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Virtual key not found');
    });
  });

  describe('POST /admin/virtual-keys', () => {
    it('should create a new virtual key', async () => {
      const newKey: VirtualKey = {
        id: 'new-key',
        key: 'sk-new',
        name: 'New Key',
        enabled: true,
        spend: 0,
        createdAt: new Date().toISOString(),
        rotationEnabled: false,
      };
      mockVirtualKeyService.createKey.mockResolvedValue(newKey);

      app = await buildApp();
      const response = await app.inject({
        method: 'POST',
        url: '/admin/virtual-keys',
        payload: {
          name: 'New Key',
          maxBudget: 100,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.key.name).toBe('New Key');
    });

    it('should validate request body and reject invalid data', async () => {
      app = await buildApp();
      const response = await app.inject({
        method: 'POST',
        url: '/admin/virtual-keys',
        payload: {
          // Missing required name field
          maxBudget: -10, // Invalid: should be positive
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid request body');
    });

    it('should accept optional fields', async () => {
      const newKey: VirtualKey = {
        id: 'new-key',
        key: 'sk-new',
        name: 'New Key',
        enabled: true,
        spend: 0,
        createdAt: new Date().toISOString(),
        rotationEnabled: true,
        models: ['gpt-4', 'claude-3'],
      };
      mockVirtualKeyService.createKey.mockResolvedValue(newKey);

      app = await buildApp();
      const response = await app.inject({
        method: 'POST',
        url: '/admin/virtual-keys',
        payload: {
          name: 'New Key',
          models: ['gpt-4', 'claude-3'],
          rotationEnabled: true,
          rotationIntervalDays: 30,
        },
      });

      expect(response.statusCode).toBe(201);
    });
  });

  describe('PUT /admin/virtual-keys/:id', () => {
    it('should update an existing virtual key', async () => {
      const updatedKey: VirtualKey = {
        id: 'key-1',
        key: 'sk-test',
        name: 'Updated Name',
        enabled: true,
        spend: 0,
        createdAt: new Date().toISOString(),
        rotationEnabled: false,
      };
      mockVirtualKeyService.updateKey.mockResolvedValue(updatedKey);

      app = await buildApp();
      const response = await app.inject({
        method: 'PUT',
        url: '/admin/virtual-keys/key-1',
        payload: {
          name: 'Updated Name',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.key.name).toBe('Updated Name');
    });

    it('should return 404 when updating non-existent key', async () => {
      mockVirtualKeyService.updateKey.mockResolvedValue(null);

      app = await buildApp();
      const response = await app.inject({
        method: 'PUT',
        url: '/admin/virtual-keys/nonexistent',
        payload: {
          name: 'Updated',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should validate update payload', async () => {
      app = await buildApp();
      const response = await app.inject({
        method: 'PUT',
        url: '/admin/virtual-keys/key-1',
        payload: {
          rpmLimit: -5, // Invalid: should be positive
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('DELETE /admin/virtual-keys/:id', () => {
    it('should delete a virtual key', async () => {
      mockVirtualKeyService.deleteKey.mockResolvedValue(true);

      app = await buildApp();
      const response = await app.inject({
        method: 'DELETE',
        url: '/admin/virtual-keys/key-1',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should return 404 when deleting non-existent key', async () => {
      mockVirtualKeyService.deleteKey.mockResolvedValue(false);

      app = await buildApp();
      const response = await app.inject({
        method: 'DELETE',
        url: '/admin/virtual-keys/nonexistent',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /admin/virtual-keys/:id/rotate', () => {
    it('should rotate a key and return old and new keys', async () => {
      const oldKey: VirtualKey = {
        id: 'old-key',
        key: 'sk-old',
        name: 'Old Key',
        enabled: false,
        spend: 100,
        createdAt: new Date().toISOString(),
        rotationEnabled: false,
      };
      const newKey: VirtualKey = {
        id: 'new-key',
        key: 'sk-new',
        name: 'Rotated Key',
        enabled: true,
        spend: 0,
        createdAt: new Date().toISOString(),
        rotationEnabled: false,
      };
      mockKeyRotationService.rotateKey.mockResolvedValue({ oldKey, newKey });

      app = await buildApp();
      const response = await app.inject({
        method: 'POST',
        url: '/admin/virtual-keys/old-key/rotate',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.newKey.id).toBe('new-key');
      expect(body.oldKey.id).toBe('old-key');
    });

    it('should return 404 when rotating non-existent key', async () => {
      mockKeyRotationService.rotateKey.mockRejectedValue(new Error('Key not found'));

      app = await buildApp();
      const response = await app.inject({
        method: 'POST',
        url: '/admin/virtual-keys/nonexistent/rotate',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /admin/virtual-keys/:id/reset-spend', () => {
    it('should reset spend counter for a key', async () => {
      const resetKey: VirtualKey = {
        id: 'key-1',
        key: 'sk-test',
        name: 'Test Key',
        enabled: true,
        spend: 0, // Reset to 0
        createdAt: new Date().toISOString(),
        rotationEnabled: false,
      };
      mockVirtualKeyService.resetSpend.mockResolvedValue(undefined);
      mockVirtualKeyService.persistence.getKeyById.mockResolvedValue(resetKey);

      app = await buildApp();
      const response = await app.inject({
        method: 'POST',
        url: '/admin/virtual-keys/key-1/reset-spend',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.key.spend).toBe(0);
      expect(mockVirtualKeyService.resetSpend).toHaveBeenCalledWith('key-1');
    });

    it('should return 404 for non-existent key on reset-spend', async () => {
      mockVirtualKeyService.resetSpend.mockResolvedValue(undefined);
      mockVirtualKeyService.persistence.getKeyById.mockResolvedValue(null);

      app = await buildApp();
      const response = await app.inject({
        method: 'POST',
        url: '/admin/virtual-keys/nonexistent/reset-spend',
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
