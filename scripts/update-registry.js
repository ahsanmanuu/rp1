const fs = require('fs');
const path = require('path');

const registryPath = path.join(process.cwd(), 'src', 'lib', 'templates', 'registry.ts');
const templatesDir = path.join(process.cwd(), 'src', 'assets', 'templates');

let content = fs.readFileSync(registryPath, 'utf8');

// Use a regex to find the TEMPLATE_REGISTRY array
const startMarker = 'export const TEMPLATE_REGISTRY: TemplateMetadata[] = [';
const endMarker = '];';

const startIndex = content.indexOf(startMarker);
const endIndex = content.lastIndexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
    console.error('Could not find TEMPLATE_REGISTRY');
    process.exit(1);
}

const registryItems = content.substring(startIndex + startMarker.length, endIndex);

// Split into individual template objects
// This is tricky because templates are multi-line.
// We can use a simpler approach: process each template folder and update the string.

const templateFolders = fs.readdirSync(templatesDir).filter(f => fs.statSync(path.join(templatesDir, f)).isDirectory());

const extsMap = {};
for (const folder of templateFolders) {
    const dir = path.join(templatesDir, folder);
    const files = fs.readdirSync(dir);
    const exts = [...new Set(files.map(f => path.extname(f).toLowerCase()).filter(e => ['.tex', '.cls', '.sty', '.bst', '.bib'].includes(e)))];
    extsMap[folder] = exts;
}

// Special case for 'blank'
extsMap['blank'] = ['.tex'];

// Update the content using regex
let newRegistryItems = registryItems;

const regex = /\{[\s\S]*?id: '([^']+)'[\s\S]*?\}/g;
newRegistryItems = newRegistryItems.replace(regex, (match, id) => {
    // Find assetFolder if it exists
    const assetFolderMatch = match.match(/assetFolder: '([^']+)'/);
    const assetFolder = assetFolderMatch ? assetFolderMatch[1] : (id === 'blank' ? 'blank' : null);
    
    if (assetFolder && extsMap[assetFolder]) {
        const exts = extsMap[assetFolder];
        const extsStr = `fileExtensions: ${JSON.stringify(exts)}`;
        
        // If fileExtensions already exists, replace it, otherwise add it
        if (match.includes('fileExtensions:')) {
            return match.replace(/fileExtensions: \[.*?\]/, extsStr);
        } else {
            // Add before the last closing brace
            return match.replace(/\s\}/, `, ${extsStr} }`);
        }
    }
    return match;
});

const newContent = content.substring(0, startIndex + startMarker.length) + newRegistryItems + content.substring(endIndex);
fs.writeFileSync(registryPath, newContent);
console.log('Successfully updated registry with file extensions.');
