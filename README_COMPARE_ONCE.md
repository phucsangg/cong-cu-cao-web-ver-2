# Công cụ cào dữ liệu & so sánh giá với Bếp Ngọc Bảo

Dự án này dùng để **quét toàn bộ sản phẩm từ website bán hàng của bạn**, sau đó cào dữ liệu sản phẩm từ **bepngocbao.vn** một lần duy nhất, chuẩn hóa dữ liệu, so khớp sản phẩm và xuất báo cáo so sánh giá ra CSV/Excel.

---

## 1. Mục tiêu

Công cụ này phục vụ quy trình:

```txt
Quét sản phẩm website của bạn
        ↓
Quét sản phẩm từ bepngocbao.vn
        ↓
Chuẩn hóa tên, giá, hãng, SKU/model
        ↓
So khớp sản phẩm giữa hai nguồn
        ↓
So sánh giá
        ↓
Xuất báo cáo Excel/CSV
```

Sau khi chạy xong, hệ thống sẽ tạo báo cáo cho biết:

- Sản phẩm nào bên bạn đang rẻ hơn Bếp Ngọc Bảo.
- Sản phẩm nào bên bạn đang đắt hơn Bếp Ngọc Bảo.
- Sản phẩm nào bằng giá.
- Sản phẩm nào chỉ có ở bên bạn.
- Sản phẩm nào chỉ có ở Bếp Ngọc Bảo.
- Sản phẩm nào khớp chưa chắc chắn và cần kiểm tra thủ công.

---

## 2. Cấu trúc thư mục đề xuất

```txt
cong-cu-cao-web-ver-3/
├── public/
│   └── index.html
│
├── netlify/
│   └── functions/
│       └── scrape.js
│
├── lib/
│   └── scraper-core.js
│
├── scripts/
│   ├── scrape-site.mjs
│   ├── normalize-product.mjs
│   ├── match-products.mjs
│   ├── export-report.mjs
│   └── compare-once.mjs
│
├── input/
│   └── my-site-urls.txt
│
├── data/
│   ├── raw-my-site.json
│   ├── raw-bepngocbao.json
│   ├── normalized-my-site.json
│   └── normalized-bepngocbao.json
│
├── reports/
│   ├── compare_result.xlsx
│   ├── compare_result.csv
│   ├── cheaper_than_bepngocbao.csv
│   ├── more_expensive_than_bepngocbao.csv
│   ├── missing_in_my_site.csv
│   ├── missing_in_bepngocbao.csv
│   └── uncertain_match.csv
│
├── netlify.toml
├── .node-version
├── package.json
├── server.js
├── README.md
├── README_COMPARE_ONCE.md
└── history.md
```

---

## 3. Ý nghĩa từng phần

### `public/index.html`

Giao diện Web Dashboard hiện tại của dự án.

Chức năng chính:

- Nhập URL để cào thủ công.
- Cấu hình số trang cần quét.
- Cấu hình cách phân trang.
- Hiển thị log quá trình cào.
- Hiển thị sản phẩm cào được.
- Xuất dữ liệu thủ công sang CSV/JSON.

Phần này giữ lại để dùng như dashboard cũ, không bắt buộc dùng khi chạy quy trình so sánh một lần.

---

### `netlify/functions/scrape.js`

API Serverless Function cho dashboard.

Chức năng:

- Nhận yêu cầu cào dữ liệu từ frontend.
- Gọi thư viện lõi trong `lib/scraper-core.js`.
- Trả về danh sách sản phẩm và log cho giao diện.

Endpoint đề xuất:

```txt
/api/scrape
```

---

### `lib/scraper-core.js`

Thư viện lõi dùng chung cho cả dashboard và CLI.

Nên chứa các hàm chính:

```txt
scrapePage()
scrapeCategory()
extractProductsCheerio()
scrapeWithPuppeteer()
extractCategoryLinksCheerio()
cleanPrice()
normalizeUrl()
```

Cơ chế hoạt động:

1. Ưu tiên cào nhanh bằng Cheerio.
2. Nếu trang render bằng JavaScript hoặc lấy được quá ít sản phẩm, tự động fallback sang Puppeteer.
3. Chặn ảnh, font, tracking script để tăng tốc.
4. Tự động tìm tên, giá, ảnh, link sản phẩm.
5. Hạn chế lỗi ghép nhầm giá bằng cách ưu tiên lấy giá gần tên sản phẩm trong DOM.

---

### `scripts/scrape-site.mjs`

Script CLI dùng để cào toàn bộ sản phẩm từ danh sách URL danh mục.

Chức năng:

- Đọc danh sách URL từ `input/my-site-urls.txt`.
- Quét từng danh mục.
- Tự động xử lý phân trang.
- Loại bỏ sản phẩm trùng link hoặc trùng mã.
- Lưu dữ liệu thô vào thư mục `data/`.

