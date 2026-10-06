require('dotenv').config();
const { createClient } = require('@libsql/client');

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

console.log('Connecting to Turso Database at:', url);

const client = createClient({
  url,
  authToken
});

async function main() {
  try {
    console.log('Creating tables in Turso cloud...');
    
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

    console.log('✓ All 5 tables created successfully in Turso!');

    // Check count of materials
    const countRes = await client.execute("SELECT COUNT(*) as cnt FROM materials");
    console.log('Current materials count in Turso:', countRes.rows[0].cnt);

    if (Number(countRes.rows[0].cnt) === 0) {
      console.log('Seeding materials into Turso...');
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
          sql: `INSERT INTO materials (code, name, category, costPerGram, costPerKg, stockGrams, minStockGrams, supplier, notes, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [m.code, m.name, m.category, m.costPerGram, m.costPerKg, m.stockGrams, m.minStockGrams, m.supplier, m.notes, new Date().toISOString(), new Date().toISOString()]
        });
      }
      console.log('✓ 12 Raw materials seeded successfully in Turso!');
    }

    const checkProds = await client.execute("SELECT COUNT(*) as cnt FROM products");
    if (Number(checkProds.rows[0].cnt) === 0) {
      console.log('Seeding products into Turso...');
      const sampleProducts = [
        {
          code: 'PRD-101',
          name: 'سيروم الذهب وفيتامين سي 30 مل',
          category: 'سيروم للبشرة',
          netWeight: 30,
          ingredients: [
            { materialId: 4, materialName: 'فيتامين سي (Ascorbic Acid)', grams: 3, costPerGram: 0.35, totalCost: 1.05 },
            { materialId: 3, materialName: 'حمض الهيالورونيك (Hyaluronic Acid)', grams: 1.5, costPerGram: 1.8, totalCost: 2.70 },
            { materialId: 8, materialName: 'ماء الورد المقطر النقي', grams: 24, costPerGram: 0.04, totalCost: 0.96 },
            { materialId: 10, materialName: 'مادة حافظة كوزموجارد (Cosgard)', grams: 0.3, costPerGram: 0.6, totalCost: 0.18 },
            { materialId: 6, materialName: 'زيت اللافندر العطري المركز', grams: 0.2, costPerGram: 0.95, totalCost: 0.19 }
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
            { materialId: 2, materialName: 'زبدة الشيا الإفريقية العضوية', grams: 40, costPerGram: 0.18, totalCost: 7.2 },
            { materialId: 1, materialName: 'زيت الأرغان المغربي النقي', grams: 15, costPerGram: 0.45, totalCost: 6.75 },
            { materialId: 5, materialName: 'زيت الجوجوبا الذهبي', grams: 10, costPerGram: 0.28, totalCost: 2.8 },
            { materialId: 7, materialName: 'شمع النحل الطبيعي المفلتر', grams: 8, costPerGram: 0.12, totalCost: 0.96 },
            { materialId: 8, materialName: 'ماء الورد المقطر النقي', grams: 24, costPerGram: 0.04, totalCost: 0.96 },
            { materialId: 9, materialName: 'مستحلب شمعي Polawax', grams: 2, costPerGram: 0.15, totalCost: 0.3 },
            { materialId: 10, materialName: 'مادة حافظة كوزموجارد (Cosgard)', grams: 0.5, costPerGram: 0.6, totalCost: 0.3 },
            { materialId: 6, materialName: 'زيت اللافندر العطري المركز', grams: 0.5, costPerGram: 0.95, totalCost: 0.475 }
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
            { materialId: 12, materialName: 'حبيبات السكر البني والمشمش للتقشير', grams: 140, costPerGram: 0.05, totalCost: 7.0 },
            { materialId: 5, materialName: 'زيت الجوجوبا الذهبي', grams: 35, costPerGram: 0.28, totalCost: 9.8 },
            { materialId: 2, materialName: 'زبدة الشيا الإفريقية العضوية', grams: 20, costPerGram: 0.18, totalCost: 3.6 },
            { materialId: 6, materialName: 'زيت اللافندر العطري المركز', grams: 3, costPerGram: 0.95, totalCost: 2.85 },
            { materialId: 10, materialName: 'مادة حافظة كوزموجارد (Cosgard)', grams: 2, costPerGram: 0.6, totalCost: 1.2 }
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
            { materialId: 11, materialName: 'مستخلص الألوفيرا جل نقي', grams: 100, costPerGram: 0.08, totalCost: 8.0 },
            { materialId: 8, materialName: 'ماء الورد المقطر النقي', grams: 48, costPerGram: 0.04, totalCost: 1.92 },
            { materialId: 10, materialName: 'مادة حافظة كوزموجارد (Cosgard)', grams: 1.5, costPerGram: 0.6, totalCost: 0.9 },
            { materialId: 6, materialName: 'زيت اللافندر العطري المركز', grams: 0.5, costPerGram: 0.95, totalCost: 0.475 }
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
          sql: `INSERT INTO products (code, name, category, netWeight, ingredients, rawMaterialsCost, packagingCost, laborCost, totalCost, profitType, profitMargin, sellingPrice, stockUnits, minStockUnits, notes, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [p.code, p.name, p.category, p.netWeight, JSON.stringify(p.ingredients), p.rawMaterialsCost, p.packagingCost, p.laborCost, p.totalCost, p.profitType, p.profitMargin, p.sellingPrice, p.stockUnits, p.minStockUnits, p.notes, new Date().toISOString(), new Date().toISOString()]
        });
      }
      console.log('✓ 4 Finished products with formulas seeded successfully in Turso!');
    }

    // Check settings
    const setRes = await client.execute("SELECT * FROM settings WHERE key = 'appConfig'");
    if (setRes.rows.length === 0) {
      const cfg = {
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
        args: [JSON.stringify(cfg)]
      });
      console.log('✓ Settings initialized in Turso!');
    }

    console.log('\n======================================================');
    console.log('🎉 SUCCESS! Turso cloud database is 100% ready and LIVE!');
    console.log('======================================================');
  } catch (err) {
    console.error('Error connecting to Turso:', err);
  }
}

main();
