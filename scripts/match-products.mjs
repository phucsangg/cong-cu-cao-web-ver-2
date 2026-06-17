import { removeVietnameseTones } from './normalize-product.mjs';

/**
 * Get comparison tokens for fuzzy matching
 */
export function getComparisonTokens(name) {
    if (!name) return [];
    const clean = removeVietnameseTones(name)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
    const words = clean.split(/\s+/);
    const stopWords = [
        'bep', 'tu', 'dien', 'hong', 'ngoai', 'may', 'hut', 'mui', 'lo', 'vi', 'song', 'nuong', 'rua', 'chen', 'bat', 'am', 'duong', 'nhap', 'khau', 'chinh', 'hang', 'gia', 're', 'doi', 'ba', 'bon', 'vung', 'nau', 'kinh',
        'inox', '304', '201', '316', '430', 'sus', 'thep', 'khong', 'gi', 'cai', 'chiec', 'set', 'hop', 'khay', 'gia', 'ke', 'bo', 'chau', 'voi', 'day', 'rut', 'nude', 'smart', 'kem', 'trang', 'den', 'mo'
    ];
    return words.filter(w => w.length > 1 && !stopWords.includes(w));
}

/**
 * Calculate Jaccard similarity between two token arrays
 */
export function calculateJaccardSimilarity(tokens1, tokens2) {
    if (tokens1.length === 0 || tokens2.length === 0) return 0;
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    
    let intersectionSize = 0;
    set1.forEach(item => {
        if (set2.has(item)) intersectionSize++;
    });
    
    const unionSize = set1.size + set2.size - intersectionSize;
    return intersectionSize / unionSize;
}

/**
 * Normalize model strings to compare them robustly (e.g. remove spaces, dashes)
 */
function normalizeModel(modelStr) {
    if (!modelStr) return '';
    return modelStr.toUpperCase().replace(/[-_ _/]+/g, '').trim();
}

/**
 * Check if the two models match
 */
function isModelMatch(m1, m2) {
    const norm1 = normalizeModel(m1);
    const norm2 = normalizeModel(m2);
    return norm1 && norm2 && norm1 === norm2;
}

/**
 * Match products from my site and bepngocbao.vn using multi-pass matching
 */
