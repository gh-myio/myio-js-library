# Contributing to myio-js-library

Thank you for your interest in contributing to myio-js-library! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Code Style](#code-style)
- [Release Process](#release-process)

## Code of Conduct

This project adheres to a code of conduct that we expect all contributors to follow. Please be respectful and constructive in all interactions.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Create a new branch for your feature or bug fix
4. Make your changes
5. Test your changes
6. Submit a pull request

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0

### Installation

```bash
# Clone your fork
git clone https://github.com/your-username/myio-js-library.git
cd myio-js-library

# Install dependencies
npm install

# Run tests to ensure everything is working
npm test
```

### Available Scripts

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Build the library
npm run build

# Lint the code
npm run lint

# Fix linting issues
npm run lint:fix

# Type check
npm run type-check
```

## Making Changes

### Branch Naming

Use descriptive branch names that indicate the type of change:

- `feature/add-new-utility` - for new features
- `fix/decode-payload-bug` - for bug fixes
- `docs/update-readme` - for documentation updates
- `refactor/http-module` - for refactoring

### Commit Messages

Follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools

Examples:
```
feat(codec): add support for custom encoding algorithms
fix(http): handle network timeouts correctly
docs(readme): update installation instructions
```

## Testing

### Writing Tests

- Write tests for all new functionality
- Ensure existing tests pass
- Aim for high test coverage
- Use descriptive test names that explain what is being tested

### Test Structure

```javascript
import { describe, it, expect } from 'vitest';
import { functionToTest } from '../src/module.js';

describe('functionToTest', () => {
  it('should handle normal case', () => {
    const result = functionToTest('input');
    expect(result).toBe('expected');
  });

  it('should handle edge case', () => {
    const result = functionToTest('');
    expect(result).toBe('');
  });

  it('should throw error for invalid input', () => {
    expect(() => functionToTest(null)).toThrow();
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode during development
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Submitting Changes

### Pull Request Process

1. Ensure your code follows the project's coding standards
2. Update documentation if needed
3. Add or update tests for your changes
4. Ensure all tests pass
5. Update CHANGELOG.md with your changes
6. Submit a pull request with a clear description

### Pull Request Template

```markdown
## Description
Brief description of the changes

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Tests pass locally
- [ ] New tests added for new functionality
- [ ] Manual testing completed

## Checklist
- [ ] Code follows the project's style guidelines
- [ ] Self-review of code completed
- [ ] Documentation updated if needed
- [ ] CHANGELOG.md updated
```

## Code Style

### JavaScript Style

- Use ES2022+ features
- Prefer `const` over `let`, avoid `var`
- Use arrow functions for short functions
- Use template literals for string interpolation
- Use destructuring when appropriate
- Add JSDoc comments for public APIs

### Example:

```javascript
/**
 * Processes a payload with the given options
 * @param {string} payload - The payload to process
 * @param {Object} options - Processing options
 * @param {number} [options.timeout=5000] - Timeout in milliseconds
 * @returns {Promise<string>} The processed payload
 */
export const processPayload = async (payload, { timeout = 5000 } = {}) => {
  // Implementation
};
```

### Linting

The project uses ESLint with Prettier for code formatting. Run `npm run lint:fix` to automatically fix most style issues.

## Release Process

This project uses semantic versioning and automated releases:

1. Changes are merged to the main branch
2. Changesets are used to track changes
3. Releases are automated via GitHub Actions
4. Version numbers follow semver (major.minor.patch)

### Creating a Changeset

When making significant changes, create a changeset:

```bash
npx changeset
```

Follow the prompts to describe your changes and specify the version bump type.

## Questions?

If you have questions about contributing, please:

1. Check existing issues and discussions
2. Create a new issue with the "question" label
3. Reach out to the maintainers

Thank you for contributing to myio-js-library!
