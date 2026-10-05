/**
 * RoseCosmetics - Inventory & Stock Valuation Manager (المخزون والجرد المالي)
 * Tracks raw materials and finished products, low stock warnings, and total inventory value.
 */

const InventoryManager = {
  currentTab: 'materials', // 'materials' | 'products'

  async init() {
    this.bindEvents();
    await this.render();
  },

  bindEvents() {
    const tabBtns = document.querySelectorAll('.inv-subtab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        tabBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentTab = e.target.dataset.subtab;
        this.renderSubTab();
      });
    });
  },

  async render() {
    await this.updateTotals();
    this.renderSubTab();
  },

  async updateTotals() {
    const [materials, products] = await Promise.all([
      db.getAll('materials'),
      db.getAll('products')
    ]);

    const config = (await db.getSetting('appConfig')) || { currency: 'ج.م' };
    const curr = config.currency || 'ج.م';

    // Materials total cost
    let materialsValue = 0;
    let lowMaterialsCount = 0;
    materials.forEach(m => {
      materialsValue += (m.stockGrams || 0) * (m.costPerGram || 0);
      if ((m.stockGrams || 0) <= (m.minStockGrams || 0)) lowMaterialsCount++;
    });

    // Products total cost and potential revenue
    let productsCostValue = 0;
    let productsSalesValue = 0;
    let lowProductsCount = 0;
    products.forEach(p => {
      const units = p.stockUnits || 0;
      productsCostValue += units * (p.totalCost || 0);
      productsSalesValue += units * (p.sellingPrice || 0);
      if (units <= (p.minStockUnits || 0)) lowProductsCount++;
    });

    const potentialProfit = productsSalesValue - productsCostValue;

    document.getElementById('inv-materials-value').textContent = `${materialsValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr}`;
    document.getElementById('inv-products-cost-value').textContent = `${productsCostValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr}`;
    document.getElementById('inv-potential-sales-value').textContent = `${productsSalesValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr}`;
    document.getElementById('inv-potential-profit-value').textContent = `+${potentialProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr}`;

    // Badges
    const badgeMat = document.getElementById('inv-low-mat-badge');
    const badgeProd = document.getElementById('inv-low-prod-badge');
    if (badgeMat) badgeMat.textContent = `${lowMaterialsCount} مواد تحت حد الطلب`;
    if (badgeProd) badgeProd.textContent = `${lowProductsCount} منتجات قاربت على النفاد`;
  },

  async renderSubTab() {
    const config = (await db.getSetting('appConfig')) || { currency: 'ج.م' };
    const curr = config.currency || 'ج.م';

    const matTable = document.getElementById('inv-table-materials');
    const prodTable = document.getElementById('inv-table-products');

    if (this.currentTab === 'materials') {
      if (matTable) matTable.style.display = 'table';
      if (prodTable) prodTable.style.display = 'none';

      const materials = await db.getAll('materials');
      const tbody = document.getElementById('inv-materials-tbody');
      if (!tbody) return;

      tbody.innerHTML = materials.map(m => {
        const isLow = (m.stockGrams || 0) <= (m.minStockGrams || 0);
        const totalVal = ((m.stockGrams || 0) * (m.costPerGram || 0)).toFixed(2);

        return `
          <tr>
            <td><strong>${m.code || '-'}</strong></td>
            <td><strong>${m.name}</strong></td>
            <td><span class="badge badge-secondary">${m.category || 'عام'}</span></td>
            <td><strong>${(m.stockGrams || 0).toLocaleString()} جم</strong> (${((m.stockGrams || 0) / 1000).toFixed(2)} كجم)</td>
            <td>${(m.costPerGram || 0).toFixed(3)} ${curr}</td>
            <td><strong>${totalVal} ${curr}</strong></td>
            <td>
              <span class="badge ${isLow ? 'badge-danger' : 'badge-success'}">
                ${isLow ? 'أوشكت على النفاد' : 'رصيد كافٍ'}
              </span>
            </td>
          </tr>
        `;
      }).join('');
    } else {
      if (matTable) matTable.style.display = 'none';
      if (prodTable) prodTable.style.display = 'table';

      const products = await db.getAll('products');
      const tbody = document.getElementById('inv-products-tbody');
      if (!tbody) return;

      tbody.innerHTML = products.map(p => {
        const units = p.stockUnits || 0;
        const isLow = units <= (p.minStockUnits || 0);
        const totalCostVal = (units * (p.totalCost || 0)).toFixed(2);
        const totalSaleVal = (units * (p.sellingPrice || 0)).toFixed(2);
        const expectedProfit = (units * ((p.sellingPrice || 0) - (p.totalCost || 0))).toFixed(2);

        return `
          <tr>
            <td><strong>${p.code || '-'}</strong></td>
            <td><strong>${p.name}</strong></td>
            <td><span class="badge badge-secondary">${p.category || 'عام'}</span></td>
            <td><strong>${units.toLocaleString()} عبوة</strong></td>
            <td>${(p.totalCost || 0).toFixed(2)} ${curr}</td>
            <td><strong style="color:var(--accent);">${(p.sellingPrice || 0).toFixed(2)} ${curr}</strong></td>
            <td>${totalCostVal} ${curr}</td>
            <td><strong>${totalSaleVal} ${curr}</strong></td>
            <td><span class="badge badge-success">+${expectedProfit} ${curr}</span></td>
            <td>
              <span class="badge ${isLow ? 'badge-danger' : 'badge-success'}">
                ${units <= 0 ? 'منتهي' : isLow ? 'منخفض' : 'متوفر'}
              </span>
            </td>
          </tr>
        `;
      }).join('');
    }
  }
};
