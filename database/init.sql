-- =============================================================
--  IMS — Inventory Management System
--  Database Initialization Script  (V2 — SKU Variants)
--  PostgreSQL 15
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
--  TABLE: users
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  username    VARCHAR(50)  NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  fullname    VARCHAR(100) NOT NULL,
  role        VARCHAR(10)  NOT NULL DEFAULT 'staff' CHECK (role IN ('admin','staff')),
  status      VARCHAR(10)  NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at  DATE         NOT NULL DEFAULT CURRENT_DATE
);

-- =============================================================
--  TABLE: products
--  parent_sku: nếu NULL → sản phẩm cha (nhóm SKU)
--              nếu có giá trị → sản phẩm con (biến thể / phiên bản)
-- =============================================================
CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  sku         VARCHAR(50)   NOT NULL UNIQUE,
  parent_sku  VARCHAR(50)   DEFAULT NULL REFERENCES products(sku) ON DELETE CASCADE,
  name        VARCHAR(200)  NOT NULL,
  category    VARCHAR(100)  NOT NULL,
  description TEXT          DEFAULT '',
  price       NUMERIC(15,0) NOT NULL CHECK (price >= 0),
  stock       INTEGER       NOT NULL DEFAULT 0 CHECK (stock >= 0),
  threshold   INTEGER       NOT NULL DEFAULT 10,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- =============================================================
--  TABLE: transactions
-- =============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id          SERIAL PRIMARY KEY,
  product_id  INTEGER       NOT NULL REFERENCES products(id),
  type        VARCHAR(10)   NOT NULL CHECK (type IN ('import','export')),
  qty         INTEGER       NOT NULL CHECK (qty > 0),
  note        TEXT          DEFAULT '',
  username    VARCHAR(50)   NOT NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- =============================================================
--  TABLE: audit_log
-- =============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id          SERIAL PRIMARY KEY,
  username    VARCHAR(50)  NOT NULL,
  action      VARCHAR(30)  NOT NULL,
  target      VARCHAR(200) NOT NULL,
  detail      TEXT         DEFAULT '',
  ip          VARCHAR(50)  DEFAULT '127.0.0.1',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =============================================================
--  INDEXES
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_products_sku        ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_parent_sku ON products(parent_sku);
CREATE INDEX IF NOT EXISTS idx_products_category   ON products(category);
CREATE INDEX IF NOT EXISTS idx_transactions_pid    ON transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type   ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_time   ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_time          ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user          ON audit_log(username);

-- =============================================================
--  TRIGGER: auto-update updated_at on products
-- =============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================
--  SEED DATA: users
-- =============================================================
INSERT INTO users (id, username, password, fullname, role, status, created_at) VALUES
  (1, 'admin',   '$2b$10$iVL2of/YdHdSlHRvN7GbHezLCWh4Ks2UH/x.qqxvWLe2U.2rLZOva', 'Nguyễn Quản Trị', 'admin', 'active',   '2024-01-15'),
  (2, 'staff',   '$2b$10$7lBgltCukeDGOy97RoAD5exJ4DVAJq4VPJmfWwhIQAW3vQT4gb0sW', 'Trần Nhân Viên',   'staff', 'active',   '2024-02-01'),
  (3, 'kho1',    '$2b$10$qxn3nHcNaYvDeaPTVfAHjuf3UlwHfcgQ5vaUoZmvFEF9/GAn0KDcq', 'Lê Văn Kho',        'staff', 'active',   '2024-03-10'),
  (4, 'kho2',    '$2b$10$azzEVbir7laWi7lIIvd6G.CbQa5vhxsnN7PgegEUuBX7WCX5n27aG', 'Phạm Thị Hoa',      'staff', 'inactive', '2024-04-05'),
  (5, 'manager', '$2b$10$3DJKxgY.Qc47ZwdKORKdHO2j28Zkn2I7VePaTZINZ.tXslyzUr0Dq', 'Hoàng Quản Lý',     'admin', 'active',   '2024-05-20')
ON CONFLICT (username) DO UPDATE
  SET password = EXCLUDED.password,
      fullname = EXCLUDED.fullname,
      role     = EXCLUDED.role,
      status   = EXCLUDED.status;

SELECT setval('users_id_seq', 6);

