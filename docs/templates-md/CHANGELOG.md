# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of myio-js-library
- Base64 XOR payload decoding functionality
- HTTP utilities with retry logic and exponential backoff
- String utilities including recipient normalization
- Number formatting utilities
- Dual module support (ESM/CJS)
- UMD build for browser usage
- TypeScript definitions via JSDoc
- Comprehensive test suite
- CI/CD pipeline with GitHub Actions
- Deterministic device type detection with accent-insensitive matching
- Expanded device type triggers (CAIXA_D_AGUA, ESRL/ELEV, RECALQUE)
- Context-based priority rules for device detection
- Comprehensive device type detection tests (64 test cases)
- Device type detection documentation with examples

### Changed
- Refactored deviceType.js with priority-based detection system
- Improved accent normalization for Portuguese diacritics
- Enhanced CAIXA_D_AGUA detection with multiple variant support
- Optimized device type matching performance with precompiled rules

### Changed
- N/A

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- N/A

## [1.0.0] - TBD

### Added
- Initial stable release
