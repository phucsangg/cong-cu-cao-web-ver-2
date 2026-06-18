import fs from 'fs';
import path from 'path';
import { extractSku } from '../scripts/normalize-product.mjs';

const csvPath = path.resolve('test.csv');
if (!fs.existsSync(csvPath)) {
    console.error("test.csv not found.");
    process.exit(1);
}

const lines = fs.readFileSync(csvPath, 'utf-8').split(/\r?\n/).filter(Boolean);
const headers = lines[0].split(',');

// Simple CSV parser that handles quotes
function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

const products = lines.slice(1).map(line => {
    const parts = parseCsvLine(line);
    return {
        stt: parts[0],
        name: parts[1],
        expectedSku: parts[2],
        link: parts[7]
    };
});

console.log(`Loaded ${products.length} products from test.csv.`);

console.log("\nSTT | Ten San Pham | SKU Truoc | SKU Sau");
console.log("-".repeat(80));

let changedCount = 0;
for (const p of products) {
    const res = extractSku(p.name, p.link);
    const skuAfter = res.sku || '';
    
    if (p.expectedSku !== skuAfter) {
        console.log(`STT: ${p.stt} | Name: "${p.name}"\n  => Link: "${p.link}"\n  => Old SKU: "${p.expectedSku}" | New SKU: "${skuAfter}" | Size: "${res.kichThuoc || ''}"`);
        changedCount++;
    }
}

console.log(`\nTotal SKU changes: ${changedCount}/${products.length}`);