-- =============================================================
--  SEED DATA: products
--
--  Cấu trúc phân cấp:
--  SKU-DXPS   → Dell XPS (nhóm cha)
--    SKU-DXPS-01  → Dell XPS 15 i5 / 16GB / 512GB
--    SKU-DXPS-02  → Dell XPS 15 i7 / 16GB / 512GB
--    SKU-DXPS-03  → Dell XPS 15 i9 / 32GB / 1TB
--    SKU-DXPS-04  → Dell XPS 13 i7 / 16GB / 512GB
--
--  SKU-MBP    → MacBook Pro (nhóm cha)
--    SKU-MBP-01   → MacBook Pro 14" M3 / 18GB / 512GB
--    SKU-MBP-02   → MacBook Pro 14" M3 Pro / 36GB / 1TB
--    SKU-MBP-03   → MacBook Pro 16" M3 Max / 48GB / 1TB
--
--  SKU-IP15   → iPhone 15 (nhóm cha)
--    SKU-IP15-01  → iPhone 15 128GB Black
--    SKU-IP15-02  → iPhone 15 256GB Blue
--    SKU-IP15-03  → iPhone 15 Pro 256GB Titanium
--    SKU-IP15-04  → iPhone 15 Pro Max 256GB Titanium
--    SKU-IP15-05  → iPhone 15 Pro Max 512GB Titanium
--
--  SKU-SS24   → Samsung Galaxy S24 (nhóm cha)
--    SKU-SS24-01  → S24 128GB Phantom Black
--    SKU-SS24-02  → S24 256GB Marble Gray
--    SKU-SS24-03  → S24+ 256GB Cobalt Violet
--    SKU-SS24-04  → S24 Ultra 256GB Titanium Violet
--    SKU-SS24-05  → S24 Ultra 512GB Titanium Yellow
--
--  SKU-IPAD   → iPad (nhóm cha)
--    SKU-IPAD-01  → iPad Air 11" M2 128GB WiFi
--    SKU-IPAD-02  → iPad Air 11" M2 256GB WiFi
--    SKU-IPAD-03  → iPad Air 13" M2 256GB WiFi
--    SKU-IPAD-04  → iPad Pro 11" M4 256GB WiFi
--    SKU-IPAD-05  → iPad Mini 7 128GB WiFi
--
--  SKU-SONY   → Sony Headphones (nhóm cha)
--    SKU-SONY-01  → WH-1000XM5 Đen
--    SKU-SONY-02  → WH-1000XM5 Bạc
--    SKU-SONY-03  → WF-1000XM5 (In-ear)
--
--  SKU-LOGI   → Logitech (nhóm cha)
--    SKU-LOGI-01  → MX Master 3S Đen
--    SKU-LOGI-02  → MX Master 3S Graphite
--    SKU-LOGI-03  → MX Keys S (Bàn phím)
--    SKU-LOGI-04  → MX Mechanical Mini
--
--  SKU-KEY    → Keychron (nhóm cha)
--    SKU-KEY-01   → K2 V2 Brown Switch
--    SKU-KEY-02   → K2 V2 Red Switch
--    SKU-KEY-03   → Q1 Pro Brown Switch (TKL)
--    SKU-KEY-04   → K8 Pro Blue Switch
--
--  SKU-LGM    → Màn hình LG (nhóm cha)
--    SKU-LGM-01   → 27UP850 27" 4K IPS
--    SKU-LGM-02   → 32UN880 32" 4K Ergo
--    SKU-LGM-03   → 24MK430H 24" FHD IPS
--
--  SKU-SSD    → SSD Samsung (nhóm cha)
--    SKU-SSD-01   → 870 EVO 500GB SATA
--    SKU-SSD-02   → 870 EVO 1TB SATA
--    SKU-SSD-03   → 970 EVO Plus 1TB NVMe
--    SKU-SSD-04   → 990 Pro 2TB NVMe
--
--  SKU-RAM    → RAM Kingston (nhóm cha)
--    SKU-RAM-01   → Fury Beast 8GB DDR4 3200MHz
--    SKU-RAM-02   → Fury Beast 16GB DDR5 5200MHz
--    SKU-RAM-03   → Fury Beast 32GB DDR5 5600MHz
--
--  SKU-VPP    → Văn phòng phẩm (nhóm cha - ko phân cấp)
--  SKU-FOOD   → Thực phẩm (nhóm cha - ko phân cấp)
--  SKU-FURN   → Nội thất (nhóm cha - ko phân cấp)
-- =============================================================

-- ─── NHÓM CHA: Dell XPS ──────────────────────────────────────
INSERT INTO products (id, sku, parent_sku, name, category, description, price, stock, threshold) VALUES
  (1,  'SKU-DXPS',    NULL,         'Dell XPS Series',             'Điện tử', 'Dòng laptop cao cấp Dell XPS - nhiều cấu hình', 0, 0, 0),
  (2,  'SKU-DXPS-01', 'SKU-DXPS',  'Dell XPS 15 i5 / 16GB / 512GB', 'Điện tử', 'Laptop Dell XPS 15 9530, Intel Core i5-13500H, 16GB RAM DDR5, 512GB NVMe SSD, 15.6" OLED Touch', 26900000, 18, 5),
  (3,  'SKU-DXPS-02', 'SKU-DXPS',  'Dell XPS 15 i7 / 16GB / 512GB', 'Điện tử', 'Laptop Dell XPS 15 9530, Intel Core i7-13700H, 16GB RAM DDR5, 512GB NVMe SSD, 15.6" OLED Touch, RTX 4060', 32500000, 24, 5),
  (4,  'SKU-DXPS-03', 'SKU-DXPS',  'Dell XPS 15 i9 / 32GB / 1TB',  'Điện tử', 'Laptop Dell XPS 15 9530, Intel Core i9-13900H, 32GB RAM DDR5, 1TB NVMe SSD, 15.6" 3.5K OLED, RTX 4070', 46500000, 10, 3),
  (5,  'SKU-DXPS-04', 'SKU-DXPS',  'Dell XPS 13 i7 / 16GB / 512GB','Điện tử', 'Laptop Dell XPS 13 9340, Intel Core i7-1360P, 16GB LPDDR5, 512GB SSD, 13.4" FHD+ IPS', 28900000, 15, 5)
ON CONFLICT (sku) DO NOTHING;

-- ─── NHÓM CHA: MacBook Pro ───────────────────────────────────
INSERT INTO products (id, sku, parent_sku, name, category, description, price, stock, threshold) VALUES
  (6,  'SKU-MBP',     NULL,        'MacBook Pro Series',          'Điện tử', 'Dòng MacBook Pro chip M3 - chuyên nghiệp sáng tạo', 0, 0, 0),
  (7,  'SKU-MBP-01',  'SKU-MBP',  'MacBook Pro 14" M3 / 18GB / 512GB',  'Điện tử', 'Apple MacBook Pro 14 inch chip M3, 18GB RAM, 512GB SSD, Màn hình Liquid Retina XDR', 42900000, 20, 5),
  (8,  'SKU-MBP-02',  'SKU-MBP',  'MacBook Pro 14" M3 Pro / 36GB / 1TB','Điện tử', 'Apple MacBook Pro 14 inch chip M3 Pro 11-core, 36GB RAM, 1TB SSD', 54900000, 12, 3),
  (9,  'SKU-MBP-03',  'SKU-MBP',  'MacBook Pro 16" M3 Max / 48GB / 1TB','Điện tử', 'Apple MacBook Pro 16 inch chip M3 Max 14-core, 48GB RAM, 1TB SSD, Màn hình 16.2" Liquid Retina XDR', 89900000, 6, 2)