export function matchProducts(mineProducts, bnbProducts) {
    const matches = [];
    const matchedMineIndices = new Set();
    const matchedBnbIndices = new Set();

    // Pre-calculate tokens for all items to speed up fuzzy search
    const mineTokens = mineProducts.map(p => getComparisonTokens(p.cleanTitle));
    const bnbTokens = bnbProducts.map(p => getComparisonTokens(p.cleanTitle));

    // ==== PASS 1: Exact model matching (same model + same brand, brand !== 'Khác') ====
    for (let i = 0; i < mineProducts.length; i++) {
        const mineItem = mineProducts[i];
        if (!mineItem.model || mineItem.brand === 'Khác') continue;

        for (let j = 0; j < bnbProducts.length; j++) {
            if (matchedBnbIndices.has(j)) continue;
            const bnbItem = bnbProducts[j];

            if (isModelMatch(mineItem.model, bnbItem.model) && 
                mineItem.brand.toLowerCase() === bnbItem.brand.toLowerCase()) {
                
                matchedMineIndices.add(i);
                matchedBnbIndices.add(j);
                matches.push({
                    myProduct: mineItem,
                    bnbProduct: bnbItem,
                    matchType: 'exact',
                    similarity: 1.0,
                    status: determineCompareStatus(mineItem.price, bnbItem.price, 'exact')
                });
                break;
            }
        }
    }

    // ==== PASS 2: Model matching with missing brand (same model, brand is 'Khác' on either side) ====
    for (let i = 0; i < mineProducts.length; i++) {
        if (matchedMineIndices.has(i)) continue;
        const mineItem = mineProducts[i];
        if (!mineItem.model) continue;

        for (let j = 0; j < bnbProducts.length; j++) {
            if (matchedBnbIndices.has(j)) continue;
            const bnbItem = bnbProducts[j];

            if (isModelMatch(mineItem.model, bnbItem.model)) {
                // Either same brand, or one of them has 'Khác'
                if (mineItem.brand.toLowerCase() === bnbItem.brand.toLowerCase() || 
                    mineItem.brand === 'Khác' || bnbItem.brand === 'Khác') {
                    
                    matchedMineIndices.add(i);
                    matchedBnbIndices.add(j);
                    matches.push({
                        myProduct: mineItem,
                        bnbProduct: bnbItem,
                        matchType: 'model_only',
                        similarity: 0.95,
                        status: determineCompareStatus(mineItem.price, bnbItem.price, 'model_only')
                    });
                    break;
                }
            }
        }
    }

    // ==== PASS 3: High confidence fuzzy match (same brand, Jaccard similarity >= 86%) ====
    for (let i = 0; i < mineProducts.length; i++) {
        if (matchedMineIndices.has(i)) continue;
        const mineItem = mineProducts[i];
        const t1 = mineTokens[i];

        let bestJ = -1;
        let maxSim = 0;

        for (let j = 0; j < bnbProducts.length; j++) {
            if (matchedBnbIndices.has(j)) continue;
            const bnbItem = bnbProducts[j];

            // Same brand or at least one is 'Khác'
            if (mineItem.brand.toLowerCase() === bnbItem.brand.toLowerCase() || 
                mineItem.brand === 'Khác' || bnbItem.brand === 'Khác') {
                
                const sim = calculateJaccardSimilarity(t1, bnbTokens[j]);
                if (sim > maxSim) {
                    maxSim = sim;
                    bestJ = j;
                }
            }
        }

        if (maxSim >= 0.86 && bestJ !== -1) {
            matchedMineIndices.add(i);
            matchedBnbIndices.add(bestJ);
            matches.push({
                myProduct: mineItem,
                bnbProduct: bnbProducts[bestJ],
                matchType: 'fuzzy_high',
                similarity: maxSim,
                status: determineCompareStatus(mineItem.price, bnbProducts[bestJ].price, 'fuzzy_high')
            });
        }
    }

    // ==== PASS 4: Uncertain match (same brand, Jaccard similarity between 70% and 85%) ====
    for (let i = 0; i < mineProducts.length; i++) {
        if (matchedMineIndices.has(i)) continue;
        const mineItem = mineProducts[i];
        const t1 = mineTokens[i];

        let bestJ = -1;
        let maxSim = 0;

        for (let j = 0; j < bnbProducts.length; j++) {
            if (matchedBnbIndices.has(j)) continue;
            const bnbItem = bnbProducts[j];

            if (mineItem.brand.toLowerCase() === bnbItem.brand.toLowerCase() || 
                mineItem.brand === 'Khác' || bnbItem.brand === 'Khác') {
                
                const sim = calculateJaccardSimilarity(t1, bnbTokens[j]);
                if (sim > maxSim) {
                    maxSim = sim;
                    bestJ = j;
                }
            }
        }

        if (maxSim >= 0.70 && maxSim < 0.86 && bestJ !== -1) {
            matchedMineIndices.add(i);
            matchedBnbIndices.add(bestJ);
            matches.push({
                myProduct: mineItem,
                bnbProduct: bnbProducts[bestJ],
                matchType: 'fuzzy_uncertain',
                similarity: maxSim,
                status: 'UNCERTAIN_MATCH' // Forces uncertain match status
            });
        }
    }

    // ==== PASS 5: Remaining unmatched items in My Site ====
    for (let i = 0; i < mineProducts.length; i++) {
        if (!matchedMineIndices.has(i)) {
            matches.push({
                myProduct: mineProducts[i],
                bnbProduct: null,
                matchType: 'only_mine',
                similarity: 0.0,
                status: 'ONLY_IN_MY_SITE'
            });
        }
    }

    // ==== PASS 6: Remaining unmatched items in Bếp Ngọc Bảo ====
    for (let j = 0; j < bnbProducts.length; j++) {
        if (!matchedBnbIndices.has(j)) {
            matches.push({
                myProduct: null,
                bnbProduct: bnbProducts[j],
                matchType: 'only_bnb',
                similarity: 0.0,
                status: 'ONLY_IN_BEPNGOCBAO'
            });
        }
    }

    return matches;
}

/**
 * Determine comparison status based on prices
 */
function determineCompareStatus(myPrice, bnbPrice, matchType) {
    if (myPrice === null || bnbPrice === null) {
        return 'NO_PRICE_TO_COMPARE';
    }

    const diff = myPrice - bnbPrice;

    // Ignore small difference under 1000đ
    if (Math.abs(diff) < 1000) {
        return 'MATCHED_SAME_PRICE';
    } else if (diff < 0) {
        return 'MATCHED_MY_CHEAPER';
    } else {
        return 'MATCHED_MY_MORE_EXPENSIVE';
    }
}
