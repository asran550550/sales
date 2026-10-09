/**
 * RoseCosmetics - Turso LibSQL Edge Database Serverless API
 * Works seamlessly on Vercel Serverless Functions and local Node.js.
 * Connects to Turso cloud SQLite via @libsql/client.
 */

require('dotenv').config();
const { createClient } = require('@libsql/client');

// Initialize Turso Client only if TURSO_DATABASE_URL is provided
const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

let client = null;
if (url && (url.startsWith('libsql://') || url.startsWith('https://'))) {
  try {
    client = createClient({
      url,
      authToken: authToken || undefined
    });
  } catch (err) {
    console.warn('Could not initialize Turso client, falling back to local mode:', err.message);
    client = null;
  }
}

let tablesInitialized = false;

async function ensureTables() {
  if (!client) return;
  if (tablesInitialized) return;

  await client.execute(`
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      category TEXT,
      costPerGram REAL,
      costPerKg REAL,
      stockGrams REAL,
      minStockGrams REAL,
      supplier TEXT,
      notes TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      category TEXT,
      netWeight REAL,
      ingredients TEXT,
      rawMaterialsCost REAL,
      packagingCost REAL,
      laborCost REAL,
      totalCost REAL,
      profitType TEXT,
      profitMargin REAL,
      sellingPrice REAL,
      stockUnits INTEGER,
      minStockUnits INTEGER,
      notes TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS production (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batchNumber TEXT,
      productId INTEGER,
      productName TEXT,
      unitsProduced INTEGER,
      unitCost REAL,
      totalBatchCost REAL,
      date TEXT,
      notes TEXT,
      deductedMaterials TEXT
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoiceNumber TEXT UNIQUE,
      date TEXT,
      customerName TEXT,
      customerPhone TEXT,
      paymentMethod TEXT,
      items TEXT,
      subtotal REAL,
      discount REAL,
      taxAmount REAL,
      total REAL,
      totalCost REAL,
      netProfit REAL,
      status TEXT,
      notes TEXT
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Check if initial settings exist
  const setRes = await client.execute({ sql: "SELECT * FROM settings WHERE key = 'appConfig'", args: [] });
  if (setRes.rows.length === 0) {
    const initialConfig = {
      storeName: 'روز لافندر لمستحضرات التجميل الطبيعية',
      storeSubtitle: 'تصنيع ومبيعات العناية بالبشرة والشعر',
      currency: 'ج.م',
      phone: '01012345678',
      address: 'القاهرة - مصر',
      invoiceFooter: 'شكراً لتعاملكم معنا! جميع منتجاتنا مصنعة يدوياً بمواد طبيعية 100% ومختبرة بأعلى معايير الجودة.',
      taxEnabled: false,
      taxPercentage: 14,
      invoicePrefix: 'INV-',
      nextInvoiceNum: 1001,
      batchPrefix: 'BAT-'
    };
    await client.execute({
      sql: "INSERT INTO settings (key, value) VALUES ('appConfig', ?)",
      args: [JSON.stringify(initialConfig)]
    });
  }

  // Check if empty, seed demo cosmetics data
  const countRes = await client.execute("SELECT COUNT(*) as count FROM materials");
  const count = countRes.rows[0].count;
  if (Number(count) === 0) {
    await seedDemoData();
  }

  tablesInitialized = true;
}

async function seedDemoData() {
  const sampleMaterials = [
    { code: 'RM-001', name: 'زيت الأرغان المغربي النقي', category: 'زيوت طبيعية', costPerGram: 0.45, costPerKg: 450, stockGrams: 3500, minStockGrams: 500, supplier: 'الأندلس للزيوت', notes: 'معصور على البارد، نقي 100%' },
    { code: 'RM-002', name: 'زبدة الشيا الإفريقية العضوية', category: 'زبدة وشموع', costPerGram: 0.18, costPerKg: 180, stockGrams: 5000, minStockGrams: 1000, supplier: 'طيبة للخامات الطبيعية', notes: 'درجة أولى غير مكررة' },
    { code: 'RM-003', name: 'حمض الهيالورونيك (Hyaluronic Acid)', category: 'مواد فعالة', costPerGram: 1.80, costPerKg: 1800, stockGrams: 800, minStockGrams: 150, supplier: 'فارما كوزماتيكس', notes: 'جزيئات متعددة الأوزان' },
    { code: 'RM-004', name: 'فيتامين سي (Ascorbic Acid)', category: 'فيتامينات ومضادات أكسدة', costPerGram: 0.35, costPerKg: 350, stockGrams: 2000, minStockGrams: 300, supplier: 'النيل للمواد الكيميائية', notes: 'نقي 99.5%' },
    { code: 'RM-005', name: 'زيت الجوجوبا الذهبي', category: 'زيوت طبيعية', costPerGram: 0.28, costPerKg: 280, stockGrams: 4000, minStockGrams: 800, supplier: 'واحة الزيوت', notes: 'سريع الامتصاص' },
    { code: 'RM-006', name: 'زيت اللافندر العطري المركز', category: 'زيوت عطرية', costPerGram: 0.95, costPerKg: 950, stockGrams: 1200, minStockGrams: 200, supplier: 'فرنسا للعطور', notes: 'نقي 100%' },
    { code: 'RM-007', name: 'شمع النحل الطبيعي المفلتر', category: 'زبدة وشموع', costPerGram: 0.12, costPerKg: 120, stockGrams: 6000, minStockGrams: 1000, supplier: 'مناحل الوادي', notes: 'أصفر نقي مصفى' },
    { code: 'RM-008', name: 'ماء الورد المقطر النقي', category: 'مائيات ومستخلصات', costPerGram: 0.04, costPerKg: 40, stockGrams: 15000, minStockGrams: 2000, supplier: 'مزارع الورد', notes: 'تقطير بخار ماء الورد البلدي' },
    { code: 'RM-009', name: 'مستحلب شمعي Polawax', category: 'مستحلبات ومثبتات', costPerGram: 0.15, costPerKg: 150, stockGrams: 2500, minStockGrams: 500, supplier: 'كيميكال لاب', notes: 'مستحلب آمن غير أيوني' },
    { code: 'RM-010', name: 'مادة حافظة كوزموجارد (Cosgard)', category: 'مواد حافظة', costPerGram: 0.60, costPerKg: 600, stockGrams: 900, minStockGrams: 200, supplier: 'إيكوسيرت جروب', notes: 'معتمدة عضوياً آمنة للبشرة' },
    { code: 'RM-011', name: 'مستخلص الألوفيرا جل نقي', category: 'مائيات ومستخلصات', costPerGram: 0.08, costPerKg: 80, stockGrams: 8000, minStockGrams: 1000, supplier: 'النباتات الطبية', notes: 'مرطب مهدئ فائق' },
    { code: 'RM-012', name: 'حبيبات السكر البني والمشمش للتقشير', category: 'مقشرات ومساحيق', costPerGram: 0.05, costPerKg: 50, stockGrams: 10000, minStockGrams: 2000, supplier: 'موردي التجميل', notes: 'حبيبات ناعمة لا تخدش البشرة' }
  ];

  for (const m of sampleMaterials) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO materials (code, name, category, costPerGram, costPerKg, stockGrams, minStockGrams, supplier, notes, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [m.code, m.name, m.category, m.costPerGram, m.costPerKg, m.stockGrams, m.minStockGrams, m.supplier, m.notes, new Date().toISOString(), new Date().toISOString()]
    });
  }

  // Get inserted IDs
  const allMatsRes = await client.execute("SELECT * FROM materials");
  const mByCode = {};
  allMatsRes.rows.forEach(r => { mByCode[r.code] = r; });

  const sampleProducts = [
    {
      code: 'PRD-101',
      name: 'سيروم الذهب وفيتامين سي 30 مل',
      category: 'سيروم للبشرة',
      netWeight: 30,
      ingredients: [
        { materialId: mByCode['RM-004'].id, materialName: mByCode['RM-004'].name, grams: 3, costPerGram: mByCode['RM-004'].costPerGram, totalCost: 1.05 },
        { materialId: mByCode['RM-003'].id, materialName: mByCode['RM-003'].name, grams: 1.5, costPerGram: mByCode['RM-003'].costPerGram, totalCost: 2.70 },
        { materialId: mByCode['RM-008'].id, materialName: mByCode['RM-008'].name, grams: 24, costPerGram: mByCode['RM-008'].costPerGram, totalCost: 0.96 },
        { materialId: mByCode['RM-010'].id, materialName: mByCode['RM-010'].name, grams: 0.3, costPerGram: mByCode['RM-010'].costPerGram, totalCost: 0.18 },
        { materialId: mByCode['RM-006'].id, materialName: mByCode['RM-006'].name, grams: 0.2, costPerGram: mByCode['RM-006'].costPerGram, totalCost: 0.19 }
      ],
      packagingCost: 12.0,
      laborCost: 5.0,
      rawMaterialsCost: 5.08,
      totalCost: 22.08,
      profitMargin: 80,
      profitType: 'percent',
      sellingPrice: 40.0,
      stockUnits: 45,
      minStockUnits: 10,
      notes: 'المنتج الأفضل مبيعاً - تفتيح ونضارة ومكافحة التجاعيد'
    },
    {
      code: 'PRD-102',
      name: 'كريم زبدة الشيا والأرغان الفائق 100 جم',
      category: 'كريمات وترطيب',
      netWeight: 100,
      ingredients: [
        { materialId: mByCode['RM-002'].id, materialName: mByCode['RM-002'].name, grams: 40, costPerGram: mByCode['RM-002'].costPerGram, totalCost: 7.2 },
        { materialId: mByCode['RM-001'].id, materialName: mByCode['RM-001'].name, grams: 15, costPerGram: mByCode['RM-001'].costPerGram, totalCost: 6.75 },
        { materialId: mByCode['RM-005'].id, materialName: mByCode['RM-005'].name, grams: 10, costPerGram: mByCode['RM-005'].costPerGram, totalCost: 2.8 },
        { materialId: mByCode['RM-007'].id, materialName: mByCode['RM-007'].name, grams: 8, costPerGram: mByCode['RM-007'].costPerGram, totalCost: 0.96 },
        { materialId: mByCode['RM-008'].id, materialName: mByCode['RM-008'].name, grams: 24, costPerGram: mByCode['RM-008'].costPerGram, totalCost: 0.96 },
        { materialId: mByCode['RM-009'].id, materialName: mByCode['RM-009'].name, grams: 2, costPerGram: mByCode['RM-009'].costPerGram, totalCost: 0.3 },
        { materialId: mByCode['RM-010'].id, materialName: mByCode['RM-010'].name, grams: 0.5, costPerGram: mByCode['RM-010'].costPerGram, totalCost: 0.3 },
        { materialId: mByCode['RM-006'].id, materialName: mByCode['RM-006'].name, grams: 0.5, costPerGram: mByCode['RM-006'].costPerGram, totalCost: 0.475 }
      ],
      packagingCost: 9.0,
      laborCost: 6.0,
      rawMaterialsCost: 19.75,
      totalCost: 34.75,
      profitMargin: 70,
      profitType: 'percent',
      sellingPrice: 60.0,
      stockUnits: 30,
      minStockUnits: 8,
      notes: 'ترطيب عميق للبشرة الجافة والجسم'
    },
    {
      code: 'PRD-103',
      name: 'مقشر الجسم باللافندر والسكر البني 200 جم',
      category: 'مقشرات وعناية بالجسم',
      netWeight: 200,
      ingredients: [
        { materialId: mByCode['RM-012'].id, materialName: mByCode['RM-012'].name, grams: 140, costPerGram: mByCode['RM-012'].costPerGram, totalCost: 7.0 },
        { materialId: mByCode['RM-005'].id, materialName: mByCode['RM-005'].name, grams: 35, costPerGram: mByCode['RM-005'].costPerGram, totalCost: 9.8 },
        { materialId: mByCode['RM-002'].id, materialName: mByCode['RM-002'].name, grams: 20, costPerGram: mByCode['RM-002'].costPerGram, totalCost: 3.6 },
        { materialId: mByCode['RM-006'].id, materialName: mByCode['RM-006'].name, grams: 3, costPerGram: mByCode['RM-006'].costPerGram, totalCost: 2.85 },
        { materialId: mByCode['RM-010'].id, materialName: mByCode['RM-010'].name, grams: 2, costPerGram: mByCode['RM-010'].costPerGram, totalCost: 1.2 }
      ],
      packagingCost: 8.0,
      laborCost: 4.0,
      rawMaterialsCost: 24.45,
      totalCost: 36.45,
      profitMargin: 65,
      profitType: 'percent',
      sellingPrice: 60.0,
      stockUnits: 25,
      minStockUnits: 5,
      notes: 'إزالة الجلد الميت ونعومة فائقة برائحة اللافندر'
    },
    {
      code: 'PRD-104',
      name: 'جل الألوفيرا وماء الورد المهدئ 150 مل',
      category: 'مائيات ومستخلصات',
      netWeight: 150,
      ingredients: [
        { materialId: mByCode['RM-011'].id, materialName: mByCode['RM-011'].name, grams: 100, costPerGram: mByCode['RM-011'].costPerGram, totalCost: 8.0 },
        { materialId: mByCode['RM-008'].id, materialName: mByCode['RM-008'].name, grams: 48, costPerGram: mByCode['RM-008'].costPerGram, totalCost: 1.92 },
        { materialId: mByCode['RM-010'].id, materialName: mByCode['RM-010'].name, grams: 1.5, costPerGram: mByCode['RM-010'].costPerGram, totalCost: 0.9 },
        { materialId: mByCode['RM-006'].id, materialName: mByCode['RM-006'].name, grams: 0.5, costPerGram: mByCode['RM-006'].costPerGram, totalCost: 0.475 }
      ],
      packagingCost: 7.5,
      laborCost: 3.5,
      rawMaterialsCost: 11.3,
      totalCost: 22.3,
      profitMargin: 75,
      profitType: 'percent',
      sellingPrice: 40.0,
      stockUnits: 38,
      minStockUnits: 8,
      notes: 'مهدئ للبشرة بعد التعرض للشمس وعلاج الاحمرار'
    }
  ];

  for (const p of sampleProducts) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO products (code, name, category, netWeight, ingredients, rawMaterialsCost, packagingCost, laborCost, totalCost, profitType, profitMargin, sellingPrice, stockUnits, minStockUnits, notes, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [p.code, p.name, p.category, p.netWeight, JSON.stringify(p.ingredients), p.rawMaterialsCost, p.packagingCost, p.laborCost, p.totalCost, p.profitType, p.profitMargin, p.sellingPrice, p.stockUnits, p.minStockUnits, p.notes, new Date().toISOString(), new Date().toISOString()]
    });
  }

  // Sample Invoices
  await client.execute({
    sql: `INSERT OR IGNORE INTO invoices (invoiceNumber, date, customerName, customerPhone, paymentMethod, items, subtotal, discount, taxAmount, total, totalCost, netProfit, status, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      'INV-1001',
      new Date().toISOString(),
      'سارة أحمد',
      '01234567890',
      'cash',
      JSON.stringify([
        { productId: 1, productName: 'سيروم الذهب وفيتامين سي 30 مل', code: 'PRD-101', quantity: 2, unitCost: 22.08, unitPrice: 40.0, total: 80.0, profit: 35.84 }
      ]),
      80.0,
      0,
      0,
      80.0,
      44.16,
      35.84,
      'completed',
      'طلب مباشر من المعرض'
    ]
  });
}