ON CONFLICT (sku) DO NOTHING;

-- ─── NHÓM CHA: iPhone 15 ─────────────────────────────────────
INSERT INTO products (id, sku, parent_sku, name, category, description, price, stock, threshold) VALUES
  (10, 'SKU-IP15',    NULL,        'iPhone 15 Series',            'Điện tử', 'Dòng iPhone 15 - chip A16 / A17 Pro Bionic', 0, 0, 0),
  (11, 'SKU-IP15-01', 'SKU-IP15', 'iPhone 15 128GB Black',        'Điện tử', 'Apple iPhone 15 128GB màu đen, chip A16 Bionic, camera 48MP', 21900000, 35, 10),
  (12, 'SKU-IP15-02', 'SKU-IP15', 'iPhone 15 256GB Blue',         'Điện tử', 'Apple iPhone 15 256GB màu xanh dương, chip A16 Bionic, camera 48MP', 24900000, 28, 8),
  (13, 'SKU-IP15-03', 'SKU-IP15', 'iPhone 15 Pro 256GB Titanium', 'Điện tử', 'Apple iPhone 15 Pro 256GB Titanium tự nhiên, chip A17 Pro, Dynamic Island, Action Button', 29900000, 40, 10),
  (14, 'SKU-IP15-04', 'SKU-IP15', 'iPhone 15 Pro Max 256GB Titanium','Điện tử','Apple iPhone 15 Pro Max 256GB Titanium đen, chip A17 Pro, camera Tetraprism 5x zoom', 33900000, 22, 8),
  (15, 'SKU-IP15-05', 'SKU-IP15', 'iPhone 15 Pro Max 512GB Titanium','Điện tử','Apple iPhone 15 Pro Max 512GB Titanium trắng, chip A17 Pro, camera Tetraprism 5x zoom', 38900000, 14, 5)
ON CONFLICT (sku) DO NOTHING;

-- ─── NHÓM CHA: Samsung Galaxy S24 ───────────────────────────
INSERT INTO products (id, sku, parent_sku, name, category, description, price, stock, threshold) VALUES
  (16, 'SKU-SS24',    NULL,        'Samsung Galaxy S24 Series',   'Điện tử', 'Dòng Galaxy S24 - Snapdragon 8 Gen 3, AI tích hợp Galaxy AI', 0, 0, 0),
  (17, 'SKU-SS24-01', 'SKU-SS24', 'Samsung S24 128GB Phantom Black', 'Điện tử', 'Samsung Galaxy S24 128GB Phantom Black, Snapdragon 8 Gen 3, 6.2" Dynamic AMOLED 2X 120Hz', 19990000, 30, 8),
  (18, 'SKU-SS24-02', 'SKU-SS24', 'Samsung S24 256GB Marble Gray',   'Điện tử', 'Samsung Galaxy S24 256GB Marble Gray, 6.2" Dynamic AMOLED 2X 120Hz, camera 50MP', 22990000, 25, 8),
  (19, 'SKU-SS24-03', 'SKU-SS24', 'Samsung S24+ 256GB Cobalt Violet','Điện tử', 'Samsung Galaxy S24+ 256GB Cobalt Violet, 6.7" Dynamic AMOLED 2X 120Hz', 27990000, 18, 5),
  (20, 'SKU-SS24-04', 'SKU-SS24', 'Samsung S24 Ultra 256GB Titanium','Điện tử', 'Samsung Galaxy S24 Ultra 256GB Titanium Violet, 6.8" AMOLED, S-Pen, zoom 100x Space', 28990000, 20, 5),
  (21, 'SKU-SS24-05', 'SKU-SS24', 'Samsung S24 Ultra 512GB Titanium Yellow','Điện tử','Samsung Galaxy S24 Ultra 512GB Titanium Yellow, 6.8" AMOLED 2X, S-Pen tích hợp', 32990000, 12, 3)
ON CONFLICT (sku) DO NOTHING;

-- ─── NHÓM CHA: iPad ──────────────────────────────────────────
INSERT INTO products (id, sku, parent_sku, name, category, description, price, stock, threshold) VALUES
  (22, 'SKU-IPAD',    NULL,        'iPad Series',                 'Điện tử', 'Dòng iPad - Air / Pro / Mini chip M2/M4', 0, 0, 0),
  (23, 'SKU-IPAD-01', 'SKU-IPAD', 'iPad Air 11" M2 128GB WiFi',  'Điện tử', 'Apple iPad Air 11 inch M2 chip, 128GB WiFi, màn hình Liquid Retina', 15900000, 25, 8),
  (24, 'SKU-IPAD-02', 'SKU-IPAD', 'iPad Air 11" M2 256GB WiFi',  'Điện tử', 'Apple iPad Air 11 inch M2 chip, 256GB WiFi, hỗ trợ Apple Pencil Pro', 18900000, 20, 5),
  (25, 'SKU-IPAD-03', 'SKU-IPAD', 'iPad Air 13" M2 256GB WiFi',  'Điện tử', 'Apple iPad Air 13 inch M2 chip, 256GB WiFi, màn hình 13" Liquid Retina', 23900000, 12, 3),
  (26, 'SKU-IPAD-04', 'SKU-IPAD', 'iPad Pro 11" M4 256GB WiFi',  'Điện tử', 'Apple iPad Pro 11 inch M4 chip, 256GB WiFi, Ultra Retina XDR OLED, mỏng nhất thế giới', 31900000, 10, 3),
  (27, 'SKU-IPAD-05', 'SKU-IPAD', 'iPad Mini 7 128GB WiFi',      'Điện tử', 'Apple iPad Mini 7th gen, 128GB WiFi, chip A17 Pro, 8.3" Liquid Retina', 13900000, 18, 5)
ON CONFLICT (sku) DO NOTHING;

