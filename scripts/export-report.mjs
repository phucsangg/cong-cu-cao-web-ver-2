import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

/**
 * Clean cell values to prevent CSV issues
 */
function cleanCsvValue(val) {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
}

/**
 * Save rows as a CSV file with UTF-8 BOM (for Excel Vietnamese character support)
 */
function saveCsvFile(filepath, headers, rows) {
    const csvLines = [];
    csvLines.push(headers.map(cleanCsvValue).join(','));
    
    rows.forEach(r => {
        const line = headers.map(h => cleanCsvValue(r[h])).join(',');
        csvLines.push(line);
    });

    const csvContent = '\ufeff' + csvLines.join('\n');
    fs.writeFileSync(filepath, csvContent, 'utf-8');
}

/**
 * Export matched products and lists into JSON, CSV and XLSX files
 */
export function exportReports(matches, mineNormalized, bnbNormalized) {
    const dataDir = path.resolve('data');
    const reportsDir = path.resolve('reports');

    // Create directories if they do not exist
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

    // 1. Export normalized and matched JSON files (supporting both requested filename styles)
    fs.writeFileSync(path.join(dataDir, 'my_site_products.json'), JSON.stringify(mineNormalized, null, 2), 'utf-8');
    fs.writeFileSync(path.join(dataDir, 'bepngocbao_products.json'), JSON.stringify(bnbNormalized, null, 2), 'utf-8');
    fs.writeFileSync(path.join(dataDir, 'matched_products.json'), JSON.stringify(matches, null, 2), 'utf-8');
    fs.writeFileSync(path.join(dataDir, 'normalized-my-site.json'), JSON.stringify(mineNormalized, null, 2), 'utf-8');
    fs.writeFileSync(path.join(dataDir, 'normalized-bepngocbao.json'), JSON.stringify(bnbNormalized, null, 2), 'utf-8');

    // 2. Map matches into report rows
    const headers = [
        'Tên sản phẩm bên mình',
        'Tên sản phẩm Bếp Ngọc Bảo',
        'Mã / model',
        'Hãng',
        'Giá bên mình',
        'Giá Bếp Ngọc Bảo',
        'Chênh lệch',
        '% chênh lệch',
        'Link bên mình',
        'Link Bếp Ngọc Bảo',
        'Trạng thái so sánh'
    ];

    const allRows = matches.map(m => {
        const mine = m.myProduct || {};
        const bnb = m.bnbProduct || {};
        
        const myPriceVal = mine.price !== undefined && mine.price !== null ? mine.price : null;
        const bnbPriceVal = bnb.price !== undefined && bnb.price !== null ? bnb.price : null;
        
        let diff = '';
        let diffVal = null;
        let diffPercent = '';
        
        if (myPriceVal !== null && bnbPriceVal !== null) {
            diffVal = myPriceVal - bnbPriceVal;
            diff = (diffVal > 0 ? '+' : '') + diffVal.toLocaleString('vi-VN') + ' ₫';
            diffPercent = bnbPriceVal !== 0 ? ((diffVal / bnbPriceVal) * 100).toFixed(1) + '%' : '0%';
        }
        
        return {
            'Tên sản phẩm bên mình': mine.rawTitle || '',
            'Tên sản phẩm Bếp Ngọc Bảo': bnb.rawTitle || '',
            'Mã / model': mine.model || bnb.model || '',
            'Hãng': (mine.brand && mine.brand !== 'Khác') ? mine.brand : (bnb.brand || 'Khác'),
            'Giá bên mình': myPriceVal !== null ? myPriceVal.toLocaleString('vi-VN') + ' ₫' : 'Liên hệ',
            'Giá Bếp Ngọc Bảo': bnbPriceVal !== null ? bnbPriceVal.toLocaleString('vi-VN') + ' ₫' : 'Liên hệ',
            'Chênh lệch': diff,
            '_diffVal': diffVal, // Internal numeric field for sorting
            '% chênh lệch': diffPercent,
            'Link bên mình': mine.link || '',
            'Link Bếp Ngọc Bảo': bnb.link || '',
            'Trạng thái so sánh': m.status
        };
    });

    // 3. Filter rows into groups
    const missingInMySite = allRows.filter(r => r['Trạng thái so sánh'] === 'ONLY_IN_BEPNGOCBAO');
    const missingInBnb = allRows.filter(r => r['Trạng thái so sánh'] === 'ONLY_IN_MY_SITE');
    const cheaperThanBnb = allRows.filter(r => r['Trạng thái so sánh'] === 'MATCHED_MY_CHEAPER');
    const expensiveThanBnb = allRows.filter(r => r['Trạng thái so sánh'] === 'MATCHED_MY_MORE_EXPENSIVE');
    const samePriceBnb = allRows.filter(r => r['Trạng thái so sánh'] === 'MATCHED_SAME_PRICE');
    const uncertainMatches = allRows.filter(r => r['Trạng thái so sánh'] === 'UNCERTAIN_MATCH');

    // 4. Save CSV Reports (aligning with section 2 structure)
    saveCsvFile(path.join(reportsDir, 'compare_result.csv'), headers, allRows);
    saveCsvFile(path.join(reportsDir, 'cheaper_than_bepngocbao.csv'), headers, cheaperThanBnb);
    saveCsvFile(path.join(reportsDir, 'more_expensive_than_bepngocbao.csv'), headers, expensiveThanBnb);
    saveCsvFile(path.join(reportsDir, 'missing_in_my_site.csv'), headers, missingInMySite);
    saveCsvFile(path.join(reportsDir, 'missing_in_bepngocbao.csv'), headers, missingInBnb);
    saveCsvFile(path.join(reportsDir, 'uncertain_match.csv'), headers, uncertainMatches);

    // 5. Generate Multi-Sheet Premium Excel Workbook (aligning with sheet list in section 3)
    const wb = XLSX.utils.book_new();

    // Helper to strip internal sort keys
    const stripInternalKeys = (rowsArr) => rowsArr.map(r => {
        const { _diffVal, ...rest } = r;
        return rest;
    });

    const addSheet = (rowsArr, sheetName) => {
        const cleanedRows = stripInternalKeys(rowsArr);
        const ws = XLSX.utils.json_to_sheet(cleanedRows);
        
        // Adjust column widths automatically
        const colWidths = headers.map(h => {
            let maxLen = h.length;
            cleanedRows.forEach(r => {
                const len = String(r[h] || '').length;
                if (len > maxLen) maxLen = len;
            });
            return { wch: Math.min(maxLen + 3, 50) };
        });
        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    };

    addSheet(allRows, "Tat ca so sanh");
    addSheet(cheaperThanBnb, "Ben minh re hon");
    addSheet(expensiveThanBnb, "Ben minh dat hon");
    addSheet(samePriceBnb, "Bang gia");
    addSheet(missingInMySite, "Thieu ben minh");
    addSheet(missingInBnb, "Thieu Bep Ngoc Bao");
    addSheet(uncertainMatches, "So khop nghi ngo");

    XLSX.writeFile(wb, path.join(reportsDir, 'compare_result.xlsx'));
    
    console.log(`\n================ Báo cáo đã xuất thành công! ================`);
    console.log(`JSON Data:`);
    console.log(`  - my_site_products.json:          ${mineNormalized.length} sản phẩm`);
    console.log(`  - bepngocbao_products.json:       ${bnbNormalized.length} sản phẩm`);
    console.log(`  - normalized-my-site.json:        ${mineNormalized.length} sản phẩm`);
    console.log(`  - normalized-bepngocbao.json:     ${bnbNormalized.length} sản phẩm`);
    console.log(`  - matched_products.json:          ${matches.length} nhóm so khớp`);
    console.log(`CSV/Excel Reports:`);
    console.log(`  - reports/compare_result.xlsx (Đa sheet chuyên nghiệp)`);
    console.log(`  - reports/compare_result.csv:                 ${allRows.length} dòng`);
    console.log(`  - reports/cheaper_than_bepngocbao.csv:         ${cheaperThanBnb.length} dòng`);
    console.log(`  - reports/more_expensive_than_bepngocbao.csv:  ${expensiveThanBnb.length} dòng`);
    console.log(`  - reports/missing_in_my_site.csv:             ${missingInMySite.length} dòng`);
    console.log(`  - reports/missing_in_bepngocbao.csv:           ${missingInBnb.length} dòng`);
    console.log(`  - reports/uncertain_match.csv:                ${uncertainMatches.length} dòng`);
    console.log(`=============================================================`);
}