Ví dụ dữ liệu đầu vào:

```txt
https://website-cua-ban.vn/collections/all
https://website-cua-ban.vn/collections/bep-tu
https://website-cua-ban.vn/collections/may-hut-mui
```

---

### `scripts/normalize-product.mjs`

Script chuẩn hóa dữ liệu sản phẩm.

Chức năng:

- Làm sạch tên sản phẩm.
- Bỏ dấu tiếng Việt.
- Loại bỏ từ quảng cáo gây nhiễu.
- Chuẩn hóa giá tiền.
- Tách giá bán hiện tại.
- Tách giá gốc nếu có.
- Tách thương hiệu.
- Tách SKU/model.
- Tách series nếu có.

Ví dụ:

```txt
[CHÍNH HÃNG] Khoá Thông Minh Bosch FU8+ | Khoá Cửa Bosch FU8+ Đen Nâu đồng
```

Sau khi chuẩn hóa:

```json
{
  "brand": "Bosch",
  "sku": "FU8+",
  "normalizedName": "khoa thong minh bosch fu8 khoa cua bosch fu8 den nau dong"
}
```

---

### `scripts/match-products.mjs`

Script so khớp sản phẩm giữa website của bạn và Bếp Ngọc Bảo.

Thuật toán khớp nhiều lớp:

#### Lớp 1: Khớp chắc chắn

```txt
Cùng brand + cùng SKU/model
```

#### Lớp 2: Khớp tương đối chắc

```txt
Cùng SKU/model nhưng một bên thiếu brand
```

#### Lớp 3: Khớp mờ độ chính xác cao

```txt
Jaccard similarity >= 86%
```

#### Lớp 4: Khớp nghi ngờ

```txt
Jaccard similarity từ 70% đến 85%
```

Các sản phẩm khớp nghi ngờ sẽ được đưa vào báo cáo riêng để kiểm tra thủ công.

---

### `scripts/export-report.mjs`

Script xuất báo cáo.

Đầu ra gồm:

```txt
reports/compare_result.xlsx
reports/compare_result.csv
reports/cheaper_than_bepngocbao.csv
reports/more_expensive_than_bepngocbao.csv
reports/missing_in_my_site.csv
reports/missing_in_bepngocbao.csv
reports/uncertain_match.csv
```

File Excel nên chia nhiều sheet:

```txt
Tat ca so sanh
Ben minh re hon
Ben minh dat hon
Bang gia
Thieu ben minh
Thieu Bep Ngoc Bao
So khop nghi ngo
```

---

### `scripts/compare-once.mjs`

File chạy chính của toàn bộ quy trình.

Chức năng:

```txt
Đọc URL website của bạn
        ↓
Cào toàn bộ sản phẩm bên bạn
        ↓
Cào toàn bộ sản phẩm từ bepngocbao.vn
        ↓
Lưu raw JSON vào data/
        ↓
Chuẩn hóa dữ liệu
        ↓
So khớp sản phẩm
        ↓
So sánh giá
        ↓
Xuất báo cáo vào reports/
```

Đây là file bạn chạy khi muốn so sánh một lần duy nhất.

---

## 4. File nhập URL cần quét

Tạo hoặc chỉnh file:

```txt
input/my-site-urls.txt
```

Mỗi dòng là một URL danh mục sản phẩm của website bạn.

Ví dụ:

```txt
https://website-cua-ban.vn/collections/all
https://website-cua-ban.vn/collections/bep-tu
https://website-cua-ban.vn/collections/may-hut-mui
https://website-cua-ban.vn/collections/may-rua-bat
```

Không cần nhập link sản phẩm lẻ, chỉ cần nhập link danh mục.

---

## 5. Dữ liệu từ Bếp Ngọc Bảo

Nguồn mặc định:

```txt
https://bepngocbao.vn/collections/all
```

Cấu hình đề xuất:

```js
const BEPNGOCBAO_CONFIG = {
  baseUrl: 'https://bepngocbao.vn',
  startUrl: 'https://bepngocbao.vn/collections/all',
  pageParam: 'page',
  maxPages: 44,
  sourceName: 'bepngocbao'
}
```

Script sẽ tự quét:

```txt
https://bepngocbao.vn/collections/all?page=1
https://bepngocbao.vn/collections/all?page=2
...
https://bepngocbao.vn/collections/all?page=44
```

---

## 6. Trạng thái so sánh

Các trạng thái nên dùng trong báo cáo:

```txt
MATCHED_SAME_PRICE
MATCHED_MY_CHEAPER
MATCHED_MY_MORE_EXPENSIVE
ONLY_IN_MY_SITE
ONLY_IN_BEPNGOCBAO
UNCERTAIN_MATCH
NO_PRICE_TO_COMPARE
```