-- ─── NHÓM CHA: Sony Headphones ───────────────────────────────
INSERT INTO products (id, sku, parent_sku, name, category, description, price, stock, threshold) VALUES
  (28, 'SKU-SONY',    NULL,        'Sony Headphones Series',      'Phụ kiện', 'Dòng tai nghe Sony chống ồn cao cấp WH / WF', 0, 0, 0),
  (29, 'SKU-SONY-01', 'SKU-SONY', 'Sony WH-1000XM5 Đen',         'Phụ kiện', 'Tai nghe over-ear Sony WH-1000XM5 màu đen, chống ồn hàng đầu, Bluetooth 5.2, 30h pin', 6990000, 45, 15),
  (30, 'SKU-SONY-02', 'SKU-SONY', 'Sony WH-1000XM5 Bạc',         'Phụ kiện', 'Tai nghe over-ear Sony WH-1000XM5 màu bạc (Platinum Silver), chống ồn ANC', 6990000, 32, 10),
  (31, 'SKU-SONY-03', 'SKU-SONY', 'Sony WF-1000XM5 (In-ear)',    'Phụ kiện', 'Tai nghe in-ear Sony WF-1000XM5, chống ồn tốt nhất phân khúc, aptX Adaptive, 8h+16h pin', 5990000, 28, 10)
ON CONFLICT (sku) DO NOTHING;

-- ─── NHÓM CHA: Logitech ──────────────────────────────────────
INSERT INTO products (id, sku, parent_sku, name, category, description, price, stock, threshold) VALUES
  (32, 'SKU-LOGI',    NULL,        'Logitech MX Series',          'Phụ kiện', 'Dòng sản phẩm Logitech MX - chuột và bàn phím cao cấp', 0, 0, 0),
  (33, 'SKU-LOGI-01', 'SKU-LOGI', 'Logitech MX Master 3S Đen',   'Phụ kiện', 'Chuột không dây Logitech MX Master 3S màu đen, scroll MagSpeed, 8000 DPI, Bluetooth + USB', 1890000, 75, 20),
  (34, 'SKU-LOGI-02', 'SKU-LOGI', 'Logitech MX Master 3S Graphite','Phụ kiện','Chuột không dây Logitech MX Master 3S màu Graphite, scroll MagSpeed, kết nối đa thiết bị', 1890000, 50, 15),
  (35, 'SKU-LOGI-03', 'SKU-LOGI', 'Logitech MX Keys S',          'Phụ kiện', 'Bàn phím không dây Logitech MX Keys S, đèn nền thông minh, kết nối 3 thiết bị, Bluetooth', 2490000, 40, 10),
  (36, 'SKU-LOGI-04', 'SKU-LOGI', 'Logitech MX Mechanical Mini', 'Phụ kiện', 'Bàn phím cơ compact Logitech MX Mechanical Mini, Tactile Quiet switch, đèn RGB', 2890000, 30, 10)
ON CONFLICT (sku) DO NOTHING;

-- ─── NHÓM CHA: Keychron ──────────────────────────────────────
INSERT INTO products (id, sku, parent_sku, name, category, description, price, stock, threshold) VALUES
  (37, 'SKU-KEY',     NULL,        'Keychron Series',             'Phụ kiện', 'Dòng bàn phím cơ Keychron - hotswap, wireless', 0, 0, 0),
  (38, 'SKU-KEY-01',  'SKU-KEY',  'Keychron K2 V2 Brown Switch', 'Phụ kiện', 'Bàn phím cơ Keychron K2 V2 Hotswap, Gateron Brown switch, RGB, TKL 75%', 2390000, 35, 10),
  (39, 'SKU-KEY-02',  'SKU-KEY',  'Keychron K2 V2 Red Switch',   'Phụ kiện', 'Bàn phím cơ Keychron K2 V2 Hotswap, Gateron Red switch (linear), RGB, TKL 75%', 2390000, 25, 8),
  (40, 'SKU-KEY-03',  'SKU-KEY',  'Keychron Q1 Pro Brown Switch','Phụ kiện', 'Bàn phím cơ Keychron Q1 Pro, vỏ nhôm CNC, Gateron G-Pro Brown, gasket mount', 4290000, 15, 5),
  (41, 'SKU-KEY-04',  'SKU-KEY',  'Keychron K8 Pro Blue Switch', 'Phụ kiện', 'Bàn phím cơ Keychron K8 Pro Hotswap TKL, Gateron Blue switch (clicky), RGB', 2690000, 20, 8)
ON CONFLICT (sku) DO NOTHING;

-- ─── NHÓM CHA: Màn hình LG ───────────────────────────────────
INSERT INTO products (id, sku, parent_sku, name, category, description, price, stock, threshold) VALUES
  (42, 'SKU-LGM',     NULL,        'LG Monitor Series',           'Điện tử', 'Dòng màn hình LG 4K / FHD IPS cho văn phòng và sáng tạo', 0, 0, 0),
  (43, 'SKU-LGM-01',  'SKU-LGM', 'LG 27UP850 27" 4K IPS',        'Điện tử', 'Màn hình LG 27UP850 27 inch 4K IPS, HDR400, USB-C 96W, 5ms, sRGB 95%', 14500000, 18, 5),
  (44, 'SKU-LGM-02',  'SKU-LGM', 'LG 32UN880 32" 4K Ergo',       'Điện tử', 'Màn hình LG 32UN880 32 inch 4K IPS, chân Ergo linh hoạt, USB-C, thiết kế mỏng', 19900000, 10, 3),
  (45, 'SKU-LGM-03',  'SKU-LGM', 'LG 24MK430H 24" FHD IPS',      'Điện tử', 'Màn hình LG 24MK430H 24 inch FHD IPS, AMD FreeSync, 5ms, sRGB 99%, giá tốt', 3990000, 30, 8)
ON CONFLICT (sku) DO NOTHING;

