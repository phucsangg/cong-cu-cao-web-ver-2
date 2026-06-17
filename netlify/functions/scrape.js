const scraperCore = require('../../lib/scraper-core.js');

exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;

    const logs = [];
    const log = (msg, level = 'info') => logs.push({ message: msg, level });

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const query = event.queryStringParameters || {};
    const url = query.url;
    const paginationMode = query.paginationMode || 'url';
    const pageParam = query.pageParam || 'page';
    const pageNum = parseInt(query.pageNum) || 1;
    const isBlockResources = query.blockResources !== 'false';
    const delay = parseInt(query.delay) || 2000;
    const timeout = parseInt(query.timeout) || 30000;

    if (!url) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Lỗi: Thiếu link đường dẫn' })
        };
    }

    log(`Bắt đầu trích xuất Trang ${pageNum}...`);

    // Build target URL
    let targetUrl = url.trim();
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
        const scrapeResult = await scraperCore.scrapeUrl(targetUrl, pageNum, {
            blockResources: isBlockResources,
            timeout: timeout,
        }, log);

        const responseBody = { products: scrapeResult.products, logs };
        if (scraperCore.isHomepage(targetUrl) && scrapeResult.categoryLinks) {
            responseBody.categoryLinks = scrapeResult.categoryLinks;
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(responseBody)
        };
    } catch (error) {
        log(`Lỗi trích xuất: ${error.message}`, 'error');
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message, logs })
        };
    }
};
