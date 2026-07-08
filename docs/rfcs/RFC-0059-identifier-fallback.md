# RFC-0059: Robust Identifier Fallback Mechanism for TELEMETRY Widgets

## Metadata
- **Status:** Draft
- **Author:** MyIO Engineering Team
- **Created:** 2025-10-29
- **Last Updated:** 2025-10-29

## Motivation

In our current TELEMETRY widget implementation, device identification relies primarily on the `identifier` attribute from server-scope attributes. However, real-world scenarios often present challenges:

1. Missing or null `identifier` attributes
2. Placeholder values like 'SEM IDENTIFICADOR IDENTIFICADO'
3. Inconsistent device identification across different data sources

This RFC proposes a robust, flexible mechanism to handle these identification edge cases, ensuring consistent and meaningful device representation.

## Guide-Level Explanation

### Current Behavior
- Widgets display device identifiers from server-scope attributes
- If `identifier` is missing or invalid, the widget might show an empty or unhelpful placeholder

### Proposed Behavior
- Implement a multi-step fallback chain for identifier resolution
- Prioritize data sources to ensure meaningful device identification
- Provide a consistent, predictable identification strategy

### Fallback Resolution Chain
1. Primary Source: Server-scope `identifier` attribute
   - Must be non-null, non-empty, and not a placeholder value
2. Secondary Source: Server-scope `deviceId` attribute
   - Used if primary source is invalid
3. Final Fallback: Literal "X"
   - Indicates no valid identifier could be found

## Reference-Level Explanation

### Identifier Validation Criteria
- Non-null value
- Non-empty after trimming whitespace
- Not equal to placeholder strings (e.g., 'SEM IDENTIFICADOR IDENTIFICADO')

### Implementation Strategy
```javascript
function normalizeIdentifier(identifier, deviceId) {
  // Validation logic
  const isInvalidIdentifier = 
    !identifier || 
    identifier.trim() === '' || 
    identifier.trim() === 'SEM IDENTIFICADOR IDENTIFICADO';
  
  if (isInvalidIdentifier) {
    // Fallback to deviceId
    return deviceId && deviceId.trim() !== '' 
      ? deviceId.trim() 
      : 'X';
  }
  
  return identifier.trim();
}
```

### Affected Components
- `buildTbAttrIndex()`: Enhanced to capture both `identifier` and `deviceId`
- `buildAuthoritativeItems()`: Apply fallback logic during item creation
- Logging: Add debug/warning logs for fallback scenarios

## Drawbacks

1. Potential performance overhead from additional validation
2. Risk of masking underlying data inconsistencies
3. Might introduce confusion if "X" appears frequently

## Rationale and Alternatives

### Why This Approach?
- Provides a consistent identification strategy
- Minimizes manual intervention
- Maintains data traceability

### Alternatives Considered
1. Throw an error on missing identifier
   - Too disruptive to widget functionality
2. Leave as-is with empty/null identifiers
   - Poor user experience
3. Manual configuration per device
   - Scalability and maintenance challenges

## Prior Art

Similar fallback mechanisms exist in:
- `src/thingsboard/utils/deviceType.js`
- Previous RFC implementations handling data normalization

## Unresolved Questions

1. How to handle case sensitivity in identifier comparisons?
2. Should we log every fallback occurrence or only unexpected cases?
3. Performance impact of additional validation?

## Future Possibilities

1. Configurable fallback sources
2. More sophisticated identifier resolution (e.g., fuzzy matching)
3. Telemetry tracking of fallback frequency

## Testing Considerations

### Test Cases
- Device with valid `identifier`
- Device with null `identifier`
- Device with 'SEM IDENTIFICADOR IDENTIFICADO'
- Device with valid `deviceId`
- Device with both `identifier` and `deviceId` invalid

### Metrics to Track
- Frequency of fallback occurrences
- Performance overhead
- User-reported issues related to identification

## Deployment Checklist

- [ ] Update `buildTbAttrIndex()` function
- [ ] Implement `normalizeIdentifier()` helper
- [ ] Modify `buildAuthoritativeItems()` 
- [ ] Add comprehensive logging
- [ ] Create comprehensive test suite
- [ ] Perform integration testing
- [ ] Monitor production metrics post-deployment

## Security Considerations

- Ensure no sensitive information is exposed during identifier resolution
- Validate and sanitize all identifier sources
- Log fallback events without revealing system internals

## Conclusion

This RFC provides a systematic approach to handling device identifier challenges, improving the robustness and reliability of our TELEMETRY widgets.