-- ─── NHÓM CHA: SSD Samsung ───────────────────────────────────
INSERT INTO products (id, sku, parent_sku, name, category, description, price, stock, threshold) VALUES
  (46, 'SKU-SSD',     NULL,        'Samsung SSD Series',          'Điện tử', 'Dòng ổ cứng SSD Samsung SATA và NVMe', 0, 0, 0),
  (47, 'SKU-SSD-01',  'SKU-SSD', 'Samsung 870 EVO 500GB SATA',   'Điện tử', 'SSD SATA III Samsung 870 EVO 500GB, tốc độ đọc 560MB/s ghi 530MB/s, 2.5 inch', 1290000, 55, 15),
  (48, 'SKU-SSD-02',  'SKU-SSD', 'Samsung 870 EVO 1TB SATA',     'Điện tử', 'SSD SATA III Samsung 870 EVO 1TB, tốc độ đọc 560MB/s ghi 530MB/s, 2.5 inch', 2190000, 40, 10),
  (49, 'SKU-SSD-03',  'SKU-SSD', 'Samsung 970 EVO Plus 1TB NVMe','Điện tử', 'SSD NVMe PCIe 3.0 Samsung 970 EVO Plus 1TB, đọc 3500MB/s, ghi 3300MB/s, M.2 2280', 2590000, 35, 10),
  (50, 'SKU-SSD-04',  'SKU-SSD', 'Samsung 990 Pro 2TB NVMe',     'Điện tử', 'SSD NVMe PCIe 4.0 Samsung 990 Pro 2TB, đọc 7450MB/s, ghi 6900MB/s, M.2 2280', 4890000, 20, 5)
ON CONFLICT (sku) DO NOTHING;

-- ─── NHÓM CHA: RAM Kingston ──────────────────────────────────
INSERT INTO products (id, sku, parent_sku, name, category, description, price, stock, threshold) VALUES
  (51, 'SKU-RAM',     NULL,        'Kingston Fury RAM Series',    'Điện tử', 'Dòng RAM Kingston Fury Beast DDR4/DDR5 gaming và văn phòng', 0, 0, 0),
  (52, 'SKU-RAM-01',  'SKU-RAM', 'Kingston Fury Beast 8GB DDR4',  'Điện tử', 'RAM DDR4 Kingston Fury Beast 8GB 3200MHz, tản nhiệt thấp, XMP 2.0, màu đen', 650000, 80, 20),
  (53, 'SKU-RAM-02',  'SKU-RAM', 'Kingston Fury Beast 16GB DDR5', 'Điện tử', 'RAM DDR5 Kingston Fury Beast 16GB 5200MHz, CL40, tản nhiệt thấp profile', 1650000, 45, 12),
  (54, 'SKU-RAM-03',  'SKU-RAM', 'Kingston Fury Beast 32GB DDR5', 'Điện tử', 'RAM DDR5 Kingston Fury Beast 32GB 5600MHz, CL36, Intel XMP 3.0 / AMD EXPO', 3200000, 20, 8)
ON CONFLICT (sku) DO NOTHING;

-- ─── NHÓM CHA: Webcam Logitech ───────────────────────────────
INSERT INTO products (id, sku, parent_sku, name, category, description, price, stock, threshold) VALUES
  (55, 'SKU-WEB',     NULL,        'Webcam Series',               'Phụ kiện', 'Dòng webcam Logitech cho văn phòng và streaming', 0, 0, 0),
  (56, 'SKU-WEB-01',  'SKU-WEB', 'Logitech C920 HD 1080p',       'Phụ kiện', 'Webcam Logitech C920 Full HD 1080p 30fps, autofocus, stereo mic, tương thích đa nền tảng', 1650000, 55, 15),
  (57, 'SKU-WEB-02',  'SKU-WEB', 'Logitech C922 Pro 1080p/60fps','Phụ kiện', 'Webcam Logitech C922 Pro 1080p/60fps, xóa phông tự động, streaming chuyên nghiệp', 2290000, 30, 10),
  (58, 'SKU-WEB-03',  'SKU-WEB', 'Logitech Brio 4K Ultra HD',    'Phụ kiện', 'Webcam Logitech Brio 4K, HDR, Windows Hello, zoom 5x, USB-C, lý tưởng cho cuộc gọi quan trọng', 4290000, 15, 5)
ON CONFLICT (sku) DO NOTHING;

-- ─── NHÓM CHA: Hub / Phụ kiện kết nối ───────────────────────
INSERT INTO products (id, sku, parent_sku, name, category, description, price, stock, threshold) VALUES
  (59, 'SKU-HUB',     NULL,        'USB Hub & Adapter Series',    'Phụ kiện', 'Dòng hub USB-C và adapter đa năng Anker, Ugreen', 0, 0, 0),
  (60, 'SKU-HUB-01',  'SKU-HUB', 'Anker 7in1 Hub A8346',         'Phụ kiện', 'Hub USB-C 7in1 Anker A8346, HDMI 4K, USB3.0 x2, SD/TF, PD 85W sạc ngược', 890000, 44, 10),
  (61, 'SKU-HUB-02',  'SKU-HUB', 'Ugreen 10in1 Hub USB-C',       'Phụ kiện', 'Hub USB-C 10in1 Ugreen, HDMI 4K@60Hz, 3xUSB3.0, SD/TF, RJ45 1Gbps, PD 100W', 1290000, 32, 10),
  (62, 'SKU-HUB-03',  'SKU-HUB', 'Cáp HDMI 4K Ugreen 2m',       'Phụ kiện', 'Cáp HDMI 2.0 Ugreen 4K@60Hz dài 2 mét, bọc nylon chống đứt gãy', 185000, 150, 30),
  (63, 'SKU-HUB-04',  'SKU-HUB', 'Cáp USB-C to USB-C 1m Anker', 'Phụ kiện', 'Cáp sạc nhanh Anker USB-C 240W, 1 mét, bọc nylon, hỗ trợ PD3.1', 290000, 120, 30)
ON CONFLICT (sku) DO NOTHING;

