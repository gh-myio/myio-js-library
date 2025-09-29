// Type definitions for MyIO JS Library
// Project: [LIBRARY_NAME]
// Definitions by: [YOUR_NAME] <[YOUR_EMAIL]>

// Add any global type definitions here
// For example:
// declare var MyGlobal: MyGlobalInterface;

declare global {
  interface Window {
    jspdf?: { jsPDF: any };
    jsPDF?: any; // defensive
  }
}

export {}; // This ensures the file is treated as a module
