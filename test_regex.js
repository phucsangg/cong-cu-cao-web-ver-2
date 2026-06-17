function extractSku(fullName) {
    let codes = [];
    
    // Pattern 1: Hafele article number (e.g. 536.61.787 or 536.66.850)
    const hafeleReg = /\b\d{3}\.\d{2}\.\d{3}\b/g;
    let match;
    while ((match = hafeleReg.exec(fullName)) !== null) {
        codes.push(match[0]);
    }
    
    // Pattern 2: Case-sensitive Brand SKU matching pattern
    // Removed /i flag and the middle \b to ensure correct matching and avoid matching lowercase Vietnamese text.
    const skuReg = /\b(?:EH-DIH|LCI|SPE|SPM|MH|MI|HC-I|PPI|PMI|TA|SV-MR|SV)\s*(?:-\s*)?[A-Z0-9]*\s*\d+\s*[A-Z0-9\/]*(?:\s*(?:Plus|PLUS|EG|KPLUS|VN|EVN|Iplus))?/g;
    while ((match = skuReg.exec(fullName)) !== null) {
        codes.push(match[0]);
    }
    
    // Fallback: general model codes if not matched above
    const generalReg = /\b[A-Z]+-?[A-Z0-9\-]*\b/g;
    while ((match = generalReg.exec(fullName)) !== null) {
        const val = match[0];
        const isUnit = /^\d+(?:W|vùng|trang|ms|s|h|kg)$/i.test(val);
        if (!isUnit) {
            codes.push(val);
        }
    }

    // Clean duplicate or nested codes
    let uniqueCodes = [...new Set(codes)];
    uniqueCodes = uniqueCodes.filter(c => {
        return !uniqueCodes.some(other => other !== c && other.toLowerCase().includes(c.toLowerCase()));
    });
    
    // Create clean name
    let cleanName = fullName;
    uniqueCodes.forEach(code => {
        const escapedCode = code.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const reg = new RegExp(escapedCode, 'g');
        cleanName = cleanName.replace(reg, '');
    });
    
    // Clean up spaces
    cleanName = cleanName.replace(/\s+/g, ' ').trim();
    
    return {
        sku: uniqueCodes.join(' / '),
        cleanName: cleanName
    };
}

const testCases = [
    "Bếp từ đôi Chefs EH-DIH336 lắp âm",
    "Bếp từ đôi Chefs EH-DIH 889 lắp âm",
    "Bếp từ đôi Spelier SPE IC928 PLUS lắp âm",
    "Bếp từ đôi Spelier SPM 998Iplus",
    "Bếp từ Malloca 4 vùng nấu MH-04I lắp âm",
    "Bếp từ Malloca 2 vùng nấu MH732IN",
    "Bếp từ đôi Malloca Skylux MH802",
    "Bếp từ Malloca 3 vùng nấu MH03IN",
    "Bếp từ Malloca Skylux MH803",
    "Bếp từ Malloca MI593FZ 3 vùng nấu",
    "Bếp từ Malloca 3 vùng nấu MH5903IN",
    "Bếp từ đôi Hafele HC-I752B 536.61.787 lắp âm",
    "Bếp từ Hafele 536.66.850",
    "Bếp từ Hafele HC-I7365B 536.61.365 2 vùng nấu",
    "Bếp từ đôi Lorca LCI 999 Plus lắp âm",
    "Bếp từ đôi Lorca LCI-806D lắp âm",
    "Bếp từ Bosch 2 vùng nấu 3500W PPI82566VN lắp âm",
    "Bếp từ Bosch 2 vùng nấu PMI8256EVN lắp âm",
    "Bếp từ đôi Lorca TA - 1009 Plus lắp âm",
    "Bếp từ đôi Chefs EH-DIH203 lắp âm",
    "Bếp từ đôi Lorca LCI 809 Plus lắp âm",
    "Bếp từ đôi Spelier SPE- IC1088 EG lắp âm",
    "Bếp từ đôi Sevilla SV-MR90 lắp âm",
    "Bếp từ đôi Spelier SPE IC 1188 EG/KPLUS lắp âm"
];

testCases.forEach(tc => {
    const res = extractSku(tc);
    console.log(`Original: "${tc}"`);
    console.log(` -> SKU:  "${res.sku}"`);
    console.log(` -> Name: "${res.cleanName}"`);
    console.log('---');
});