-- ─── Văn phòng phẩm (không phân cấp con) ─────────────────────
INSERT INTO products (id, sku, parent_sku, name, category, description, price, stock, threshold) VALUES
  (64, 'SKU-VPP-001', NULL, 'Giấy A4 Double A 80gsm',         'Văn phòng phẩm', 'Giấy in A4 Double A 80gsm - 500 tờ/ram, trắng sáng, chuẩn ISO',                 95000, 350, 50),
  (65, 'SKU-VPP-002', NULL, 'Giấy A3 IK Plus 80gsm',          'Văn phòng phẩm', 'Giấy in A3 IK Plus 80gsm - 500 tờ/ram, phù hợp in poster, tài liệu lớn',       185000, 120, 30),
  (66, 'SKU-VPP-003', NULL, 'Mực in Canon PG-745 Đen',        'Văn phòng phẩm', 'Hộp mực in Canon PG-745 màu đen, dùng cho Canon MG2570S, IP2870',              185000,   7, 15),
  (67, 'SKU-VPP-004', NULL, 'Mực in Canon CL-746 Màu',        'Văn phòng phẩm', 'Hộp mực in Canon CL-746 màu (CMY), dùng cho Canon MG2570S, IP2870',            225000,   5, 10),
  (68, 'SKU-VPP-005', NULL, 'Bút bi Thiên Long TL-027 xanh',  'Văn phòng phẩm', 'Bút bi Thiên Long TL-027 mực xanh - hộp 20 cái, ngòi 0.8mm',                   45000, 180, 30),
  (69, 'SKU-VPP-006', NULL, 'Bút bi Thiên Long TL-027 đỏ',   'Văn phòng phẩm', 'Bút bi Thiên Long TL-027 mực đỏ - hộp 20 cái, ngòi 0.8mm',                    45000, 120, 20),
  (70, 'SKU-VPP-007', NULL, 'Bìa hồ sơ Thiên Long A4',        'Văn phòng phẩm', 'Bìa hồ sơ nhựa Thiên Long A4, gáy 3cm, hộp 50 cái, màu xanh/đỏ/vàng',        35000, 200, 40),
  (71, 'SKU-VPP-008', NULL, 'Ghim bấm Kangaro 24/6 hộp 1000c','Văn phòng phẩm','Ghim bấm Kangaro 24/6 hộp 1000 cái, thép mạ kẽm chống gỉ',                    25000, 300, 50),
  (72, 'SKU-VPP-009', NULL, 'Băng keo OPP trong 2cm x 50m',   'Văn phòng phẩm', 'Băng keo OPP trong suốt 2cm x 50m - hộp 6 cuộn, dán hộp carton, tài liệu',    65000, 160, 30),
  (73, 'SKU-VPP-010', NULL, 'Sổ tay A5 kẻ ngang 200 trang',   'Văn phòng phẩm', 'Sổ ghi chú A5 bìa cứng kẻ ngang 200 trang, bìa màu ngẫu nhiên',               55000, 250, 40)
ON CONFLICT (sku) DO NOTHING;

-- ─── Thực phẩm / Đồ uống ─────────────────────────────────────
INSERT INTO products (id, sku, parent_sku, name, category, description, price, stock, threshold) VALUES
  (74, 'SKU-FD-001', NULL, 'Nước uống Lavie 19L',              'Thực phẩm', 'Nước khoáng Lavie bình 19 lít, thích hợp bình lọc nước văn phòng',              55000,   5, 20),
  (75, 'SKU-FD-002', NULL, 'Nước uống Aquafina 500ml (24 chai)','Thực phẩm','Thùng 24 chai nước tinh khiết Aquafina 500ml, tiện lợi cho văn phòng',          125000,  40, 15),
  (76, 'SKU-FD-003', NULL, 'Cà phê G7 3in1 hộp 50 gói',       'Thực phẩm', 'Cà phê hòa tan Trung Nguyên G7 3in1 hộp 50 gói, 16g/gói',                      125000,  95, 20),
  (77, 'SKU-FD-004', NULL, 'Cà phê Nescafé Classic hộp 100g', 'Thực phẩm', 'Cà phê hòa tan đen Nescafé Classic hộp 100g, vị đậm đà',                         95000,  60, 20),
  (78, 'SKU-FD-005', NULL, 'Trà Lipton Yellow Label hộp 25 gói','Thực phẩm','Trà đen Lipton Yellow Label hộp 25 túi lọc, hương thơm tự nhiên',                45000,  80, 20),
  (79, 'SKU-FD-006', NULL, 'Mì gói Hảo Hảo thùng 30 gói',    'Thực phẩm', 'Mì ăn liền Hảo Hảo tôm chua cay thùng 30 gói 75g, tiện cho bữa nhanh',           95000,  50, 15),
  (80, 'SKU-FD-007', NULL, 'Bánh quy Oreo hộp 390g',          'Thực phẩm', 'Bánh quy Oreo hộp 390g, vị socola kem vanilla, snack văn phòng',                  62000,  70, 20)
ON CONFLICT (sku) DO NOTHING;

-- ─── Nội thất / Gia dụng văn phòng ───────────────────────────
INSERT INTO products (id, sku, parent_sku, name, category, description, price, stock, threshold) VALUES
  (81, 'SKU-FN-001', NULL, 'Ghế xoay Ergohuman Elite',         'Gia dụng', 'Ghế làm việc cao cấp Ergohuman Elite, lưng lưới, tựa đầu, hỗ trợ thắt lưng, tay 4D', 8900000, 12, 3),
  (82, 'SKU-FN-002', NULL, 'Ghế xoay Herman Miller Aeron B',   'Gia dụng', 'Ghế công thái học Herman Miller Aeron size B, vải lưới 8Z Pellicle, tilt limiter', 28000000, 4, 2),
  (83, 'SKU-FN-003', NULL, 'Bàn đứng ngồi điện Flexispot E5',  'Gia dụng', 'Bàn nâng hạ điện Flexispot E5, 3 chân, khung thép, điều chỉnh 60-125cm, memory 4 vị trí', 6500000, 8, 2),
  (84, 'SKU-FN-004', NULL, 'Kệ để màn hình đôi AIERUN',       'Gia dụng', 'Giá đỡ 2 màn hình AIERUN, cánh tay khí nén, kẹp bàn, hỗ trợ VESA 75x75/100x100', 1290000, 20, 5),
  (85, 'SKU-FN-005', NULL, 'Đèn bàn Xiaomi Mi Smart LED',     'Gia dụng', 'Đèn bàn thông minh Xiaomi Mi 1S, điều chỉnh độ sáng/màu sắc, bảo vệ mắt, app điều khiển', 690000, 35, 10)
