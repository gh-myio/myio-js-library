# LoadingSpinner Component - RFC-0131

Provides a global busy overlay with a customizable spinner, minimum display time control, and a maximum timeout safeguard to prevent permanent "stuck" states.

This component is ideal for masking content changes or waiting for API calls in dashboards, ensuring a better user experience by preventing content flashes (minDisplayTime) and stuck screens (maxTimeout).

## Usage

The component is accessed via the factory function `createLoadingSpinner` from `MyIOLibrary`.

```typescript
import { createLoadingSpinner } from './components/loading-spinner';

// 1. Create instance (usually singleton)
const spinner = createLoadingSpinner({
  minDisplayTime: 800, // Show for at least 800ms
  maxTimeout: 15000, // Hide after 15 seconds regardless
  theme: 'dark',
});

// 2. Show the spinner
spinner.show('Atualizando dados da aba...');

// 3. Hide the spinner when the operation is complete
// This call will be delayed if minDisplayTime has not passed yet.
spinner.hide();
```

## Configuration (`LoadingSpinnerConfig`)

| Property         | Type                             | Default                 | Description                                                |
| ---------------- | -------------------------------- | ----------------------- | ---------------------------------------------------------- |
| `minDisplayTime` | `number`                         | `800`                   | Minimum display time in milliseconds.                      |
| `maxTimeout`     | `number`                         | `10000`                 | Maximum time before the spinner is forced to hide.         |
| `message`        | `string`                         | `'Carregando dados...'` | Default message displayed below the spinner.               |
| `spinnerType`    | `'single' \| 'double' \| 'dots'` | `'double'`              | Visual style of the spinner.                               |
| `theme`          | `'dark' \| 'light'`              | `'dark'`                | Color scheme for the overlay and content.                  |
| `showTimer`      | `boolean`                        | `false`                 | Internal debug flag to show elapsed time.                  |
| `onTimeout`      | `() => void`                     | `undefined`             | Callback function when `maxTimeout` is reached.            |
| `onComplete`     | `() => void`                     | `undefined`             | Callback function when the spinner is successfully hidden. |
