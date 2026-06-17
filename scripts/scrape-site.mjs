import fs from 'fs';
import path from 'path';
import scraperCore from '../lib/scraper-core.js';

/**
 * Scrapes a single category/collection URL across all its pages
 * @param {string} url - Category URL
 * @param {Object} options - Scraping configurations
 * @param {Function} logCallback - Logging function
 */
export async function scrapeCategory(url, options = {}, logCallback = console.log) {
    const pageParam = options.pageParam || 'page';
    const maxPages = options.maxPages || 50;
    const delay = options.delay || 1500;
    const timeout = options.timeout || 15000;
    const blockResources = options.blockResources !== false;

    let allProducts = [];
    let seenLinks = new Set();
    let pageNum = 1;

    logCallback(`Bắt đầu cào danh mục: ${url}`, 'info');

    while (pageNum <= maxPages) {
        logCallback(`--- Trang ${pageNum} ---`, 'info');
        
        let targetUrl = url;
        if (pageNum > 1) {
            if (targetUrl.includes('?')) {
                const [base, qs] = targetUrl.split('?');
                const sp = new URLSearchParams(qs);
                sp.set(pageParam, pageNum);
                targetUrl = `${base}?${sp.toString()}`;
            } else {
                targetUrl = `${targetUrl}?${pageParam}=${pageNum}`;
            }
        }

        try {
            const result = await scraperCore.scrapeUrl(targetUrl, pageNum, {
                blockResources,
                timeout
            }, logCallback);

            const products = result.products || [];
            if (products.length === 0) {
                logCallback(`Không tìm thấy sản phẩm nào ở trang ${pageNum}. Dừng cào sớm.`, 'warning');
                break;
            }

            let newCount = 0;
            products.forEach(p => {
                const key = p.link || p.ten;
                if (key && !seenLinks.has(key)) {
                    seenLinks.add(key);
                    allProducts.push(p);
                    newCount++;
                }
            });

            logCallback(`Trang ${pageNum}: Tìm thấy ${products.length} sản phẩm, ${newCount} sản phẩm mới.`, 'success');

            if (newCount === 0) {
                logCallback(`Toàn bộ sản phẩm ở trang ${pageNum} đều bị trùng lặp. Dừng cào sớm.`, 'warning');
                break;
            }

            // Delay between page requests
            if (pageNum < maxPages) {
                logCallback(`Chờ ${delay}ms trước khi cào trang tiếp theo...`);
                await scraperCore.sleep(delay);
            }

            pageNum++;
        } catch (err) {
            logCallback(`Lỗi khi cào trang ${pageNum}: ${err.message}`, 'error');
            break; // Stop scraping this category on error
        }
    }

    logCallback(`Hoàn thành danh mục! Tổng số sản phẩm không trùng lặp: ${allProducts.length}`, 'success');
    return allProducts;
}

/**
 * Scrapes multiple category URLs sequentially
 * @param {Array<string>} urls - List of category URLs
 * @param {Object} options - Scraping configurations
 * @param {Function} logCallback - Logging function
 */
export async function scrapeManyCategories(urls, options = {}, logCallback = console.log) {
    let combinedProducts = [];
    let seenLinks = new Set();

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        logCallback(`\n================ Danh mục ${i + 1}/${urls.length} ================`, 'info');
        const products = await scrapeCategory(url, options, logCallback);
        
        let newCount = 0;
        products.forEach(p => {
            const key = p.link || p.ten;
            if (key && !seenLinks.has(key)) {
                seenLinks.add(key);
                combinedProducts.push(p);
                newCount++;
            }
        });
        logCallback(`Gom danh mục ${i + 1}: Thêm ${newCount} sản phẩm mới vào danh sách tổng.`, 'success');
        
        if (i < urls.length - 1) {
            const delayBetweenCats = options.delayBetweenCategories || 2000;
            logCallback(`Chờ ${delayBetweenCats}ms trước khi sang danh mục mới...`);
            await scraperCore.sleep(delayBetweenCats);
        }
    }

    logCallback(`\nHoàn tất cào toàn bộ danh mục! Tổng số sản phẩm thu được: ${combinedProducts.length}`, 'success');
    return combinedProducts;
}

// Standalone CLI execution
if (process.argv[1] && (process.argv[1].endsWith('scrape-site.mjs') || process.argv[1].endsWith('scrape-site'))) {
    const runCLI = async () => {
        const dataDir = path.resolve('data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        console.log('--- CLI Test Scrape bepngocbao.vn (Trang 1) ---');
        try {
            const testProducts = await scrapeCategory('https://bepngocbao.vn/collections/all', {
                maxPages: 1,
                pageParam: 'page',
                delay: 1000
            });
            
            const rawFile = path.join(dataDir, 'raw-bepngocbao-test.json');
            fs.writeFileSync(rawFile, JSON.stringify(testProducts, null, 2), 'utf-8');
            console.log(`Đã lưu kết quả test vào: ${rawFile}`);
        } catch (e) {
            console.error('Lỗi chạy CLI test:', e);
        }
    };
    runCLI();
}