ON CONFLICT (sku) DO NOTHING;

SELECT setval('products_id_seq', 86);

-- =============================================================
--  SEED DATA: transactions (phong phú hơn với nhiều sản phẩm)
-- =============================================================
INSERT INTO transactions (id, product_id, type, qty, note, username, created_at) VALUES
  -- Dell XPS
  (1,  2,  'import', 20,  'Nhập Dell XPS 15 i5 đầu kỳ',          'admin', NOW() - INTERVAL '45 days'),
  (2,  3,  'import', 30,  'Nhập Dell XPS 15 i7',                  'admin', NOW() - INTERVAL '44 days'),
  (3,  4,  'import', 12,  'Nhập Dell XPS 15 i9 cao cấp',          'kho1',  NOW() - INTERVAL '43 days'),
  (4,  5,  'import', 18,  'Nhập Dell XPS 13 i7',                  'kho1',  NOW() - INTERVAL '42 days'),
  (5,  3,  'export',  6,  'Xuất cho khách VIP - dự án thiết kế',  'staff', NOW() - INTERVAL '40 days'),
  (6,  2,  'export',  2,  'Xuất cho phòng kỹ thuật',              'admin', NOW() - INTERVAL '38 days'),
  -- MacBook Pro
  (7,  7,  'import', 22,  'Nhập MacBook Pro 14" M3',              'admin', NOW() - INTERVAL '35 days'),
  (8,  8,  'import', 14,  'Nhập MacBook Pro 14" M3 Pro',          'admin', NOW() - INTERVAL '34 days'),
  (9,  9,  'import',  8,  'Nhập MacBook Pro 16" M3 Max',          'kho1',  NOW() - INTERVAL '33 days'),
  (10, 7,  'export',  2,  'Xuất cho phòng sáng tạo nội dung',     'staff', NOW() - INTERVAL '30 days'),
  -- iPhone 15
  (11, 11, 'import', 40,  'Nhập iPhone 15 128GB Black',           'admin', NOW() - INTERVAL '28 days'),
  (12, 12, 'import', 32,  'Nhập iPhone 15 256GB Blue',            'admin', NOW() - INTERVAL '27 days'),
  (13, 13, 'import', 48,  'Nhập iPhone 15 Pro 256GB',             'kho1',  NOW() - INTERVAL '26 days'),
  (14, 14, 'import', 25,  'Nhập iPhone 15 Pro Max 256GB',         'kho1',  NOW() - INTERVAL '25 days'),
  (15, 15, 'import', 16,  'Nhập iPhone 15 Pro Max 512GB',         'admin', NOW() - INTERVAL '24 days'),
  (16, 13, 'export',  8,  'Xuất đơn hàng doanh nghiệp tháng 4',  'staff', NOW() - INTERVAL '22 days'),
  (17, 11, 'export',  5,  'Xuất lẻ cho khách',                    'staff', NOW() - INTERVAL '21 days'),
  -- Samsung S24
  (18, 17, 'import', 35,  'Nhập S24 128GB Black',                 'kho1',  NOW() - INTERVAL '20 days'),
  (19, 18, 'import', 28,  'Nhập S24 256GB Gray',                  'kho1',  NOW() - INTERVAL '19 days'),
  (20, 20, 'import', 22,  'Nhập S24 Ultra 256GB',                 'admin', NOW() - INTERVAL '18 days'),
  (21, 21, 'import', 14,  'Nhập S24 Ultra 512GB Yellow',          'admin', NOW() - INTERVAL '17 days'),
  (22, 19, 'export',  3,  'Xuất mẫu trưng bày showroom',          'staff', NOW() - INTERVAL '15 days'),
  -- iPad
  (23, 23, 'import', 28,  'Nhập iPad Air 11" M2 128GB',           'admin', NOW() - INTERVAL '14 days'),
  (24, 24, 'import', 22,  'Nhập iPad Air 11" M2 256GB',           'admin', NOW() - INTERVAL '13 days'),
  (25, 26, 'import', 12,  'Nhập iPad Pro 11" M4',                 'kho1',  NOW() - INTERVAL '12 days'),
  (26, 27, 'import', 20,  'Nhập iPad Mini 7',                     'kho1',  NOW() - INTERVAL '11 days'),
  (27, 23, 'export',  3,  'Xuất cho phòng thiết kế',              'staff', NOW() - INTERVAL '10 days'),
  -- Sony / Logitech / Keychron
  (28, 29, 'import', 50,  'Nhập Sony WH-1000XM5 Đen',            'kho1',  NOW() - INTERVAL '9 days'),
  (29, 30, 'import', 35,  'Nhập Sony WH-1000XM5 Bạc',            'kho1',  NOW() - INTERVAL '9 days'),
  (30, 31, 'import', 30,  'Nhập Sony WF-1000XM5',                'admin', NOW() - INTERVAL '8 days'),
  (31, 33, 'import', 80,  'Nhập Logitech MX Master 3S Đen',      'kho1',  NOW() - INTERVAL '7 days'),
  (32, 34, 'import', 55,  'Nhập Logitech MX Master 3S Graphite', 'kho1',  NOW() - INTERVAL '7 days'),
  (33, 35, 'import', 45,  'Nhập Logitech MX Keys S',             'admin', NOW() - INTERVAL '6 days'),
  (34, 38, 'import', 40,  'Nhập Keychron K2 V2 Brown',           'kho1',  NOW() - INTERVAL '6 days'),
  (35, 39, 'import', 28,  'Nhập Keychron K2 V2 Red',             'kho1',  NOW() - INTERVAL '5 days'),
  (36, 40, 'import', 18,  'Nhập Keychron Q1 Pro',                'admin', NOW() - INTERVAL '5 days'),
  -- Màn hình / SSD / RAM
  (37, 43, 'import', 20,  'Nhập LG 27UP850 4K',                  'admin', NOW() - INTERVAL '4 days'),
  (38, 45, 'import', 35,  'Nhập LG 24MK430H',                    'kho1',  NOW() - INTERVAL '4 days'),
  (39, 47, 'import', 60,  'Nhập SSD Samsung 870 EVO 500GB',      'admin', NOW() - INTERVAL '3 days'),
  (40, 48, 'import', 45,  'Nhập SSD Samsung 870 EVO 1TB',        'admin', NOW() - INTERVAL '3 days'),
  (41, 49, 'import', 40,  'Nhập SSD Samsung 970 EVO Plus 1TB',   'kho1',  NOW() - INTERVAL '2 days'),
  (42, 50, 'import', 22,  'Nhập SSD Samsung 990 Pro 2TB',        'admin', NOW() - INTERVAL '2 days'),
  (43, 52, 'import', 90,  'Nhập RAM Kingston 8GB DDR4',          'kho1',  NOW() - INTERVAL '1 day'),
  (44, 53, 'import', 50,  'Nhập RAM Kingston 16GB DDR5',         'kho1',  NOW() - INTERVAL '1 day'),
  (45, 54, 'export',  6,  'Xuất nâng cấp máy tính văn phòng',    'staff', NOW() - INTERVAL '1 day'),
  -- Văn phòng phẩm / Thực phẩm / Nội thất
  (46, 64, 'import',500,  'Nhập giấy A4 văn phòng quý 2',        'staff', NOW() - INTERVAL '10 days'),
  (47, 64, 'export', 50,  'Xuất giấy cho phòng hành chính',      'staff', NOW() - INTERVAL '8 days'),
  (48, 66, 'export',  3,  'Xuất mực in Canon đen',               'staff', NOW() - INTERVAL '6 days'),
  (49, 74, 'import', 20,  'Nhập nước Lavie văn phòng',           'staff', NOW() - INTERVAL '5 days'),
  (50, 74, 'export', 15,  'Sử dụng trong tháng',                 'staff', NOW() - INTERVAL '3 days'),
  (51, 76, 'import',100,  'Nhập cà phê G7 3in1',                 'kho1',  NOW() - INTERVAL '2 days'),
  (52, 81, 'import', 15,  'Nhập ghế Ergohuman Elite',            'kho1',  NOW() - INTERVAL '1 day'),
  (53, 60, 'import', 50,  'Nhập Hub USB-C Anker 7in1',           'admin', NOW()),
  (54, 56, 'import', 60,  'Nhập Webcam Logitech C920',           'admin', NOW()),
  (55, 29, 'export',  5,  'Xuất tai nghe cho nhân viên từ xa',   'staff', NOW())
