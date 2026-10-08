/**
 * RoseCosmetics - IndexedDB Storage Engine & Data Management
 * Manages materials, recipes, products, production batches, invoices, and settings.
 * Supports full offline capability, JSON Backup & Restore.
 */

const DB_NAME = 'RoseCosmeticsDB';
const DB_VERSION = 1;

class CosmeticsDB {
  constructor() {
    this.db = null;
    this.isReady = false;
    this.useApi = false;
    this.readyPromise = this.init();
  }

  async _ensureDb() {
    if (!this.isReady) {
      await this.readyPromise;
    }
    return this.useApi ? true : this.db;
  }

  async init() {
    // Check if hosted on an online server providing /api
    if (typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http')) {
      try {
        const res = await fetch('/api/status');
        if (res.ok) {
          const status = await res.json();
          if (status.online) {
            this.useApi = true;
            this.isReady = true;
            console.log('🌸 Connected to RoseCosmetics Cloud Server Database!');
            this.updateOnlineBadge(true);
            return true;
          }
        }
      } catch (e) {
        console.log('Running in local/offline mode.');
      }
    }

    this.updateOnlineBadge(false);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Raw Materials Store (المواد الخام)
        if (!db.objectStoreNames.contains('materials')) {
          const matStore = db.createObjectStore('materials', { keyPath: 'id', autoIncrement: true });
          matStore.createIndex('name', 'name', { unique: false });
          matStore.createIndex('code', 'code', { unique: true });
          matStore.createIndex('category', 'category', { unique: false });
        }

        // Finished Products & Formula (المنتجات والتراكيب)
        if (!db.objectStoreNames.contains('products')) {
          const prodStore = db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
          prodStore.createIndex('name', 'name', { unique: false });
          prodStore.createIndex('code', 'code', { unique: true });
          prodStore.createIndex('category', 'category', { unique: false });
        }

        // Production Batches (سجل تشغيلات الإنتاج والتصنيع)
        if (!db.objectStoreNames.contains('production')) {
          const batchStore = db.createObjectStore('production', { keyPath: 'id', autoIncrement: true });
          batchStore.createIndex('productId', 'productId', { unique: false });
          batchStore.createIndex('date', 'date', { unique: false });
        }

        // Invoices Store (الفواتير)
        if (!db.objectStoreNames.contains('invoices')) {
          const invStore = db.createObjectStore('invoices', { keyPath: 'id', autoIncrement: true });
          invStore.createIndex('invoiceNumber', 'invoiceNumber', { unique: true });
          invStore.createIndex('date', 'date', { unique: false });
          invStore.createIndex('customerName', 'customerName', { unique: false });
          invStore.createIndex('status', 'status', { unique: false });
        }

        // Settings & Meta Store (الإعدادات)
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = async (event) => {
        this.db = event.target.result;
        this.isReady = true;
        try {
          await this.ensureInitialSettings();
        } catch (e) {
          console.error('Error seeding initial settings:', e);
        }
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB Error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async ensureInitialSettings() {
    const existing = await this.getSetting('appConfig');
    if (!existing) {
      await this.setSetting('appConfig', {
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
      });
    }

    // If completely empty, seed demo data for cosmetics
    const materialsCount = await this.count('materials');
    const productsCount = await this.count('products');
    if (materialsCount === 0 || productsCount === 0) {
      await this.seedDemoData();
    }
  }

  updateOnlineBadge(isOnline) {
    setTimeout(() => {
      const badge = document.querySelector('.status-indicator span:last-child');
      const dot = document.querySelector('.status-dot');
      if (badge) {
        badge.textContent = isOnline ? 'متصل بالسيرفر السحابي (أونلاين) ☁️' : 'يعمل بدون إنترنت (محلي)';
      }
      if (dot && isOnline) {
        dot.style.background = '#38bdf8';
        dot.style.boxShadow = '0 0 8px #38bdf8';
      }
    }, 300);
  }

  // --- Generic Store Operations ---

  async getAll(storeName) {
    await this._ensureDb();
    if (this.useApi) {
      try {
        const res = await fetch(`/api/${storeName}`);
        return await res.json();
      } catch (e) {
        console.error(`API getAll ${storeName} error:`, e);
      }
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getById(storeName, id) {
    await this._ensureDb();
    if (this.useApi) {
      const all = await this.getAll(storeName);
      return all.find(i => Number(i.id) === Number(id));
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(Number(id) || id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async add(storeName, item) {
    await this._ensureDb();
    if (this.useApi) {
      const res = await fetch(`/api/${storeName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      return await res.json();
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.add(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async update(storeName, item) {
    await this._ensureDb();
    if (this.useApi) {
      const res = await fetch(`/api/${storeName}/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      return await res.json();
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName, id) {
    await this._ensureDb();
    if (this.useApi) {
      const res = await fetch(`/api/${storeName}/${id}`, { method: 'DELETE' });
      return await res.json();
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(Number(id) || id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async count(storeName) {
    await this._ensureDb();
    if (this.useApi) {
      const all = await this.getAll(storeName);
      return all.length;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error);
    });
  }

  async clear(storeName) {
    await this._ensureDb();
    if (this.useApi) return true;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // --- Settings ---

  async getSetting(key) {
    await this._ensureDb();
    if (this.useApi) {
      try {
        const res = await fetch(`/api/settings/${key}`);
        const data = await res.json();
        return data.value;
      } catch (e) {
        console.error(`API getSetting ${key} error:`, e);
      }
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
    });
  }

  async setSetting(key, value) {
    await this._ensureDb();
    if (this.useApi) {
      await fetch(`/api/settings/${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      });
      return true;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const req = store.put({ key, value });
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // --- Production Logic: Batch Manufacture ---
  /**
   * Produce a batch of finished cosmetic products:
   * Deducts raw materials in grams from inventory,
   * Increases finished product units in stock,
   * Logs the production batch with ingredients and total cost.
   */
  async produceBatch(productId, unitsToProduce, notes = '') {
    await this._ensureDb();
    if (this.useApi) {
      const res = await fetch('/api/production/produce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity: unitsToProduce, notes })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'فشل تشغيل الدفعة');
      }
      return await res.json();
    }
    await this._ensureDb();
    const product = await this.getById('products', productId);
    if (!product) throw new Error('المنتج غير موجود');
    if (unitsToProduce <= 0) throw new Error('الكمية المراد إنتاجها يجب أن تكون أكبر من صفر');

    // 1. Check stock of all raw materials
    const materials = await this.getAll('materials');
    const materialsMap = new Map(materials.map(m => [m.id, m]));

    const neededMaterials = [];
    for (const ing of (product.ingredients || [])) {
      const mat = materialsMap.get(Number(ing.materialId));
      if (!mat) {
        throw new Error(`المادة الخام "${ing.materialName || '#' + ing.materialId}" غير موجودة في قاعدة البيانات`);
      }
      const totalGramsNeeded = (Number(ing.grams) || 0) * unitsToProduce;
      if (mat.stockGrams < totalGramsNeeded) {
        throw new Error(`رصيد المادة الخام "${mat.name}" غير كافٍ. المطلوب: ${totalGramsNeeded.toLocaleString()} جم، المتاح حالياً: ${mat.stockGrams.toLocaleString()} جم`);
      }
      neededMaterials.push({
        material: mat,
        gramsNeeded: totalGramsNeeded,
        costPerGram: mat.costPerGram || 0,
        totalCost: totalGramsNeeded * (mat.costPerGram || 0)
      });
    }

    // 2. Perform transaction to deduct materials and update product stock
    const tx = this.db.transaction(['materials', 'products', 'production', 'settings'], 'readwrite');
    const matStore = tx.objectStore('materials');
    const prodStore = tx.objectStore('products');
    const batchStore = tx.objectStore('production');

    // Deduct raw materials
    for (const item of neededMaterials) {
      item.material.stockGrams = Math.max(0, item.material.stockGrams - item.gramsNeeded);
      item.material.updatedAt = new Date().toISOString();
      matStore.put(item.material);
    }

    // Increase product units
    product.stockUnits = (product.stockUnits || 0) + unitsToProduce;
    product.updatedAt = new Date().toISOString();
    prodStore.put(product);

    // Create batch log
    const batchNumber = 'BAT-' + Date.now().toString().slice(-6);
    const batchRecord = {
      batchNumber,
      productId: product.id,
      productName: product.name,
      unitsProduced: unitsToProduce,
      unitCost: product.totalCost || 0,
      totalBatchCost: (product.totalCost || 0) * unitsToProduce,
      date: new Date().toISOString(),
      notes: notes || 'تشغيل إنتاج روتيني',
      deductedMaterials: neededMaterials.map(item => ({
        materialId: item.material.id,
        name: item.material.name,
        gramsDeducted: item.gramsNeeded,
        cost: item.totalCost
      }))
    };
    batchStore.add(batchRecord);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve({ success: true, batchRecord });
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Sales & Invoice Logic ---
  /**
   * Process a sales invoice:
   * Deducts finished products from stock,
   * Generates sequential invoice number,
   * Saves invoice.
   */
  async createInvoice(invoiceData) {
    await this._ensureDb();
    if (this.useApi) {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceData)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'فشلت عملية البيع');
      }
      return await res.json();
    }
    const { items, customerName, customerPhone, paymentMethod, discount = 0, taxAmount = 0, notes = '' } = invoiceData;

    if (!items || items.length === 0) {
      throw new Error('لا توجد أصناف في الفاتورة');
    }

    const products = await this.getAll('products');
    const productsMap = new Map(products.map(p => [p.id, p]));

    // Validate stock
    for (const item of items) {
      const prod = productsMap.get(Number(item.productId));
      if (!prod) throw new Error(`المنتج "${item.productName}" غير موجود`);
      if ((prod.stockUnits || 0) < item.quantity) {
        throw new Error(`الكمية المتاحة من "${prod.name}" لا تكفي (${prod.stockUnits || 0} عبوة متاحة، المطلوب: ${item.quantity})`);
      }
    }

    // Config for invoice sequence
    const appConfig = (await this.getSetting('appConfig')) || {};
    const nextNum = appConfig.nextInvoiceNum || 1001;
    const prefix = appConfig.invoicePrefix || 'INV-';
    const invoiceNumber = `${prefix}${nextNum}`;

    let subtotal = 0;
    let totalCost = 0;
    const finalItems = items.map(it => {
      const prod = productsMap.get(Number(it.productId));
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

    const invoiceRecord = {
      invoiceNumber,
      date: new Date().toISOString(),
      customerName: customerName || 'عميل نقدي',
      customerPhone: customerPhone || '',
      paymentMethod: paymentMethod || 'cash',
      items: finalItems,
      subtotal,
      discount,
      taxAmount,
      total,
      totalCost,
      netProfit,
      status: 'completed',
      notes
    };

    const tx = this.db.transaction(['products', 'invoices', 'settings'], 'readwrite');
    const prodStore = tx.objectStore('products');
    const invStore = tx.objectStore('invoices');
    const setStore = tx.objectStore('settings');

    // Deduct stock
    for (const it of items) {
      const prod = productsMap.get(Number(it.productId));
      prod.stockUnits = Math.max(0, (prod.stockUnits || 0) - it.quantity);
      prod.updatedAt = new Date().toISOString();
      prodStore.put(prod);
    }

    // Store invoice
    invStore.add(invoiceRecord);

    // Update config invoice counter
    appConfig.nextInvoiceNum = nextNum + 1;
    setStore.put({ key: 'appConfig', value: appConfig });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(invoiceRecord);
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Refund / Void Invoice ---
  async refundInvoice(invoiceId, reason = '') {
    await this._ensureDb();
    const invoice = await this.getById('invoices', invoiceId);
    if (!invoice) throw new Error('الفاتورة غير موجودة');
    if (invoice.status === 'refunded') throw new Error('تم استرجاع هذه الفاتورة مسبقاً');

    const tx = this.db.transaction(['products', 'invoices'], 'readwrite');
    const prodStore = tx.objectStore('products');
    const invStore = tx.objectStore('invoices');

    // Return quantities to stock
    for (const it of (invoice.items || [])) {
      const req = prodStore.get(it.productId);
      req.onsuccess = () => {
        const prod = req.result;
        if (prod) {
          prod.stockUnits = (prod.stockUnits || 0) + it.quantity;
          prodStore.put(prod);
        }
      };
    }

    invoice.status = 'refunded';
    invoice.refundDate = new Date().toISOString();
    invoice.refundReason = reason || 'إرجاع بناءً على رغبة العميل';
    invStore.put(invoice);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(invoice);
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Backup & Restore ---
  async exportFullBackup() {
    await this._ensureDb();
    const [materials, products, production, invoices, settings] = await Promise.all([
      this.getAll('materials'),
      this.getAll('products'),
      this.getAll('production'),
      this.getAll('invoices'),
      this.getAll('settings')
    ]);

    const backupData = {
      app: 'RoseCosmetics',
      version: 1,
      exportedAt: new Date().toISOString(),
      counts: {
        materials: materials.length,
        products: products.length,
        production: production.length,
        invoices: invoices.length
      },
      data: {
        materials,
        products,
        production,
        invoices,
        settings
      }
    };

    return backupData;
  }

  async importFullBackup(backupObj) {
    await this._ensureDb();
    if (!backupObj || !backupObj.data) {
      throw new Error('ملف النسخة الاحتياطية غير صالح أو تالف');
    }

    const { materials = [], products = [], production = [], invoices = [], settings = [] } = backupObj.data;

    const tx = this.db.transaction(['materials', 'products', 'production', 'invoices', 'settings'], 'readwrite');

    tx.objectStore('materials').clear();
    tx.objectStore('products').clear();
    tx.objectStore('production').clear();
    tx.objectStore('invoices').clear();
    tx.objectStore('settings').clear();

    for (const m of materials) tx.objectStore('materials').add(m);
    for (const p of products) tx.objectStore('products').add(p);
    for (const b of production) tx.objectStore('production').add(b);
    for (const i of invoices) tx.objectStore('invoices').add(i);
    for (const s of settings) tx.objectStore('settings').add(s);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve({
        materials: materials.length,
        products: products.length,
        production: production.length,
        invoices: invoices.length
      });
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Seed Realistic Cosmetics Demo Data ---
  async seedDemoData() {
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
      await this.add('materials', {
        ...m,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    const allMats = await this.getAll('materials');
    const mByCode = {};
    allMats.forEach(m => { mByCode[m.code] = m; });

    // Sample Products with dynamic formulation calculations
    const sampleProducts = [
      {
        code: 'PRD-101',
        name: 'سيروم الذهب وفيتامين سي 30 مل',
        category: 'سيروم للبشرة',
        netWeight: 30, // 30 grams
        ingredients: [
          { materialId: mByCode['RM-004'].id, materialName: mByCode['RM-004'].name, grams: 3, costPerGram: mByCode['RM-004'].costPerGram, totalCost: 3 * mByCode['RM-004'].costPerGram },
          { materialId: mByCode['RM-003'].id, materialName: mByCode['RM-003'].name, grams: 1.5, costPerGram: mByCode['RM-003'].costPerGram, totalCost: 1.5 * mByCode['RM-003'].costPerGram },
          { materialId: mByCode['RM-008'].id, materialName: mByCode['RM-008'].name, grams: 24, costPerGram: mByCode['RM-008'].costPerGram, totalCost: 24 * mByCode['RM-008'].costPerGram },
          { materialId: mByCode['RM-010'].id, materialName: mByCode['RM-010'].name, grams: 0.3, costPerGram: mByCode['RM-010'].costPerGram, totalCost: 0.3 * mByCode['RM-010'].costPerGram },
          { materialId: mByCode['RM-006'].id, materialName: mByCode['RM-006'].name, grams: 0.2, costPerGram: mByCode['RM-006'].costPerGram, totalCost: 0.2 * mByCode['RM-006'].costPerGram }
        ],
        packagingCost: 12.0, // زجاجة قطارة كهرمانية + ستيكر فاخر + علبة
        laborCost: 5.0,
        rawMaterialsCost: 0, // Calculated below
        totalCost: 0,
        profitMargin: 80, // % margin
        profitType: 'percent',
        sellingPrice: 0,
        stockUnits: 45,
        minStockUnits: 10,
        notes: 'المنتج الأفضل مبيعاً - تفتيح ونضارة ومكافحة التجاعيد',
        createdAt: new Date().toISOString()
      },
      {
        code: 'PRD-102',
        name: 'كريم زبدة الشيا والأرغان الفائق 100 جم',
        category: 'كريمات وترطيب',
        netWeight: 100, // 100 grams
        ingredients: [
          { materialId: mByCode['RM-002'].id, materialName: mByCode['RM-002'].name, grams: 40, costPerGram: mByCode['RM-002'].costPerGram, totalCost: 40 * mByCode['RM-002'].costPerGram },
          { materialId: mByCode['RM-001'].id, materialName: mByCode['RM-001'].name, grams: 15, costPerGram: mByCode['RM-001'].costPerGram, totalCost: 15 * mByCode['RM-001'].costPerGram },
          { materialId: mByCode['RM-005'].id, materialName: mByCode['RM-005'].name, grams: 10, costPerGram: mByCode['RM-005'].costPerGram, totalCost: 10 * mByCode['RM-005'].costPerGram },
          { materialId: mByCode['RM-007'].id, materialName: mByCode['RM-007'].name, grams: 8, costPerGram: mByCode['RM-007'].costPerGram, totalCost: 8 * mByCode['RM-007'].costPerGram },
          { materialId: mByCode['RM-008'].id, materialName: mByCode['RM-008'].name, grams: 24, costPerGram: mByCode['RM-008'].costPerGram, totalCost: 24 * mByCode['RM-008'].costPerGram },
          { materialId: mByCode['RM-009'].id, materialName: mByCode['RM-009'].name, grams: 2, costPerGram: mByCode['RM-009'].costPerGram, totalCost: 2 * mByCode['RM-009'].costPerGram },
          { materialId: mByCode['RM-010'].id, materialName: mByCode['RM-010'].name, grams: 0.5, costPerGram: mByCode['RM-010'].costPerGram, totalCost: 0.5 * mByCode['RM-010'].costPerGram },
          { materialId: mByCode['RM-006'].id, materialName: mByCode['RM-006'].name, grams: 0.5, costPerGram: mByCode['RM-006'].costPerGram, totalCost: 0.5 * mByCode['RM-006'].costPerGram }
        ],
        packagingCost: 9.0, // برطمان ألومنيوم أنيق + استيكر
        laborCost: 6.0,
        rawMaterialsCost: 0,
        totalCost: 0,
        profitMargin: 70, // % margin
        profitType: 'percent',
        sellingPrice: 0,
        stockUnits: 30,
        minStockUnits: 8,
        notes: 'ترطيب عميق للبشرة الجافة والجسم',
        createdAt: new Date().toISOString()
      },
      {
        code: 'PRD-103',
        name: 'مقشر الجسم باللافندر والسكر البني 200 جم',
        category: 'مقشرات وعناية بالجسم',
        netWeight: 200,
        ingredients: [
          { materialId: mByCode['RM-012'].id, materialName: mByCode['RM-012'].name, grams: 140, costPerGram: mByCode['RM-012'].costPerGram, totalCost: 140 * mByCode['RM-012'].costPerGram },
          { materialId: mByCode['RM-005'].id, materialName: mByCode['RM-005'].name, grams: 35, costPerGram: mByCode['RM-005'].costPerGram, totalCost: 35 * mByCode['RM-005'].costPerGram },
          { materialId: mByCode['RM-002'].id, materialName: mByCode['RM-002'].name, grams: 20, costPerGram: mByCode['RM-002'].costPerGram, totalCost: 20 * mByCode['RM-002'].costPerGram },
          { materialId: mByCode['RM-006'].id, materialName: mByCode['RM-006'].name, grams: 3, costPerGram: mByCode['RM-006'].costPerGram, totalCost: 3 * mByCode['RM-006'].costPerGram },
          { materialId: mByCode['RM-010'].id, materialName: mByCode['RM-010'].name, grams: 2, costPerGram: mByCode['RM-010'].costPerGram, totalCost: 2 * mByCode['RM-010'].costPerGram }
        ],
        packagingCost: 8.0,
        laborCost: 4.0,
        rawMaterialsCost: 0,
        totalCost: 0,
        profitMargin: 65,
        profitType: 'percent',
        sellingPrice: 0,
        stockUnits: 25,
        minStockUnits: 5,
        notes: 'إزالة الجلد الميت ونعومة فائقة برائحة اللافندر',
        createdAt: new Date().toISOString()
      },
      {
        code: 'PRD-104',
        name: 'جل الألوفيرا وماء الورد المهدئ 150 مل',
        category: 'مائيات ومستخلصات',
        netWeight: 150,
        ingredients: [
          { materialId: mByCode['RM-011'].id, materialName: mByCode['RM-011'].name, grams: 100, costPerGram: mByCode['RM-011'].costPerGram, totalCost: 100 * mByCode['RM-011'].costPerGram },
          { materialId: mByCode['RM-008'].id, materialName: mByCode['RM-008'].name, grams: 48, costPerGram: mByCode['RM-008'].costPerGram, totalCost: 48 * mByCode['RM-008'].costPerGram },
          { materialId: mByCode['RM-010'].id, materialName: mByCode['RM-010'].name, grams: 1.5, costPerGram: mByCode['RM-010'].costPerGram, totalCost: 1.5 * mByCode['RM-010'].costPerGram },
          { materialId: mByCode['RM-006'].id, materialName: mByCode['RM-006'].name, grams: 0.5, costPerGram: mByCode['RM-006'].costPerGram, totalCost: 0.5 * mByCode['RM-006'].costPerGram }
        ],
        packagingCost: 7.5,
        laborCost: 3.5,
        rawMaterialsCost: 0,
        totalCost: 0,
        profitMargin: 75,
        profitType: 'percent',
        sellingPrice: 0,
        stockUnits: 38,
        minStockUnits: 8,
        notes: 'مهدئ للبشرة بعد التعرض للشمس وعلاج الاحمرار',
        createdAt: new Date().toISOString()
      }
    ];

    // Compute prices precisely
    for (const p of sampleProducts) {
      let rawCost = 0;
      for (const ing of p.ingredients) {
        rawCost += ing.totalCost;
      }
      p.rawMaterialsCost = Math.round(rawCost * 100) / 100;
      p.totalCost = Math.round((p.rawMaterialsCost + p.packagingCost + p.laborCost) * 100) / 100;
      
      let price = 0;
      if (p.profitType === 'percent') {
        price = p.totalCost * (1 + (p.profitMargin / 100));
      } else {
        price = p.totalCost + p.profitMargin;
      }
      p.sellingPrice = Math.ceil(price / 5) * 5; // rounded neatly to nearest 5
      await this.add('products', p);
    }

    // Add 2 initial sample invoices for demo stats
    const prods = await this.getAll('products');
    if (prods.length >= 2) {
      await this.createInvoice({
        customerName: 'سارة أحمد',
        customerPhone: '01234567890',
        paymentMethod: 'cash',
        items: [
          { productId: prods[0].id, productName: prods[0].name, quantity: 2, unitPrice: prods[0].sellingPrice },
          { productId: prods[1].id, productName: prods[1].name, quantity: 1, unitPrice: prods[1].sellingPrice }
        ],
        discount: 10,
        notes: 'طلب توصيل منزلي'
      });

      await this.createInvoice({
        customerName: 'نورا محمود',
        customerPhone: '01122334455',
        paymentMethod: 'card',
        items: [
          { productId: prods[2].id, productName: prods[2].name, quantity: 1, unitPrice: prods[2].sellingPrice },
          { productId: prods[3].id, productName: prods[3].name, quantity: 2, unitPrice: prods[3].sellingPrice }
        ],
        discount: 0,
        notes: 'شراء مباشر من المعرض'
      });
    }
  }
}

// Global DB instance
const db = new CosmeticsDB();
