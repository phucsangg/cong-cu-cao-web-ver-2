const puppeteer = require('puppeteer-core');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

exports.handler = async (event, context) => {
    const chromiumModule = await import('@sparticuz/chromium');
    const chromium = chromiumModule.default || chromiumModule;
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    const query = event.queryStringParameters || {};
    const url = query.url;
    const paginationMode = query.paginationMode || 'button';
    const pageParam = query.pageParam || 'page';
    const pageNum = parseInt(query.pageNum) || 1;
    const delay = Math.max(parseInt(query.delay) || 1000, 500);
    const isBlockResources = query.blockResources !== 'false';

    if (!url) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Lỗi: Thiếu link đường dẫn' })
        };
    }

    const cleanUrl = url.trim();
    const logs = [];
    const log = (msg, level = 'info') => {
        logs.push({ message: msg, level });
    };

    log(`Bắt đầu trích xuất Trang ${pageNum}.`);
    
    let browser = null;
    try {
        // Configure Chromium options for Serverless environment
        browser = await puppeteer.launch({
            args: [...chromium.args, '--disable-blink-features=AutomationControlled'],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1366, height: 768 });
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        });

        // Request interception to speed up scraping
        if (isBlockResources) {
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                const resourceType = req.resourceType();
                const reqUrl = req.url().toLowerCase();
                if (
                    ['image', 'media', 'font'].includes(resourceType) ||
                    reqUrl.includes('google-analytics') ||
                    reqUrl.includes('doubleclick') ||
                    reqUrl.includes('facebook') ||
                    reqUrl.includes('hotjar') ||
                    reqUrl.includes('pixel') ||
                    reqUrl.includes('analytics') ||
                    reqUrl.includes('adservice')
                ) {
                    req.abort();
                } else {
                    req.continue();
                }
            });
        }

        // Determine target URL
        let targetUrl = cleanUrl;
        if (paginationMode === 'url' && pageNum > 1) {
            if (targetUrl.includes('?')) {
                const parts = targetUrl.split('?');
                const searchParams = new URLSearchParams(parts[1]);
                searchParams.set(pageParam, pageNum);
                targetUrl = `${parts[0]}?${searchParams.toString()}`;
            } else {
                targetUrl = `${targetUrl}?${pageParam}=${pageNum}`;
            }
        }

        log(`Điều hướng tới URL: ${targetUrl}`);
        try {
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        } catch (gotoError) {
            log(`Cảnh báo: Thời gian tải trang vượt quá 15s. Đang tiến hành trích xuất dữ liệu hiện có...`, 'warning');
        }

        // If paginationMode is 'button' and pageNum > 1, click next button N-1 times
        if (paginationMode === 'button' && pageNum > 1) {
            log(`Chế độ nút bấm: Click chuyển tiếp ${pageNum - 1} lần...`);
            for (let i = 1; i < pageNum; i++) {
                const clicked = await page.evaluate(() => {
                    const elements = Array.from(document.querySelectorAll('a, button, li, span, div.next, [rel="next"]'));
                    for (let el of elements) {
                        const text = el.innerText ? el.innerText.trim().toLowerCase() : "";
                        const className = el.className ? String(el.className).toLowerCase() : "";
                        const relAttr = el.getAttribute('rel') ? el.getAttribute('rel').toLowerCase() : "";
                        const titleAttr = el.getAttribute('title') ? el.getAttribute('title').toLowerCase() : "";
                        const ariaLabel = el.getAttribute('aria-label') ? el.getAttribute('aria-label').toLowerCase() : "";
                        
                        const isCarousel = className.includes('swiper') || className.includes('slider') || className.includes('slick') || className.includes('carousel');
                        if (isCarousel) continue;

                        const isVisible = el.offsetWidth > 0 || el.offsetHeight > 0;
                        const isDisabled = el.disabled || className.includes('disabled') || className.includes('disable') || el.getAttribute('aria-disabled') === 'true';
                        if (!isVisible || isDisabled) continue;

                        const matchIcon = text === '>' || text === '»' || text === '▶' || text === '›' || text === 'next' || text === 'sau' || text === 'kế tiếp' || text === 'tiếp theo';
                        const matchText = text.includes('kế tiếp') || text.includes('trang sau') || text.includes('next page') || text.includes('trang tiếp') || text.includes('tiếp theo');
                        const matchAttr = relAttr === 'next' || className.includes('next') || titleAttr.includes('next') || ariaLabel.includes('next');
                        
                        const isNotBigContainer = el.querySelectorAll('*').length <= 6;
                        
                        if ((matchIcon || matchText || matchAttr) && isNotBigContainer) {
                            if (el.tagName === 'LI') {
                                const childLink = el.querySelector('a, button');
                                if (childLink) el = childLink;
                            }
                            el.scrollIntoView({ block: 'center' });
                            el.click();
                            return true;
                        }
                    }
                    return false;
                });

                if (clicked) {
                    log(`Đã click chuyển tiếp lần ${i}. Chờ chuyển hướng trang...`);
                    await sleep(1500); // Wait for page contents to change
                } else {
                    log(`Không tìm thấy nút chuyển tiếp ở lần click ${i}. Dừng chuyển tiếp.`, 'warning');
                    break;
                }
            }
        }

        // Lazy load scroll
        log(`Đang cuộn trang để kích hoạt lazy-load...`);
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                let distance = 600;
                let scrolls = 0;
                const maxScrolls = 20; // Lower scrolls to fit serverless limit
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    scrolls++;
                    
                    if (totalHeight >= scrollHeight - distance || scrolls >= maxScrolls) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        await sleep(500);

        // Extract products using Heuristic algorithm
        log(`Đang phân tích DOM trích xuất dữ liệu...`);
        const products = await page.evaluate((currentPageNum, currentUrl) => {
            const results = [];
            const tuKhoaRac = [
                'chính sách', 'hướng dẫn', 'tin tức', 'liên hệ', 'bài viết', 
                'giỏ hàng', 'tài khoản', 'showroom', 'tuyển dụng', 'địa chỉ', 
                'hotline', 'góp ý', 'bảo hành', 'trả góp', 'thương hiệu', 
                'nổi bật', 'cổ điển', 'xem thêm', 'danh mục', 'giới thiệu', 
                'đăng ký', 'đăng nhập', 'tin công nghệ', 'hệ thống', 'sơ đồ'
            ];

            function checkIfPrice(text) {
                text = text.trim().toLowerCase();
                if (!text) return false;
                
                const numericOnly = text.replace(/\D/g, '');
                if (/^0\d{9}$/.test(numericOnly) || /^1800\d{4}$/.test(numericOnly) || /^1900\d{4}$/.test(numericOnly)) return false;
                
                const hasCurrency = text.includes('đ') || text.includes('₫') || text.includes('$') || text.includes('vnd') || text.includes('vnđ');
                const cleanText = text.replace(/[\d.,\sđ₫$%\-]/g, '').replace(/vnd|vnđ/g, '');
                if (cleanText.length > 0) return false; 
                
                const hasDigit = /\d/.test(text);
                if (!hasDigit) return false;
                
                if (hasCurrency) {
                    if (/[.,]\d$/.test(text.replace(/[^0-9.,]/g, '')) && !text.includes('$')) return false;
                    return true;
                }
                
                const hasThousandSeparator = /^\d{1,3}([.,]\d{3})+$/.test(text);
                return hasThousandSeparator;
            }

            const isExcluded = (id, className) => {
                const exclusions = [
                    'menu', 'sidebar', 'footer', 'header', 'nav', 'aside', 'widget', 
                    'filter', 'banner', 'slider', 'carousel', 'breadcrumb', 'search',
                    'cart', 'checkout', 'login', 'register', 'auth', 'social', 'share',
                    'comment', 'review', 'rating', 'newsletter', 'subscribe', 'pagination'
                ];
                return exclusions.some(word => id.includes(word) || className.includes(word));
            };
            
            const allElements = Array.from(document.querySelectorAll('*'));
            
            function getPriceText(el) {
                const clone = el.cloneNode(true);
                const removeOldPrices = (node) => {
                    if (!node || !node.children) return;
                    Array.from(node.children).forEach(child => {
                        const className = child.className ? String(child.className).toLowerCase() : "";
                        const tagName = child.tagName ? String(child.tagName).toLowerCase() : "";
                        
                        let isLineThrough = false;
                        try {
                            const computedStyle = window.getComputedStyle(child);
                            isLineThrough = computedStyle.textDecorationLine === 'line-through' || 
                                            computedStyle.textDecoration === 'line-through' ||
                                            computedStyle.textDecoration.includes('line-through');
                        } catch (e) {}

                        if (className.includes('line') || className.includes('old') || className.includes('del') || tagName === 'del' || tagName === 's' || isLineThrough) {
                            try {
                                node.removeChild(child);
                            } catch (e) {}
                        } else {
                            removeOldPrices(child);
                        }
                    });
                };
                removeOldPrices(clone);
                return clone.innerText ? clone.innerText.trim() : "";
            }

            function isOriginalPriceEl(el) {
                const cn = el.className ? String(el.className).toLowerCase() : "";
                const tn = el.tagName ? String(el.tagName).toLowerCase() : "";
                if (cn.includes('line') || cn.includes('old') || cn.includes('del') || tn === 'del' || tn === 's') return true;
                try {
                    const cs = window.getComputedStyle(el);
                    if (cs.textDecorationLine === 'line-through' || cs.textDecoration.includes('line-through')) return true;
                } catch(e) {}
                return false;
            }

            const priceNodes = allElements.filter(el => {
                const text = getPriceText(el);
                if (!checkIfPrice(text)) return false;
                
                const children = Array.from(el.children);
                const childrenWithPrice = children.filter(child => checkIfPrice((child.innerText || "").trim()));

                if (childrenWithPrice.length === 0) return true;

                const allChildPricesAreOriginal = childrenWithPrice.every(child => isOriginalPriceEl(child));
                return allChildPricesAreOriginal;
            });

            priceNodes.forEach(priceNode => {
                const rawPrice = getPriceText(priceNode);
                let parent = priceNode.parentElement;
                let foundProduct = null;

                const classNameNode = priceNode.className ? String(priceNode.className).toLowerCase() : "";
                const tagNameNode = priceNode.tagName ? String(priceNode.tagName).toLowerCase() : "";
                
                let isLineThrough = false;
                try {
                    const computedStyle = window.getComputedStyle(priceNode);
                    isLineThrough = computedStyle.textDecorationLine === 'line-through' || 
                                    computedStyle.textDecoration === 'line-through' ||
                                    computedStyle.textDecoration.includes('line-through');
                } catch (e) {}

                const isOriginal = classNameNode.includes('line') || 
                                   classNameNode.includes('old') || 
                                   classNameNode.includes('del') || 
                                   tagNameNode === 'del' || 
                                   tagNameNode === 's' || 
                                   isLineThrough;

                for (let step = 0; step < 5; step++) {
                    if (!parent) break;

                    const idParent = parent.id ? String(parent.id).toLowerCase() : "";
                    const classParent = parent.className ? String(parent.className).toLowerCase() : "";
                    
                    if (isExcluded(idParent, classParent)) break;

                    const targetTitles = Array.from(parent.querySelectorAll('h1, h2, h3, h4, h5, h6, [class*="title"], [class*="name"], .title, .name, a'));
                    let titleText = "";
                    let titleHref = "";

                    for (const titleNode of targetTitles) {
                        const txt = titleNode.innerText ? titleNode.innerText.replace(/\s+/g, ' ').trim() : "";
                        if (txt && txt.length >= 8 && txt.length < 150 && txt !== rawPrice && !checkIfPrice(txt)) {
                            const laRac = tuKhoaRac.some(x => txt.toLowerCase().includes(x));
                            if (!laRac) {
                                titleText = txt;
                                let nodeLink = titleNode;
                                for (let i = 0; i < 3; i++) {
                                    if (nodeLink && nodeLink.tagName === 'A') {
                                        titleHref = nodeLink.getAttribute('href');
                                        break;
                                    }
                                    if (nodeLink) nodeLink = nodeLink.parentElement;
                                }
                                break;
                            }
                        }
                    }

                    const images = Array.from(parent.querySelectorAll('img'));
                    let imgSrc = "";
                    for (const img of images) {
                        const src = img.getAttribute('src') || 
                                     img.getAttribute('data-src') || 
                                     img.getAttribute('data-original') || 
                                     img.getAttribute('lazy-src') || 
                                     img.getAttribute('data-lazy-src');
                        if (src && !src.startsWith('data:image')) {
                            imgSrc = src;
                            break;
                        }
                    }

                    if (!titleHref) {
                        const links = Array.from(parent.querySelectorAll('a'));
                        for (const link of links) {
                            const href = link.getAttribute('href');
                            if (href && href.length > 2 && !href.startsWith('#') && !href.startsWith('javascript:')) {
                                titleHref = href;
                                break;
                            }
                        }
                    }

                    if (titleText) {
                        let absoluteLink = titleHref || "";
                        if (absoluteLink && !absoluteLink.startsWith('http') && !absoluteLink.startsWith('//')) {
                            try {
                                absoluteLink = new URL(absoluteLink, currentUrl).href;
                            } catch (err) {}
                        } else if (absoluteLink && absoluteLink.startsWith('//')) {
                            absoluteLink = 'https:' + absoluteLink;
                        }

                        let absoluteImg = imgSrc || "";
                        if (absoluteImg && !absoluteImg.startsWith('http') && !absoluteImg.startsWith('//')) {
                            try {
                                absoluteImg = new URL(absoluteImg, currentUrl).href;
                            } catch (err) {}
                        } else if (absoluteImg && absoluteImg.startsWith('//')) {
                            absoluteImg = 'https:' + absoluteImg;
                        }

                        foundProduct = {
                            ten: titleText,
                            gia: rawPrice,
                            trang: currentPageNum,
                            link: absoluteLink,
                            anh: absoluteImg,
                            isOriginal: isOriginal
                        };
                        break;
                    }

                    parent = parent.parentElement;
                }

                if (foundProduct) {
                    results.push(foundProduct);
                }
            });

            return results;
        }, pageNum, page.url());

        // De-duplicate page products
        const uniqueMap = new Map();
        products.forEach(sp => {
            const uniqueKey = sp.link || sp.ten;
            if (!uniqueKey) return;
            
            if (uniqueMap.has(uniqueKey)) {
                const existingSp = uniqueMap.get(uniqueKey);
                if (existingSp.isOriginal && !sp.isOriginal) {
                    uniqueMap.set(uniqueKey, sp);
                } else if (!existingSp.isOriginal && sp.isOriginal) {
                    // keep existing promo price
                } else {
                    const valNew = parseInt(sp.gia.replace(/\D/g, '')) || 0;
                    const valExisting = parseInt(existingSp.gia.replace(/\D/g, '')) || 0;
                    if (valNew > 0 && (valExisting === 0 || valNew < valExisting)) {
                        uniqueMap.set(uniqueKey, sp);
                    }
                }
            } else {
                uniqueMap.set(uniqueKey, sp);
            }
        });
        
        const uniqueProducts = Array.from(uniqueMap.values());
        log(`Đã cào thành công ${uniqueProducts.length} sản phẩm từ Trang ${pageNum}.`, 'success');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                products: uniqueProducts,
                logs: logs
            })
        };

    } catch (error) {
        log(`Lỗi nghiêm trọng: ${error.message}`, 'error');
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: error.message,
                logs: logs
            })
        };
    } finally {
        if (browser !== null) {
            await browser.close();
        }
    }
};
