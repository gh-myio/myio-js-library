/**
 * canModifyAnnotation — ED-1412: `system` annotations are read-only for
 * everyone, SuperAdmins included; other types keep the RFC-0104 rules.
 */
import { describe, expect, it } from 'vitest';
import { canModifyAnnotation } from '../../src/utils/superAdminUtils';

const owner = { id: 'u1', email: 'owner@example.com', name: 'Owner' };
const other = { id: 'u2', email: 'other@example.com', name: 'Other' };

const regular = { currentUser: owner, isSuperAdminMyio: false, isSuperAdminHolding: false };
const superMyio = { currentUser: other, isSuperAdminMyio: true, isSuperAdminHolding: false };
const superHolding = { currentUser: other, isSuperAdminMyio: false, isSuperAdminHolding: true };

describe('canModifyAnnotation', () => {
  it('returns false for system annotations, even for SuperAdmins and the "author"', () => {
    const system = { type: 'system', createdBy: owner };
    expect(canModifyAnnotation(system, superMyio)).toBe(false);
    expect(canModifyAnnotation(system, superHolding)).toBe(false);
    expect(canModifyAnnotation(system, regular)).toBe(false);
  });

  it('keeps the existing rules for non-system annotations', () => {
    expect(canModifyAnnotation({ type: 'pending', createdBy: other }, superMyio)).toBe(true);
    expect(canModifyAnnotation({ type: 'pending', createdBy: other }, superHolding)).toBe(true);
    expect(canModifyAnnotation({ type: 'pending', createdBy: owner }, regular)).toBe(true);
    expect(canModifyAnnotation({ type: 'pending', createdBy: other }, regular)).toBe(false);
  });

  it('stays backward compatible when `type` is not provided', () => {
    expect(canModifyAnnotation({ createdBy: owner }, regular)).toBe(true);
    expect(canModifyAnnotation({ createdBy: other }, regular)).toBe(false);
    expect(canModifyAnnotation({ createdBy: other }, { ...regular, currentUser: null })).toBe(false);
  });
});
