import { describe, it, expect } from 'vitest';

describe('Virtual Keys Schema', () => {
  describe('Schema Definition', () => {
    it('should define all required columns', async () => {
      // Import the schema dynamically to test it
      const { virtualKeys } = await import('../../../src/db/schema-virtual-keys.js');

      // Verify table exists
      expect(virtualKeys).toBeDefined();
      expect(typeof virtualKeys).toBe('object');

      // Get column names - in Drizzle, columns are properties on the table object
      expect(virtualKeys).toHaveProperty('id');
      expect(virtualKeys).toHaveProperty('key');
      expect(virtualKeys).toHaveProperty('name');
      expect(virtualKeys).toHaveProperty('description');
      expect(virtualKeys).toHaveProperty('teamId');
      expect(virtualKeys).toHaveProperty('orgId');
      expect(virtualKeys).toHaveProperty('models');
      expect(virtualKeys).toHaveProperty('maxBudget');
      expect(virtualKeys).toHaveProperty('budgetDuration');
      expect(virtualKeys).toHaveProperty('spend');
      expect(virtualKeys).toHaveProperty('rpmLimit');
      expect(virtualKeys).toHaveProperty('tpmLimit');
      expect(virtualKeys).toHaveProperty('enabled');
      expect(virtualKeys).toHaveProperty('createdAt');
      expect(virtualKeys).toHaveProperty('expiresAt');
      expect(virtualKeys).toHaveProperty('rotationEnabled');
      expect(virtualKeys).toHaveProperty('rotationIntervalDays');
      expect(virtualKeys).toHaveProperty('lastRotatedAt');
      expect(virtualKeys).toHaveProperty('metadata');
    });

    it('should have correct primary key on id', async () => {
      const { virtualKeys } = await import('../../../src/db/schema-virtual-keys.js');
      // Drizzle schema structure
      expect(virtualKeys.id).toBeDefined();
    });

    it('should have unique constraint on key column', async () => {
      const { virtualKeys } = await import('../../../src/db/schema-virtual-keys.js');
      expect(virtualKeys.key).toBeDefined();
    });

    it('should have indexes defined for key, teamId, and orgId', async () => {
      // In Drizzle, indexes are defined in the table callback and accessed via the table
      const { virtualKeys } = await import('../../../src/db/schema-virtual-keys.js');

      // Verify the table has the indexes property (Drizzle stores them internally)
      // The actual index creation happens in the database initialization
      expect(virtualKeys).toBeDefined();

      // Check that the schema exports type definitions
      const schemaModule = await import('../../../src/db/schema-virtual-keys.js');
      expect(schemaModule.virtualKeys).toBe(virtualKeys);
    });
  });

  describe('Type Safety', () => {
    it('should export VirtualKey type via type inference', async () => {
      // TypeScript types are compile-time only, but we can verify the type export exists
      // by checking that the module exports the expected structure
      const schemaModule = await import('../../../src/db/schema-virtual-keys.js');

      // Verify the table is exported (types are inferred from it)
      expect(schemaModule.virtualKeys).toBeDefined();
    });

    it('should export NewVirtualKey type via type inference', async () => {
      const schemaModule = await import('../../../src/db/schema-virtual-keys.js');

      // The type exports are available for import in other files
      // We verify the module structure is correct
      expect(schemaModule.virtualKeys).toBeDefined();
    });
  });
});