// Helper to format rows
function formatRow(row, jsonFields = []) {
  if (!row) return null;
  const obj = { ...row };
  for (const f of jsonFields) {
    if (obj[f] && typeof obj[f] === 'string') {
      try { obj[f] = JSON.parse(obj[f]); } catch(e) {}
    }
  }
  return obj;
}

// ============================================================================
// Vercel Serverless Function Handler
// ============================================================================
module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // If no Turso client configured, tell frontend to use local IndexedDB storage
  if (!client) {
    return res.status(200).json({
      online: false,
      mode: 'local',
      database: 'IndexedDB (Local Device Storage)',
      message: 'Running in standalone local storage mode on user device.'
    });
  }

  try {
    await ensureTables();
  } catch (err) {
    console.error('Database connection error:', err);
    return res.status(500).json({ error: 'خطأ في الاتصال بقاعدة بيانات Turso: ' + err.message });
  }

  // Parse Path
  // e.g. /api/materials, /api/materials/1, /api/products, etc.
  const rawPath = req.headers['x-matched-path'] || req.headers['x-vercel-matched-path'] || req.url || '';
  const urlObj = new URL(rawPath.startsWith('http') ? rawPath : `http://${req.headers.host || 'localhost'}${rawPath.startsWith('/') ? rawPath : '/' + rawPath}`);
  let pathname = urlObj.pathname.replace(/^\/api/, '');
  if (!pathname.startsWith('/')) pathname = '/' + pathname;
  const parts = pathname.split('/').filter(p => Boolean(p) && p !== 'index.js');
  const resource = parts[0];
  const idOrSub = parts[1];
  const subAction = parts[2];

  try {
    // Health / Status
    if (!resource || resource === 'status') {
      return res.json({
        online: true,
        database: 'Turso Edge SQLite',
        connected: Boolean(process.env.TURSO_DATABASE_URL),
        timestamp: new Date().toISOString()
      });
    }

    // --- MATERIALS ---
    if (resource === 'materials') {
      if (req.method === 'GET') {
        const result = await client.execute("SELECT * FROM materials ORDER BY id DESC");
        return res.json(result.rows);
      }

      if (req.method === 'POST' && idOrSub && subAction === 'stock') {
        // Supply stock
        const { addedGrams } = req.body;
        await client.execute({
          sql: "UPDATE materials SET stockGrams = stockGrams + ?, updatedAt = ? WHERE id = ?",
          args: [Number(addedGrams), new Date().toISOString(), Number(idOrSub)]
        });
        const updated = await client.execute({ sql: "SELECT * FROM materials WHERE id = ?", args: [Number(idOrSub)] });
        return res.json(updated.rows[0]);
      }

      if (req.method === 'POST') {
        const m = req.body;
        const resInsert = await client.execute({
          sql: `INSERT INTO materials (code, name, category, costPerGram, costPerKg, stockGrams, minStockGrams, supplier, notes, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [m.code, m.name, m.category || 'عام', m.costPerGram || 0, (m.costPerGram || 0) * 1000, m.stockGrams || 0, m.minStockGrams || 0, m.supplier || '', m.notes || '', new Date().toISOString(), new Date().toISOString()]
        });
        const newId = Number(resInsert.lastInsertRowid);
        const created = await client.execute({ sql: "SELECT * FROM materials WHERE id = ?", args: [newId] });
        return res.status(201).json(created.rows[0]);
      }

      if (req.method === 'PUT' && idOrSub) {
        const m = req.body;
        await client.execute({
          sql: `UPDATE materials SET code=?, name=?, category=?, costPerGram=?, costPerKg=?, stockGrams=?, minStockGrams=?, supplier=?, notes=?, updatedAt=? WHERE id=?`,
          args: [m.code, m.name, m.category, m.costPerGram, (m.costPerGram || 0) * 1000, m.stockGrams, m.minStockGrams, m.supplier, m.notes, new Date().toISOString(), Number(idOrSub)]
        });
        const updated = await client.execute({ sql: "SELECT * FROM materials WHERE id = ?", args: [Number(idOrSub)] });
        return res.json(updated.rows[0]);
      }

      if (req.method === 'DELETE' && idOrSub) {
        await client.execute({ sql: "DELETE FROM materials WHERE id = ?", args: [Number(idOrSub)] });
        return res.json({ success: true });
      }
    }

    // --- PRODUCTS ---
    if (resource === 'products') {
      if (req.method === 'GET') {
        const result = await client.execute("SELECT * FROM products ORDER BY id DESC");
        return res.json(result.rows.map(r => formatRow(r, ['ingredients'])));
      }

      if (req.method === 'POST') {
        const p = req.body;
        const resInsert = await client.execute({
          sql: `INSERT INTO products (code, name, category, netWeight, ingredients, rawMaterialsCost, packagingCost, laborCost, totalCost, profitType, profitMargin, sellingPrice, stockUnits, minStockUnits, notes, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [p.code, p.name, p.category || 'عام', p.netWeight || 0, JSON.stringify(p.ingredients || []), p.rawMaterialsCost || 0, p.packagingCost || 0, p.laborCost || 0, p.totalCost || 0, p.profitType || 'percent', p.profitMargin || 0, p.sellingPrice || 0, p.stockUnits || 0, p.minStockUnits || 0, p.notes || '', new Date().toISOString(), new Date().toISOString()]
        });
        const newId = Number(resInsert.lastInsertRowid);
        const created = await client.execute({ sql: "SELECT * FROM products WHERE id = ?", args: [newId] });
        return res.status(201).json(formatRow(created.rows[0], ['ingredients']));
      }

      if (req.method === 'PUT' && idOrSub) {
        const p = req.body;
        await client.execute({
          sql: `UPDATE products SET code=?, name=?, category=?, netWeight=?, ingredients=?, rawMaterialsCost=?, packagingCost=?, laborCost=?, totalCost=?, profitType=?, profitMargin=?, sellingPrice=?, stockUnits=?, minStockUnits=?, notes=?, updatedAt=? WHERE id=?`,
          args: [p.code, p.name, p.category, p.netWeight, JSON.stringify(p.ingredients || []), p.rawMaterialsCost, p.packagingCost, p.laborCost, p.totalCost, p.profitType, p.profitMargin, p.sellingPrice, p.stockUnits, p.minStockUnits, p.notes, new Date().toISOString(), Number(idOrSub)]
        });
        const updated = await client.execute({ sql: "SELECT * FROM products WHERE id = ?", args: [Number(idOrSub)] });
        return res.json(formatRow(updated.rows[0], ['ingredients']));
      }

      if (req.method === 'DELETE' && idOrSub) {
        await client.execute({ sql: "DELETE FROM products WHERE id = ?", args: [Number(idOrSub)] });
        return res.json({ success: true });
      }
    }

    // --- PRODUCTION BATCH ---
    if (resource === 'production') {
      if (req.method === 'GET') {
        const result = await client.execute("SELECT * FROM production ORDER BY id DESC");
        return res.json(result.rows.map(r => formatRow(r, ['deductedMaterials'])));
      }

      if (idOrSub === 'produce' && req.method === 'POST') {
        const { productId, quantity, notes } = req.body;
        const prodRes = await client.execute({ sql: "SELECT * FROM products WHERE id = ?", args: [Number(productId)] });
      if (prodRes.rows.length === 0) return res.status(404).json({ error: 'المنتج غير موجود' });
      const prod = formatRow(prodRes.rows[0], ['ingredients']);

      const matsRes = await client.execute("SELECT * FROM materials");
      const matsMap = new Map(matsRes.rows.map(m => [m.id, m]));

      const needed = [];
      for (const ing of (prod.ingredients || [])) {
        const mat = matsMap.get(Number(ing.materialId));
        if (!mat) return res.status(400).json({ error: `المادة الخام "${ing.materialName}" غير موجودة` });
        const gramsNeeded = (Number(ing.grams) || 0) * quantity;
        if ((mat.stockGrams || 0) < gramsNeeded) {
          return res.status(400).json({ error: `رصيد المادة الخام "${mat.name}" غير كافٍ. المطلوب: ${gramsNeeded} جم، المتوفر: ${mat.stockGrams} جم` });
        }
        needed.push({ mat, gramsNeeded, cost: gramsNeeded * (mat.costPerGram || 0) });
      }

      // Execute deductions
      for (const n of needed) {
        await client.execute({
          sql: "UPDATE materials SET stockGrams = stockGrams - ?, updatedAt = ? WHERE id = ?",
          args: [n.gramsNeeded, new Date().toISOString(), n.mat.id]
        });
      }

      // Increase product units
      await client.execute({
        sql: "UPDATE products SET stockUnits = stockUnits + ?, updatedAt = ? WHERE id = ?",
        args: [quantity, new Date().toISOString(), prod.id]
      });

      // Record batch
      const batchNumber = 'BAT-' + Date.now().toString().slice(-6);
      await client.execute({
        sql: `INSERT INTO production (batchNumber, productId, productName, unitsProduced, unitCost, totalBatchCost, date, notes, deductedMaterials)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [batchNumber, prod.id, prod.name, quantity, prod.totalCost || 0, (prod.totalCost || 0) * quantity, new Date().toISOString(), notes || '', JSON.stringify(needed.map(n => ({ materialId: n.mat.id, name: n.mat.name, gramsDeducted: n.gramsNeeded, cost: n.cost })))]
      });

      return res.json({ success: true, unitsProduced: quantity });
      }
    }

    // --- INVOICES ---
    if (resource === 'invoices') {
      if (req.method === 'GET') {
        const result = await client.execute("SELECT * FROM invoices ORDER BY id DESC");
        return res.json(result.rows.map(r => formatRow(r, ['items'])));
      }

      // Refund invoice
      if (req.method === 'POST' && idOrSub && subAction === 'refund') {
        const invRes = await client.execute({ sql: "SELECT * FROM invoices WHERE id = ?", args: [Number(idOrSub)] });
        if (invRes.rows.length === 0) return res.status(404).json({ error: 'الفاتورة غير موجودة' });
        const inv = formatRow(invRes.rows[0], ['items']);
        if (inv.status === 'refunded') return res.status(400).json({ error: 'تم استرجاع الفاتورة مسبقاً' });

        // Restore quantities
        for (const it of (inv.items || [])) {
          await client.execute({
            sql: "UPDATE products SET stockUnits = stockUnits + ?, updatedAt = ? WHERE id = ?",
            args: [it.quantity, new Date().toISOString(), it.productId]
          });
        }

        await client.execute({
          sql: "UPDATE invoices SET status = 'refunded', notes = notes || ' [مسترجعة]' WHERE id = ?",
          args: [inv.id]
        });

        return res.json({ success: true });
      }

      // Create invoice
      if (req.method === 'POST') {
        const { items, customerName, customerPhone, paymentMethod, discount = 0, taxAmount = 0, notes = '' } = req.body;
        if (!items || items.length === 0) return res.status(400).json({ error: 'لا توجد أصناف في الفاتورة' });

        const prodsRes = await client.execute("SELECT * FROM products");
        const prodMap = new Map(prodsRes.rows.map(p => [p.id, p]));

        // Validate stock
        for (const it of items) {
          const prod = prodMap.get(Number(it.productId));
          if (!prod) return res.status(400).json({ error: `المنتج "${it.productName}" غير موجود` });
          if ((prod.stockUnits || 0) < it.quantity) {
            return res.status(400).json({ error: `الرصيد المتاح من "${prod.name}" لا يكفي` });
          }
        }

        // Get config
        const setRes = await client.execute({ sql: "SELECT * FROM settings WHERE key = 'appConfig'", args: [] });
        let appConfig = setRes.rows.length > 0 ? JSON.parse(setRes.rows[0].value) : {};
        const nextNum = appConfig.nextInvoiceNum || 1001;
        const prefix = appConfig.invoicePrefix || 'INV-';
        const invoiceNumber = `${prefix}${nextNum}`;

        let subtotal = 0;
        let totalCost = 0;
        const finalItems = items.map(it => {
          const prod = prodMap.get(Number(it.productId));
          const lineCost = (prod.totalCost || 0) * it.quantity;
          const lineTotal = it.unitPrice * it.quantity;
          subtotal += lineTotal;
          totalCost += lineCost;
          return {
            productId: prod.id,
            productName: prod.name,
            code: prod.code,
            quantity: it.quantity,
            unitCost: prod.totalCost || 0,
            unitPrice: it.unitPrice,
            total: lineTotal,
            profit: lineTotal - lineCost
          };
        });

        const total = Math.max(0, subtotal - discount + (taxAmount || 0));
        const netProfit = total - totalCost;

        // Deduct products
        for (const it of items) {
          await client.execute({
            sql: "UPDATE products SET stockUnits = stockUnits - ?, updatedAt = ? WHERE id = ?",
            args: [it.quantity, new Date().toISOString(), it.productId]
          });
        }

        // Insert invoice
        const insRes = await client.execute({
          sql: `INSERT INTO invoices (invoiceNumber, date, customerName, customerPhone, paymentMethod, items, subtotal, discount, taxAmount, total, totalCost, netProfit, status, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [invoiceNumber, new Date().toISOString(), customerName || 'عميل نقدي', customerPhone || '', paymentMethod || 'cash', JSON.stringify(finalItems), subtotal, discount, taxAmount, total, totalCost, netProfit, 'completed', notes]
        });

        // Update config
        appConfig.nextInvoiceNum = nextNum + 1;
        await client.execute({
          sql: "UPDATE settings SET value = ? WHERE key = 'appConfig'",
          args: [JSON.stringify(appConfig)]
        });

        const newId = Number(insRes.lastInsertRowid);
        const created = await client.execute({ sql: "SELECT * FROM invoices WHERE id = ?", args: [newId] });
        return res.status(201).json(formatRow(created.rows[0], ['items']));
      }
    }

    // --- SETTINGS ---
    if (resource === 'settings') {
      if (req.method === 'GET' && !idOrSub) {
        const allSets = await client.execute("SELECT * FROM settings");
        return res.json(allSets.rows.map(r => {
          let val = null;
          try { val = JSON.parse(r.value); } catch(e) { val = r.value; }
          return { key: r.key, value: val };
        }));
      }

      const key = idOrSub || 'appConfig';
      if (req.method === 'GET') {
        const resSet = await client.execute({ sql: "SELECT * FROM settings WHERE key = ?", args: [key] });
        if (resSet.rows.length === 0) return res.json({ key, value: null });
        let val = null;
        try { val = JSON.parse(resSet.rows[0].value); } catch(e) { val = resSet.rows[0].value; }
        return res.json({ key, value: val });
      }

      if (req.method === 'POST') {
        const val = JSON.stringify(req.body.value);
        await client.execute({
          sql: "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
          args: [key, val]
        });
        return res.json({ success: true, key, value: req.body.value });
      }
    }

    // --- BACKUP ---
    if (resource === 'backup') {
      if (idOrSub === 'export') {
        const [mats, prods, prodsLog, invs, sets] = await Promise.all([
          client.execute("SELECT * FROM materials"),
          client.execute("SELECT * FROM products"),
          client.execute("SELECT * FROM production"),
          client.execute("SELECT * FROM invoices"),
          client.execute("SELECT * FROM settings")
        ]);

        return res.json({
          app: 'RoseCosmetics Turso Cloud',
          version: 1,
          exportedAt: new Date().toISOString(),
          data: {
            materials: mats.rows,
            products: prods.rows.map(r => formatRow(r, ['ingredients'])),
            production: prodsLog.rows.map(r => formatRow(r, ['deductedMaterials'])),
            invoices: invs.rows.map(r => formatRow(r, ['items'])),
            settings: sets.rows.map(r => ({ key: r.key, value: JSON.parse(r.value) }))
          }
        });
      }

      if (idOrSub === 'import' && req.method === 'POST') {
        const backup = req.body;
        const rawData = backup ? (backup.data || backup) : null;
        if (!rawData) return res.status(400).json({ error: 'ملف غير صالح' });

        await client.execute("DELETE FROM materials");
        await client.execute("DELETE FROM products");
        await client.execute("DELETE FROM production");
        await client.execute("DELETE FROM invoices");
        await client.execute("DELETE FROM settings");

        const materials = Array.isArray(rawData.materials) ? rawData.materials : [];
        const products = Array.isArray(rawData.products) ? rawData.products : [];
        const production = Array.isArray(rawData.production) ? rawData.production : [];
        const invoices = Array.isArray(rawData.invoices) ? rawData.invoices : [];
        const settings = Array.isArray(rawData.settings) ? rawData.settings : (rawData.settings && typeof rawData.settings === 'object' && !rawData.settings.error ? Object.entries(rawData.settings).map(([k, v]) => ({ key: k, value: v })) : []);

        for (const m of materials) {
          await client.execute({
            sql: `INSERT OR REPLACE INTO materials (id, code, name, category, costPerGram, costPerKg, stockGrams, minStockGrams, supplier, notes, createdAt, updatedAt)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [m.id, m.code, m.name, m.category, m.costPerGram, m.costPerKg, m.stockGrams, m.minStockGrams, m.supplier, m.notes, m.createdAt || new Date().toISOString(), m.updatedAt || new Date().toISOString()]
          });
        }

        for (const p of products) {
          const ingStr = typeof p.ingredients === 'string' ? p.ingredients : JSON.stringify(p.ingredients || []);
          await client.execute({
            sql: `INSERT OR REPLACE INTO products (id, code, name, category, netWeight, ingredients, rawMaterialsCost, packagingCost, laborCost, totalCost, profitType, profitMargin, sellingPrice, stockUnits, minStockUnits, notes, createdAt, updatedAt)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [p.id, p.code, p.name, p.category, p.netWeight, ingStr, p.rawMaterialsCost, p.packagingCost, p.laborCost, p.totalCost, p.profitType, p.profitMargin, p.sellingPrice, p.stockUnits, p.minStockUnits, p.notes, p.createdAt || new Date().toISOString(), p.updatedAt || new Date().toISOString()]
          });
        }

        for (const b of production) {
          const matStr = typeof b.deductedMaterials === 'string' ? b.deductedMaterials : JSON.stringify(b.deductedMaterials || []);
          await client.execute({
            sql: `INSERT OR REPLACE INTO production (id, batchNumber, productId, productName, unitsProduced, unitCost, totalBatchCost, date, notes, deductedMaterials)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [b.id, b.batchNumber, b.productId, b.productName, b.unitsProduced, b.unitCost, b.totalBatchCost, b.date || new Date().toISOString(), b.notes, matStr]
          });
        }

        for (const i of invoices) {
          const itStr = typeof i.items === 'string' ? i.items : JSON.stringify(i.items || []);
          await client.execute({
            sql: `INSERT OR REPLACE INTO invoices (id, invoiceNumber, date, customerName, customerPhone, paymentMethod, items, subtotal, discount, taxAmount, total, totalCost, netProfit, status, notes)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [i.id, i.invoiceNumber, i.date || new Date().toISOString(), i.customerName, i.customerPhone, i.paymentMethod, itStr, i.subtotal, i.discount, i.taxAmount, i.total, i.totalCost, i.netProfit, i.status, i.notes]
          });
        }

        for (const s of settings) {
          if (s && s.key) {
            const valStr = typeof s.value === 'string' ? s.value : JSON.stringify(s.value);
            await client.execute({
              sql: `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
              args: [s.key, valStr]
            });
          }
        }

        return res.json({ success: true });
      }
    }

    // Reset Demo
    if (resource === 'reset-demo') {
      await client.execute("DELETE FROM materials");
      await client.execute("DELETE FROM products");
      await client.execute("DELETE FROM production");
      await client.execute("DELETE FROM invoices");
      await seedDemoData();
      return res.json({ success: true, message: 'تمت استعادة البيانات التجريبية بنجاح في قاعدة بيانات Turso' });
    }

    res.status(404).json({ error: 'المسار غير موجود' });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: err.message });
  }
};
