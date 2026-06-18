import fs from 'fs';
import path from 'path';
import { extractSku } from './normalize-product.mjs';

const rawCachePath = path.resolve('data/raw-bepngocbao.json');
if (!fs.existsSync(rawCachePath)) {
    console.error("Error: raw-bepngocbao.json not found. Run compare-once first.");
    process.exit(1);
}

const rawProducts = JSON.parse(fs.readFileSync(rawCachePath, 'utf-8'));
console.log(`Reprocessing ${rawProducts.length} raw products...`);

const headers = ['STT', 'Ten San Pham', 'Ma San Pham', 'Dong / Series', 'Gia Ban', 'Nguon Trang', 'Lien Ket San Pham', 'Link Anh'];

// Helper to escape CSV values correctly
function escapeCsv(val) {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
}

const csvLines = [];
csvLines.push(headers.join(','));

rawProducts.forEach((p, index) => {
    // 1. Run extraction logic
    const ext = extractSku(p.ten);
    
    // 2. Format price - Bếp Ngọc Bảo has a price string already, but let's parse and format it nicely
    // If the price is a number in cache, format it. Let's look at the price field format in raw cache.
    // Usually raw cache has string like "28,800,000₫" or "28.800.000 đ". Let's check how the crawler extracts it.
    // Yes, the crawler grabs the raw price string. So p.gia is already a string like "28,800,000₫".
    let giaText = p.gia || 'Liên hệ';
    // Clean trailing letters or diacritics from price if any, e.g. "28,800,000₫ 35,000,000 -20%"
    // Let's parse price using parsePrice helper from normalize-product if needed, but keeping original formatting is better.
    // Let's check if there are multiple prices in p.gia.
    const numericPrice = parseInt(giaText.replace(/\D/g, ''));
    if (numericPrice > 0) {
        // Let's format it cleanly as "X,XXX,XXX₫"
        // Wait, did the user's CSV have "28,800,000₫"? Yes.
        // Let's format it.
        const cleanNum = parseInt(giaText.replace(/\D/g, ''));
        // Wait! What if there are multiple prices? e.g. "17,990,000₫ 30,583,000₫ -42%"
        // We only want the selling price (the first/lowest one) or keeping it.
        // Let's look at how the browser addProduct does it. It just displays prod.gia.
        // If we want the clean selling price:
        if (cleanNum > 0) {
            // Let's parse the actual price
            const matches = [];
            const priceRegex = /\b\d+(?:[.,]\d{3})*(?:\s*(?:đ|₫|vnd|vnđ|vnd))?/gi;
            let m;
            while ((m = priceRegex.exec(giaText)) !== null) {
                const num = parseInt(m[0].replace(/\D/g, '')) || 0;
                if (num > 1000) matches.push(num);
            }
            if (matches.length > 0) {
                const sorted = [...new Set(matches)].sort((a, b) => a - b);
                giaText = sorted[0].toLocaleString('vi-VN') + '₫';
            } else {
                giaText = cleanNum.toLocaleString('vi-VN') + '₫';
            }
        }
    }

    // Nguon Trang
    const nguonTrang = p.trang ? `Trang ${p.trang}` : `Trang 1`;

    const row = [
        index + 1,
        escapeCsv(ext.cleanName),
        escapeCsv(ext.sku),
        escapeCsv(ext.series),
        escapeCsv(giaText),
        escapeCsv(nguonTrang),
        escapeCsv(p.link || ''),
        escapeCsv(p.anh || '')
    ];
    csvLines.push(row.join(','));
});

const outputPath = path.resolve('danh_sach_san_pham_chuan_hoa_moi.csv');
const userCsvPath = path.resolve('danh_sach_san_pham_vet_can (5).csv');

// Add UTF-8 BOM (\ufeff)
const csvContent = '\ufeff' + csvLines.join('\n');
fs.writeFileSync(outputPath, csvContent, 'utf-8');
fs.writeFileSync(userCsvPath, csvContent, 'utf-8');

console.log(`Successfully generated clean CSV at: ${outputPath}`);
console.log(`Successfully updated user CSV at: ${userCsvPath}`);
