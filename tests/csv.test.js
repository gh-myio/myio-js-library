import { describe, it, expect } from 'vitest';
import { exportToCSV, exportToCSVAll } from '../src/index.ts';

describe('CSV utilities', () => {
  describe('exportToCSV', () => {
    it('should export data to CSV format', () => {
      const data = [
        { name: 'John', age: 30, city: 'New York' },
        { name: 'Jane', age: 25, city: 'Los Angeles' }
      ];
      const headers = ['name', 'age', 'city'];
      
      const result = exportToCSV(data, headers);
      const expected = 'name,age,city\nJohn,30,New York\nJane,25,Los Angeles';
      
      expect(result).toBe(expected);
    });

    it('should handle values with commas by wrapping in quotes', () => {
      const data = [
        { name: 'John, Jr.', description: 'A person with, comma in name' }
      ];
      const headers = ['name', 'description'];
      
      const result = exportToCSV(data, headers);
      const expected = 'name,description\n"John, Jr.","A person with, comma in name"';
      
      expect(result).toBe(expected);
    });

    it('should handle values with quotes by escaping them', () => {
      const data = [
        { quote: 'He said "Hello"' }
      ];
      const headers = ['quote'];
      
      const result = exportToCSV(data, headers);
      const expected = 'quote\n"He said ""Hello"""';
      
      expect(result).toBe(expected);
    });

    it('should handle null and undefined values', () => {
      const data = [
        { name: 'John', age: null, city: undefined }
      ];
      const headers = ['name', 'age', 'city'];
      
      const result = exportToCSV(data, headers);
      const expected = 'name,age,city\nJohn,,';
      
      expect(result).toBe(expected);
    });

    it('should return empty string for empty data', () => {
      const result = exportToCSV([], ['name', 'age']);
      expect(result).toBe('');
    });
  });

  describe('exportToCSVAll', () => {
    it('should export data for multiple stores', () => {
      const storesData = {
        'Store A': [
          { product: 'Apple', price: 1.50 },
          { product: 'Banana', price: 0.75 }
        ],
        'Store B': [
          { product: 'Orange', price: 2.00 }
        ]
      };
      const headers = ['product', 'price'];
      
      const result = exportToCSVAll(storesData, headers);
      const expected = 'Store,product,price\nStore A,Apple,1.5\nStore A,Banana,0.75\nStore B,Orange,2';
      
      expect(result).toBe(expected);
    });

    it('should handle stores with no data', () => {
      const storesData = {
        'Store A': [
          { product: 'Apple', price: 1.50 }
        ],
        'Store B': []
      };
      const headers = ['product', 'price'];
      
      const result = exportToCSVAll(storesData, headers);
      const expected = 'Store,product,price\nStore A,Apple,1.5';
      
      expect(result).toBe(expected);
    });

    it('should return empty string for empty stores data', () => {
      const result = exportToCSVAll({}, ['product', 'price']);
      expect(result).toBe('');
    });

    it('should handle store names with special characters', () => {
      const storesData = {
        'Store "A"': [
          { product: 'Apple', price: 1.50 }
        ]
      };
      const headers = ['product', 'price'];
      
      const result = exportToCSVAll(storesData, headers);
      const expected = 'Store,product,price\n"Store ""A""",Apple,1.5';
      
      expect(result).toBe(expected);
    });
  });
});
