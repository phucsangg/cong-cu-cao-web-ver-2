import fs from 'fs';
import path from 'path';
import { scrapeManyCategories, scrapeCategory } from './scrape-site.mjs';
import { normalizeProduct } from './normalize-product.mjs';
import { matchProducts } from './match-products.mjs';
import { exportReports } from './export-report.mjs';

async function main() {
    const args = process.argv.slice(2);
    const isDryRun = args.includes('--dry-run') || args.includes('-d');
    const skipScrape = args.includes('--no-scrape');
    
    // Parse max pages override
    let maxPagesMine = isDryRun ? 1 : 100;
    let maxPagesBnb = isDryRun ? 1 : 44;
    
    const maxPagesMineIdx = args.indexOf('--max-pages-mine');
    if (maxPagesMineIdx !== -1 && maxPagesMineIdx < args.length - 1) {
        maxPagesMine = parseInt(args[maxPagesMineIdx + 1]) || maxPagesMine;
    }
    
    const maxPagesBnbIdx = args.indexOf('--max-pages-bnb');
    if (maxPagesBnbIdx !== -1 && maxPagesBnbIdx < args.length - 1) {
        maxPagesBnb = parseInt(args[maxPagesBnbIdx + 1]) || maxPagesBnb;
    }

    let delay = 1500;
    const delayIdx = args.indexOf('--delay');
    if (delayIdx !== -1 && delayIdx < args.length - 1) {
        delay = parseInt(args[delayIdx + 1]) || delay;
    }

    const dataDir = path.resolve('data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const rawMineFile = path.join(dataDir, 'raw-my-site.json');
    const rawBnbFile = path.join(dataDir, 'raw-bepngocbao.json');

    let myRawProducts = [];
    let bnbRawProducts = [];

    console.log(`================ KHỞI ĐỘNG HỆ THỐNG SO SÁNH GIÁ (COMPARE-ONCE) ================`);
    if (isDryRun) {
        console.log(`⚠️ CHẾ ĐỘ CHẠY THỬ (DRY-RUN): Chỉ cào tối đa 1 trang mỗi bên để kiểm thử nhanh.`);
    }

    if (skipScrape) {
        console.log(`📦 BỎ QUA CÀO DỮ LIỆU: Đọc trực tiếp cache từ data/raw-*.json...`);
        if (fs.existsSync(rawMineFile) && fs.existsSync(rawBnbFile)) {
            myRawProducts = JSON.parse(fs.readFileSync(rawMineFile, 'utf-8'));
            bnbRawProducts = JSON.parse(fs.readFileSync(rawBnbFile, 'utf-8'));
            console.log(`  - Đã nạp ${myRawProducts.length} sản phẩm bên mình từ cache.`);
            console.log(`  - Đã nạp ${bnbRawProducts.length} sản phẩm Bếp Ngọc Bảo từ cache.`);
        } else {
            console.error(`❌ Lỗi: Không tìm thấy cache. Vui lòng chạy lại mà không có flag --no-scrape.`);
            process.exit(1);
        }
    } else {
        // 1. Read category list for my site
        const urlsFile = path.resolve('input/my-site-urls.txt');
        if (!fs.existsSync(urlsFile)) {
            console.error(`❌ Lỗi: Không tìm thấy file cấu hình danh mục tại ${urlsFile}`);
            console.log(`Vui lòng điền link danh mục vào file input/my-site-urls.txt`);
            process.exit(1);
        }

        const myUrls = fs.readFileSync(urlsFile, 'utf-8')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#') && line.startsWith('http'));

        if (myUrls.length === 0) {
            console.warn(`⚠️ Cảnh báo: file input/my-site-urls.txt trống hoặc không có URL hợp lệ.`);
            console.log(`Sẽ bỏ qua cào website bên mình (dữ liệu bên mình trống).`);
        } else {
            console.log(`\n[BƯỚC 1]: Cào dữ liệu từ website bên mình (${myUrls.length} danh mục)...`);
            myRawProducts = await scrapeManyCategories(myUrls, {
                maxPages: maxPagesMine,
                pageParam: 'page',
                delay: delay
            });
            fs.writeFileSync(rawMineFile, JSON.stringify(myRawProducts, null, 2), 'utf-8');
            console.log(`✅ Đã lưu ${myRawProducts.length} sản phẩm bên mình vào raw cache.`);
        }

        // 2. Scrape bepngocbao.vn
        console.log(`\n[BƯỚC 2]: Cào dữ liệu từ bepngocbao.vn...`);
        bnbRawProducts = await scrapeCategory('https://bepngocbao.vn/collections/all', {
            maxPages: maxPagesBnb,
            pageParam: 'page',
            delay: delay
        });
        fs.writeFileSync(rawBnbFile, JSON.stringify(bnbRawProducts, null, 2), 'utf-8');
        console.log(`✅ Đã lưu ${bnbRawProducts.length} sản phẩm Bếp Ngọc Bảo vào raw cache.`);
    }

    // 3. Normalize
    console.log(`\n[BƯỚC 3]: Chuẩn hóa dữ liệu sản phẩm...`);
    const myNormalized = myRawProducts.map(normalizeProduct);
    const bnbNormalized = bnbRawProducts.map(normalizeProduct);
    console.log(`  - Chuẩn hóa xong ${myNormalized.length} sản phẩm bên mình.`);
    console.log(`  - Chuẩn hóa xong ${bnbNormalized.length} sản phẩm Bếp Ngọc Bảo.`);

    // 4. Match
    console.log(`\n[BƯỚC 4]: Thực hiện so khớp sản phẩm (SKU + Fuzzy Matching)...`);
    const matches = matchProducts(myNormalized, bnbNormalized);
    console.log(`  - Đã ghép cặp và phân nhóm xong ${matches.length} hàng dữ liệu so sánh.`);

    // 5. Export Reports
    console.log(`\n[BƯỚC 5]: Xuất báo cáo CSV & Excel...`);
    exportReports(matches, myNormalized, bnbNormalized);
    console.log(`\n🎉 HỆ THỐNG SO SÁNH ĐÃ HOÀN TẤT THÀNH CÔNG!`);
}

main().catch(err => {
    console.error('❌ Lỗi nghiêm trọng khi thực thi:', err);
    process.exit(1);
});
