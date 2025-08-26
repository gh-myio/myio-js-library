import { describe, it, expect } from 'vitest';
import { decodePayload } from '../src/codec/decodePayload.js';

describe('decodePayload', () => {
  it('should decode a simple base64 XOR encoded payload', () => {
    // Test data: "hello" XOR with key "key"
    const encoded = 'BgcMCwY='; // Base64 encoded XOR result
    const key = 'key';
    const expected = 'hello';
    
    const result = decodePayload(encoded, key);
    expect(result).toBe(expected);
  });

  it('should handle empty payload', () => {
    const encoded = '';
    const key = 'key';
    
    const result = decodePayload(encoded, key);
    expect(result).toBe('');
  });

  it('should handle empty key', () => {
    const encoded = 'aGVsbG8='; // Base64 "hello"
    const key = '';
    
    const result = decodePayload(encoded, key);
    expect(result).toBe('hello'); // No XOR applied with empty key
  });

  it('should handle key longer than payload', () => {
    const encoded = 'BgcMCwY='; // "hello" XOR "key"
    const key = 'verylongkey';
    
    const result = decodePayload(encoded, key);
    expect(result).toBe('hello');
  });

  it('should handle key shorter than payload', () => {
    // Test with longer message that requires key repetition
    const message = 'this is a longer message';
    const key = 'abc';
    
    // Manually encode for test
    const encoder = new TextEncoder();
    const messageBytes = encoder.encode(message);
    const keyBytes = encoder.encode(key);
    const xorBytes = new Uint8Array(messageBytes.length);
    
    for (let i = 0; i < messageBytes.length; i++) {
      xorBytes[i] = messageBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    
    const encoded = btoa(String.fromCharCode(...xorBytes));
    
    const result = decodePayload(encoded, key);
    expect(result).toBe(message);
  });

  it('should handle special characters', () => {
    const message = 'Hello, 世界! 🌍';
    const key = 'test';
    
    // Manually encode for test
    const encoder = new TextEncoder();
    const messageBytes = encoder.encode(message);
    const keyBytes = encoder.encode(key);
    const xorBytes = new Uint8Array(messageBytes.length);
    
    for (let i = 0; i < messageBytes.length; i++) {
      xorBytes[i] = messageBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    
    const encoded = btoa(String.fromCharCode(...xorBytes));
    
    const result = decodePayload(encoded, key);
    expect(result).toBe(message);
  });

  it('should throw error for invalid base64', () => {
    const invalidEncoded = 'invalid-base64!@#';
    const key = 'key';
    
    expect(() => decodePayload(invalidEncoded, key)).toThrow();
  });

  it('should handle numeric keys', () => {
    const encoded = 'BgcMCwY=';
    const key = 123;
    
    const result = decodePayload(encoded, key);
    expect(typeof result).toBe('string');
  });

  it('should be reversible', () => {
    const originalMessage = 'Test message for reversibility';
    const key = 'secretkey';
    
    // Encode
    const encoder = new TextEncoder();
    const messageBytes = encoder.encode(originalMessage);
    const keyBytes = encoder.encode(key);
    const xorBytes = new Uint8Array(messageBytes.length);
    
    for (let i = 0; i < messageBytes.length; i++) {
      xorBytes[i] = messageBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    
    const encoded = btoa(String.fromCharCode(...xorBytes));
    
    // Decode
    const decoded = decodePayload(encoded, key);
    
    expect(decoded).toBe(originalMessage);
  });
});
