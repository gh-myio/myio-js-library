/**
 * Unit tests for buildListItemsThingsboardByUniqueDatasource utility
 */

import { buildListItemsThingsboardByUniqueDatasource } from '../src/thingsboard/utils/buildListItemsThingsboardByUniqueDatasource.js';

describe('buildListItemsThingsboardByUniqueDatasource', () => {
  test('should return empty array for empty inputs', () => {
    const result = buildListItemsThingsboardByUniqueDatasource([], []);
    expect(result).toEqual([]);
  });

  test('should handle null/undefined inputs gracefully', () => {
    const result = buildListItemsThingsboardByUniqueDatasource(null, undefined);
    expect(result).toEqual([]);
  });

  test('should build items from datasources only', () => {
    const datasources = [
      {
        entityId: 'entity1',
        entity: { label: 'Store 1', name: 'Store One' },
        dataKeys: [{ name: 'identifier' }, { name: 'label' }]
      },
      {
        entityId: 'entity2',
        entity: { label: 'Store 2' },
        dataKeys: [{ name: 'ingestionId' }]
      }
    ];

    const result = buildListItemsThingsboardByUniqueDatasource(datasources, []);
    
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 'entity1',
      identifier: 'Store 1',
      label: 'Store 1'
    });
    expect(result[1]).toEqual({
      id: 'entity2',
      identifier: 'Store 2',
      label: 'Store 2'
    });
  });

  test('should hydrate entities with data', () => {
    const datasources = [
      {
        entityId: 'entity1',
        entity: { label: 'Store 1' },
        dataKeys: [{ name: 'identifier' }, { name: 'ingestionId' }]
      }
    ];

    const data = [
      {
        datasource: { entityId: 'entity1' },
        dataKey: { name: 'identifier' },
        data: [['timestamp', 'STORE001']]
      },
      {
        datasource: { entityId: 'entity1' },
        dataKey: { name: 'ingestionId' },
        data: [['timestamp', 'ING123']]
      }
    ];

    const result = buildListItemsThingsboardByUniqueDatasource(datasources, data);
    
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'ING123',
      identifier: 'STORE001',
      label: 'Store 1'
    });
  });

  test('should normalize attribute keys correctly', () => {
    const datasources = [
      {
        entityId: 'entity1',
        entity: { label: 'Store 1' },
        dataKeys: [{ name: 'INGESTIONID' }, { name: 'IDENTIFIER' }]
      }
    ];

    const data = [
      {
        datasource: { entityId: 'entity1' },
        dataKey: { name: 'INGESTIONID' },
        data: [['timestamp', 'ING123']]
      },
      {
        datasource: { entityId: 'entity1' },
        dataKey: { name: 'IDENTIFIER' },
        data: [['timestamp', 'STORE001']]
      }
    ];

    const result = buildListItemsThingsboardByUniqueDatasource(datasources, data);
    
    expect(result[0]).toEqual({
      id: 'ING123',
      identifier: 'STORE001',
      label: 'Store 1'
    });
  });

  test('should sort results by label in Portuguese locale', () => {
    const datasources = [
      {
        entityId: 'entity1',
        entity: { label: 'Zebra Store' },
        dataKeys: []
      },
      {
        entityId: 'entity2',
        entity: { label: 'Alpha Store' },
        dataKeys: []
      },
      {
        entityId: 'entity3',
        entity: { label: 'Beta Store' },
        dataKeys: []
      }
    ];

    const result = buildListItemsThingsboardByUniqueDatasource(datasources, []);
    
    expect(result.map(item => item.label)).toEqual([
      'Alpha Store',
      'Beta Store', 
      'Zebra Store'
    ]);
  });

  test('should handle missing entity data gracefully', () => {
    const datasources = [
      {
        entityId: 'entity1',
        // No entity property
        dataKeys: []
      }
    ];

    const result = buildListItemsThingsboardByUniqueDatasource(datasources, []);
    
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'entity1',
      identifier: '',
      label: ''
    });
  });

  test('should use fallback values for identifier and label', () => {
    const datasources = [
      {
        entityId: 'entity1',
        entity: { name: 'Fallback Name' },
        dataKeys: []
      }
    ];

    const result = buildListItemsThingsboardByUniqueDatasource(datasources, []);
    
    expect(result[0]).toEqual({
      id: 'entity1',
      identifier: 'Fallback Name',
      label: 'Fallback Name'
    });
  });

  test('should ignore data for non-existent entities', () => {
    const datasources = [
      {
        entityId: 'entity1',
        entity: { label: 'Store 1' },
        dataKeys: [{ name: 'identifier' }]
      }
    ];

    const data = [
      {
        datasource: { entityId: 'entity1' },
        dataKey: { name: 'identifier' },
        data: [['timestamp', 'STORE001']]
      },
      {
        datasource: { entityId: 'nonexistent' },
        dataKey: { name: 'identifier' },
        data: [['timestamp', 'IGNORED']]
      }
    ];

    const result = buildListItemsThingsboardByUniqueDatasource(datasources, data);
    
    expect(result).toHaveLength(1);
    expect(result[0].identifier).toBe('STORE001');
  });

  test('should handle malformed data gracefully', () => {
    const datasources = [
      {
        entityId: 'entity1',
        entity: { label: 'Store 1' },
        dataKeys: [{ name: 'identifier' }]
      }
    ];

    const data = [
      {
        datasource: { entityId: 'entity1' },
        dataKey: { name: 'identifier' },
        data: [] // Empty data array
      },
      {
        datasource: { entityId: 'entity1' },
        dataKey: { name: 'label' },
        data: [['timestamp']] // Missing value
      },
      {
        datasource: { entityId: 'entity1' },
        dataKey: { name: 'other' },
        data: [['timestamp', null]] // Null value
      }
    ];

    const result = buildListItemsThingsboardByUniqueDatasource(datasources, data);
    
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'entity1',
      identifier: 'Store 1',
      label: 'Store 1'
    });
  });
});
