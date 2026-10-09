/**
 * RoseCosmetics - Settings, Backup & Restore Manager (الإعدادات والنسخ الاحتياطي)
 * Supports full browser database export to JSON, import from JSON, CSV exports,
 * and store profile customization (currency, tax, invoice header/footer).
 */

const SettingsManager = {
  async init() {
    this.bindEvents();
    await this.loadSettingsToForm();
  },

  bindEvents() {
    // Save Settings Form
    const form = document.getElementById('form-settings');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSaveSettings(e));
    }

    // Export Backup JSON
    const btnExport = document.getElementById('btn-export-backup');
    if (btnExport) {
      btnExport.addEventListener('click', () => this.handleExportBackup());
    }

    // Import Backup JSON
    const fileImportInput = document.getElementById('file-import-backup');
    if (fileImportInput) {
      fileImportInput.addEventListener('change', (e) => this.handleImportBackup(e));
    }

    // Export Invoices CSV
    const btnCsvInvoices = document.getElementById('btn-export-csv-invoices');
    if (btnCsvInvoices) {
      btnCsvInvoices.addEventListener('click', () => this.exportInvoicesCSV());
    }

    // Export Products CSV
    const btnCsvProducts = document.getElementById('btn-export-csv-products');
    if (btnCsvProducts) {
      btnCsvProducts.addEventListener('click', () => this.exportProductsCSV());
    }

    // Reset Demo Data
    const btnResetDemo = document.getElementById('btn-reset-demo-data');
    if (btnResetDemo) {
      btnResetDemo.addEventListener('click', () => this.handleResetDemoData());
    }
  },

  async loadSettingsToForm() {
    const config = (await db.getSetting('appConfig')) || {};
    
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val !== undefined ? val : '';
    };

    setVal('setting-store-name', config.storeName || '');
    setVal('setting-store-sub', config.storeSubtitle || '');
    setVal('setting-currency', config.currency || 'ج.م');
    setVal('setting-phone', config.phone || '');
    setVal('setting-address', config.address || '');
    setVal('setting-footer', config.invoiceFooter || '');
    
    const taxCheck = document.getElementById('setting-tax-enabled');
    if (taxCheck) taxCheck.checked = Boolean(config.taxEnabled);

    setVal('setting-tax-percent', config.taxPercentage || 14);

    // Apply currency badge in header
    this.updateHeaderBrand(config);
  },

  updateHeaderBrand(config) {
    const brandName = document.getElementById('app-brand-name');
    const brandSub = document.getElementById('app-brand-sub');
    if (brandName && config.storeName) brandName.textContent = config.storeName;
    if (brandSub && config.storeSubtitle) brandSub.textContent = config.storeSubtitle;
  },

  async handleSaveSettings(e) {
    e.preventDefault();

    const config = (await db.getSetting('appConfig')) || {};
    
    config.storeName = document.getElementById('setting-store-name').value.trim() || 'روز لمستحضرات التجميل';
    config.storeSubtitle = document.getElementById('setting-store-sub').value.trim();
    config.currency = document.getElementById('setting-currency').value.trim() || 'ج.م';
    config.phone = document.getElementById('setting-phone').value.trim();
    config.address = document.getElementById('setting-address').value.trim();
    config.invoiceFooter = document.getElementById('setting-footer').value.trim();
    config.taxEnabled = document.getElementById('setting-tax-enabled').checked;
    config.taxPercentage = parseFloat(document.getElementById('setting-tax-percent').value) || 0;

    await db.setSetting('appConfig', config);
    this.updateHeaderBrand(config);
    App.toast('تم حفظ إعدادات النظام بنجاح', 'success');

    // Refresh other tabs
    if (window.MaterialsManager) await MaterialsManager.render();
    if (window.ProductsManager) await ProductsManager.render();
    if (window.POS) await POS.refreshCatalog();
    if (window.InvoicesManager) await InvoicesManager.render();
    if (window.InventoryManager) await InventoryManager.render();
  },

  // --- Export JSON Backup ---
  async handleExportBackup() {
    try {
      const backup = await db.exportFullBackup();
      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      const dateTag = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `RoseCosmetics_Backup_${dateTag}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      App.toast('تم تصدير النسخة الاحتياطية بنجاح وتنزيلها على جهازك', 'success');
    } catch (err) {
      console.error(err);
      App.toast('حدث خطأ أثناء تصدير النسخة الاحتياطية', 'error');
    }
  },

  // --- Import JSON Backup ---
  async handleImportBackup(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!confirm('تنبيه هام: استرجاع النسخة الاحتياطية سيستبدل البيانات الحالية بالكامل بمحتويات ملف النسخة. هل تريد المتابعة؟')) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backupObj = JSON.parse(event.target.result);
        const stats = await db.importFullBackup(backupObj);
        App.toast(`تم استرجاع النسخة الاحتياطية بنجاح! (${stats.products} منتج، ${stats.materials} مادة خام، ${stats.invoices} فاتورة)`, 'success');
        
        e.target.value = '';
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } catch (err) {
        console.error(err);
        App.toast(`فشل استرجاع النسخة الاحتياطية: ${err.message || 'الملف تالف أو غير صالح'}`, 'error');
      }
    };
    reader.readAsText(file);
  },

  // --- Export CSV Helpers ---
  async exportInvoicesCSV() {
    const invoices = await db.getAll('invoices');
    if (invoices.length === 0) {
      App.toast('لا توجد فواتير لتصديرها', 'warning');
      return;
    }

    let csv = '\uFEFF'; // UTF-8 BOM for Excel Arabic support
    csv += 'رقم الفاتورة,التاريخ,اسم العميل,الهاتف,عدد الأصناف,المجموع,الخصم,الضريبة,الصافي النهائي,صافي الربح,طريقة الدفع,الحالة\n';

    invoices.forEach(inv => {
      const dateStr = new Date(inv.date).toLocaleDateString('ar-EG');
      const itemsCount = (inv.items || []).length;
      csv += `"${inv.invoiceNumber}","${dateStr}","${inv.customerName || ''}","${inv.customerPhone || ''}",${itemsCount},${inv.subtotal},${inv.discount},${inv.taxAmount || 0},${inv.total},${inv.netProfit || 0},"${inv.paymentMethod}","${inv.status}"\n`;
    });

    this.downloadFile(csv, `سجل_فواتير_مبيعات_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
    App.toast('تم تصدير سجل الفواتير إلى ملف CSV للإكسل بنجاح', 'success');
  },

  async exportProductsCSV() {
    const products = await db.getAll('products');
    if (products.length === 0) {
      App.toast('لا توجد منتجات لتصديرها', 'warning');
      return;
    }

    let csv = '\uFEFF';
    csv += 'كود المنتج,اسم المنتج,التصنيف,الوزن الصافي (جم),تكلفة المواد الخام,تكلفة التغليف,المصنعية,التكلفة الإجمالية,سعر البيع,هامش الربح,الرصيد المتاح بالمخزن\n';

    products.forEach(p => {
      csv += `"${p.code}","${p.name}","${p.category || ''}",${p.netWeight || 0},${p.rawMaterialsCost || 0},${p.packagingCost || 0},${p.laborCost || 0},${p.totalCost || 0},${p.sellingPrice || 0},"${p.profitMargin}%",${p.stockUnits || 0}\n`;
    });

    this.downloadFile(csv, `قائمة_المنتجات_والتراكيب_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
    App.toast('تم تصدير قائمة المنتجات والتكاليف بنجاح', 'success');
  },

  downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async handleResetDemoData(skipConfirm = false) {
    if (!skipConfirm) {
      if (!confirm('هل ترغب في شحن البيانات التجريبية لمستحضرات التجميل الآن (زيوت طبيعية، زبدة شيا، سيروم فيتامين سي، كريمات ترطيب، فواتير عينة)؟')) return;
    }

    try {
      await db.clear('materials');
      await db.clear('products');
      await db.clear('production');
      await db.clear('invoices');
      await db.seedDemoData();

      App.toast('تمت إضافة البيانات التجريبية بنجاح! جاري التحديث...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err) {
      console.error(err);
      App.toast('حدث خطأ أثناء استعادة البيانات: ' + (err.message || ''), 'error');
    }
  }
};