ON CONFLICT DO NOTHING;

SELECT setval('transactions_id_seq', 56);

-- =============================================================
--  SEED DATA: audit_log
-- =============================================================
INSERT INTO audit_log (username, action, target, detail, ip, created_at) VALUES
  ('admin', 'IMPORT',      'Dell XPS 15 i7 / 16GB / 512GB',    'Nhập 30 đơn vị',                       '192.168.1.100', NOW() - INTERVAL '44 days'),
  ('kho1',  'IMPORT',      'iPhone 15 Pro 256GB Titanium',      'Nhập 48 đơn vị',                       '192.168.1.102', NOW() - INTERVAL '26 days'),
  ('staff', 'EXPORT',      'iPhone 15 Pro 256GB Titanium',      'Xuất 8 đơn vị đơn hàng doanh nghiệp', '192.168.1.101', NOW() - INTERVAL '22 days'),
  ('admin', 'UPDATE',      'Samsung S24 Ultra 256GB',           'Cập nhật ngưỡng cảnh báo: 5 → 8',     '192.168.1.100', NOW() - INTERVAL '16 days'),
  ('kho1',  'IMPORT',      'Sony WH-1000XM5 Đen',              'Nhập 50 đơn vị',                       '192.168.1.102', NOW() - INTERVAL '9 days'),
  ('admin', 'IMPORT',      'SSD Samsung 990 Pro 2TB',           'Nhập 22 đơn vị',                       '192.168.1.100', NOW() - INTERVAL '2 days'),
  ('kho1',  'IMPORT',      'RAM Kingston Fury Beast 16GB DDR5', 'Nhập 50 đơn vị',                       '192.168.1.102', NOW() - INTERVAL '1 day'),
  ('admin', 'CREATE',      'MacBook Pro 16" M3 Max / 48GB',     'Tạo sản phẩm mới SKU-MBP-03',          '192.168.1.100', NOW() - INTERVAL '33 days'),
  ('admin', 'CREATE',      'iPad Pro 11" M4 256GB WiFi',        'Tạo sản phẩm mới SKU-IPAD-04',         '192.168.1.100', NOW() - INTERVAL '13 days'),
  ('staff', 'EXPORT',      'Ghế Ergohuman Elite',               'Xuất 3 đơn vị cho chi nhánh',          '192.168.1.101', NOW() - INTERVAL '7 days'),
  ('admin', 'CREATE_USER', 'kho2',                              'Tạo tài khoản nhân viên mới',           '192.168.1.100', NOW() - INTERVAL '60 days'),
  ('admin', 'LOGIN',       'Hệ thống',                          'Đăng nhập thành công',                  '192.168.1.100', NOW() - INTERVAL '1 day');