Ý nghĩa:

| Trạng thái | Ý nghĩa |
|---|---|
| `MATCHED_SAME_PRICE` | Hai bên cùng giá hoặc chênh lệch rất nhỏ |
| `MATCHED_MY_CHEAPER` | Website của bạn rẻ hơn Bếp Ngọc Bảo |
| `MATCHED_MY_MORE_EXPENSIVE` | Website của bạn đắt hơn Bếp Ngọc Bảo |
| `ONLY_IN_MY_SITE` | Sản phẩm chỉ có ở website của bạn |
| `ONLY_IN_BEPNGOCBAO` | Sản phẩm chỉ có ở Bếp Ngọc Bảo |
| `UNCERTAIN_MATCH` | Khớp mờ, cần kiểm tra thủ công |
| `NO_PRICE_TO_COMPARE` | Không đủ dữ liệu giá để so sánh |

---

## 7. Công thức so sánh giá

```js
const diff = myPrice - bepngocbaoPrice
const diffPercent = diff / bepngocbaoPrice * 100
```

Quy tắc:

```txt
myPrice < bepngocbaoPrice  → bên mình rẻ hơn
myPrice > bepngocbaoPrice  → bên mình đắt hơn
myPrice = bepngocbaoPrice  → bằng giá
```

Nên dùng ngưỡng sai số nhỏ:

```txt
Nếu chênh lệch dưới 1,000đ thì xem như bằng giá.
```

---

## 8. Cấu hình `package.json`

Nên có các script sau:

```json
{
  "scripts": {
    "start": "node server.js",
    "compare:once": "node scripts/compare-once.mjs",
    "scrape:site": "node scripts/scrape-site.mjs",
    "check": "node --check lib/scraper-core.js"
  }
}
```

Dependency đề xuất:

```json
{
  "dependencies": {
    "@sparticuz/chromium": "latest",
    "cheerio": "latest",
    "puppeteer-core": "latest",
    "xlsx": "latest"
  }
}
```

---

## 9. Cách chạy

Cài thư viện:

```bash
npm install
```

Nhập URL danh mục bên bạn vào:

```txt
input/my-site-urls.txt
```

Chạy so sánh một lần:

```bash
npm run compare:once
```

Sau khi chạy xong, mở báo cáo tại:

```txt
reports/compare_result.xlsx
```

---

## 10. Quy trình hoạt động đầy đủ

```txt
input/my-site-urls.txt
        ↓
scripts/compare-once.mjs
        ↓
scripts/scrape-site.mjs
        ↓
lib/scraper-core.js
        ↓
data/raw-my-site.json
data/raw-bepngocbao.json
        ↓
scripts/normalize-product.mjs
        ↓
data/normalized-my-site.json
data/normalized-bepngocbao.json
        ↓
scripts/match-products.mjs
        ↓
scripts/export-report.mjs
        ↓
reports/compare_result.xlsx
```

---

## 11. Gợi ý kiểm tra sau khi chạy

Sau khi có báo cáo, nên kiểm tra theo thứ tự:

1. Mở sheet `So khop nghi ngo` trước để loại các sản phẩm match sai.
2. Kiểm tra sheet `Ben minh dat hon` để biết sản phẩm cần điều chỉnh giá.
3. Kiểm tra sheet `Thieu ben minh` để biết sản phẩm đối thủ có mà bên bạn chưa có.
4. Kiểm tra sheet `Thieu Bep Ngoc Bao` để biết sản phẩm bên bạn có nhưng đối thủ chưa có.
5. Kiểm tra sheet `Bang gia` để xem toàn bộ chênh lệch.

---

## 12. Ghi chú triển khai

- Dashboard web vẫn dùng được như cũ.
- CLI so sánh một lần chạy độc lập với dashboard.
- Không nên chạy quy trình so sánh lớn trên Netlify Function vì dễ timeout.
- Nên chạy `npm run compare:once` trên máy local hoặc VPS.
- Dữ liệu raw được lưu trong `data/` để dễ debug.
- Báo cáo cuối cùng nằm trong `reports/`.

---

## 13. Lệnh Git sau khi cập nhật

```bash
git add .
git commit -m "add one-time product comparison with bepngocbao"
git push
```

---

## 14. Tóm tắt

Cấu trúc mới giúp dự án có hai chế độ hoạt động:

```txt
1. Dashboard web:
   Dùng để cào thủ công, test URL, xuất dữ liệu nhanh.

2. CLI compare-once:
   Dùng để quét toàn bộ website của bạn và so sánh giá với bepngocbao.vn một lần duy nhất.
```

Hướng này giữ nguyên dashboard cũ, đồng thời bổ sung bộ xử lý offline mạnh hơn để phục vụ bài toán so sánh dữ liệu sản phẩm quy mô lớn.
