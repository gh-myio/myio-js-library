// tools/spec-capture/capture-legacy.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LEGACY_SOURCE = 'src/thingsboard/main-dashboard-shopping/v-4.0.0/modal';
const SPEC_TARGET = 'src/legacy-spec';

function copyLegacyFiles() {
  const timestamp = new Date().toISOString();
  
  // Copy legacy files
  const files = ['controller.js', 'template.html', 'style.css'];
  
  files.forEach(file => {
    const sourcePath = path.join(LEGACY_SOURCE, file);
    const targetPath = path.join(SPEC_TARGET, `legacy-${file}`);
    
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`Copied ${file} to ${targetPath}`);
    }
  });
  
  // Create timestamp file
  fs.writeFileSync(
    path.join(SPEC_TARGET, 'capture-timestamp.txt'),
    `Legacy files captured at: ${timestamp}\n`
  );
  
  console.log('Legacy spec capture completed');
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  copyLegacyFiles();
}

export { copyLegacyFiles };
