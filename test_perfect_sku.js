function extractSku(fullName) {
    let codes = [];
    
    // Pattern 1: Hafele article number (e.g. 536.61.787 or 536.66.850)
    const hafeleReg = /\b\d{3}\.\d{2}\.\d{3}\b/g;
    let match;
    while ((match = hafeleReg.exec(fullName)) !== null) {
        codes.push(match[0]);
    }
    
    // Pattern 2: Chefs models (e.g. EH-DIH 889, EH-DIH336)
    const chefsReg = /\bEH-DIH\s?\d+(?:\s?PLUS)?\b/gi;
    while ((match = chefsReg.exec(fullName)) !== null) {
        codes.push(match[0]);
    }

    // Pattern 3: Lorca models (e.g. LCI 999 Plus, LCI-806D, LCI 809 Plus, TA - 1009 Plus)
    const lorcaReg = /\b(?:LCI|TA)\s*(?:-\s*)?\d+(?:\s?(?:Plus|PLUS))?\b/gi;
    while ((match = lorcaReg.exec(fullName)) !== null) {
        codes.push(match[0]);
    }

    // Pattern 4: Spelier models (e.g. SPE- IC1088 EG, SPE IC 1188 EG/KPLUS, SPM 998Iplus)
    // Placed EG/KPLUS before EG so the longer suffix matches first
    const spelierReg = /\b(?:SPE[- ]*(?:IC)?|SPM)\s*\d+(?:\s?(?:EG\/KPLUS|EG|KPLUS|PLUS|Plus|VN|EVN|Iplus))?\b/gi;
    while ((match = spelierReg.exec(fullName)) !== null) {
        codes.push(match[0]);
    }
    
    // Pattern 5: General alphanumeric model codes (e.g. HC-I752B, MH-04I, MH732IN, SV-MR90, PPI82566VN)
    const generalReg = /\b(?:[A-Z]+(?:-[A-Z]+)?-?\d+\w*|\d+-?[A-Z]+\w*)\b/gi;
    while ((match = generalReg.exec(fullName)) !== null) {
        const val = match[0];
        const hasLetter = /[A-Z]/i.test(val);
        const hasDigit = /\d/.test(val);
        const isUnit = /^\d+(?:W|vùng|trang|ms|s|h|kg)$/i.test(val);
        if (hasLetter && hasDigit && !isUnit) {
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
        const reg = new RegExp(escapedCode, 'gi');
        cleanName = cleanName.replace(reg, '');
    });
    
    // Clean up spaces
    cleanName = cleanName.replace(/\s+/g, ' ').trim();
    
    // Now split baseSku and series for each code
    let baseSkus = [];
    let seriesSuffixes = [];
    
    const suffixRegex = /(?:[- ]+|(?<=\d))(EG\/KPLUS|EG|KPLUS|PLUS|Iplus|EVN|VN|IN)$/i;
    uniqueCodes.forEach(code => {
        const matchSuffix = code.match(suffixRegex);
        if (matchSuffix) {
            const series = matchSuffix[1];
            const baseSku = code.substring(0, matchSuffix.index).trim();
            baseSkus.push(baseSku);
            seriesSuffixes.push(series);
        } else {
            baseSkus.push(code);
        }
    });

    return {
        sku: baseSkus.join(' / '),
        series: [...new Set(seriesSuffixes)].join(' / '),
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
    console.log(` -> Name:   "${res.cleanName}"`);
    console.log(` -> SKU:    "${res.sku}"`);
    console.log(` -> Series: "${res.series}"`);
    console.log('---');
});
