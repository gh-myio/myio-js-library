# Suggested Commit Messages

Based on the work completed in this session, here are the recommended commit messages following conventional commit format:

## For the Test Fixes

```
fix(tests): correct decodePayload test data and HTTP retry conditions

- Fix incorrect base64 test data in decodePayload tests (BgcMCwY= -> AwAVBwo=)
- Update "key longer than payload" test to use dynamic encoding
- Fix HTTP custom retry condition test (set ok: false for 429 status)
- Update numeric key test with correct base64 value
- All 19 tests now passing successfully
```

## For the Documentation Updates

```
docs: enhance API documentation and usage examples

- Update README.md with comprehensive API reference
- Add detailed examples for decodePayload, fetchWithRetry, and utilities
- Fix incorrect function signatures and parameter documentation
- Include ESM, CJS, and UMD usage examples
- Add practical code examples for all exported functions
- Improve developer experience with clear, working examples
```

## For TypeScript Configuration Fix

```
fix(config): exclude test files from TypeScript compilation

- Update tsconfig.json to exclude tests directory
- Resolve conflicts between JavaScript test files and TypeScript processing
- Maintain clean separation between source and test configurations
```

## Alternative: Single Comprehensive Commit

If you prefer a single commit for all changes:

```
fix: resolve test failures and enhance documentation

- Fix decodePayload test data with correct base64 XOR encoding
- Resolve HTTP retry condition test by fixing mock response status
- Update TypeScript config to exclude test files from compilation
- Enhance README.md with comprehensive API documentation
- Add practical usage examples for all exported functions
- Improve developer experience with accurate code examples

All 19 tests now passing. Documentation is complete and accurate.
```

## For Future Development

Here are some examples for common future changes:

### Adding New Features
```
feat(codec): add support for custom encoding algorithms

- Implement configurable encoding schemes
- Add support for multiple XOR key formats
- Include comprehensive test coverage
- Update TypeScript definitions
```

### Bug Fixes
```
fix(http): handle network timeouts correctly

- Improve timeout handling in fetchWithRetry
- Add proper cleanup for aborted requests
- Include test coverage for timeout scenarios
```

### Documentation Updates
```
docs(readme): update installation instructions

- Add yarn and pnpm installation options
- Include troubleshooting section
- Update browser compatibility information
```

### Refactoring
```
refactor(utils): optimize string normalization performance

- Improve regex patterns for better performance
- Reduce memory allocations in normalizeRecipients
- Maintain backward compatibility
```

### Build/CI Changes
```
chore(ci): update GitHub Actions workflow

- Upgrade to Node.js 20 in CI pipeline
- Add automated security scanning
- Include build artifact caching
```

## Commit Message Best Practices

1. **Use imperative mood**: "fix bug" not "fixed bug" or "fixes bug"
2. **Keep first line under 50 characters** when possible
3. **Include body for complex changes** explaining what and why
4. **Reference issues** when applicable: "Closes #123"
5. **Use conventional types**: feat, fix, docs, style, refactor, test, chore

## Recommended Approach

For this session's work, I recommend using the **single comprehensive commit** approach since the changes are related (fixing tests and updating documentation) and were done together as part of the same review process.
