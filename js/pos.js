/**
 * RoseCosmetics - Point of Sale (POS) & Billing System
 * Interactive cashier screen, cart management, instant stock validation,
 * discount, payment method, and instant 80mm thermal & A4 receipt printing.
 */

const POS = {
  cart: [],
  catalog: [],
  currentCategory: 'all',
  searchQuery: '',

  async init() {
    this.bindEvents();
    await this.refreshCatalog();
  },

  async refreshCatalog() {
    this.catalog = await db.getAll('products');
    this.renderCategories();
    this.renderCatalog();
    this.updateCartUI();
  },

  bindEvents() {
    // Search input
    const searchInput = document.getElementById('pos-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.renderCatalog();
      });
      // Handle barcode scanner enter key
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleBarcodeScan(this.searchQuery);
        }
      });
    }

    // Discount input
    const discountInput = document.getElementById('pos-discount');
    if (discountInput) {
      discountInput.addEventListener('input', () => this.updateCartUI());
    }

    // Clear cart button
    const btnClear = document.getElementById('btn-clear-cart');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        if (this.cart.length === 0) return;
        if (confirm('هل تريد إفراغ سلة المشتريات الحالية؟')) {
          this.cart = [];
          this.updateCartUI();
        }
      });
    }

    // Checkout button
    const btnCheckout = document.getElementById('btn-checkout');
    if (btnCheckout) {
      btnCheckout.addEventListener('click', () => this.openCheckoutModal());
    }

    // Checkout modal actions
    const btnConfirmPay = document.getElementById('btn-confirm-payment');
    if (btnConfirmPay) {
      btnConfirmPay.addEventListener('click', () => this.processSale(true));
    }
    const btnConfirmPayNoPrint = document.getElementById('btn-confirm-payment-noprint');
    if (btnConfirmPayNoPrint) {
      btnConfirmPayNoPrint.addEventListener('click', () => this.processSale(false));
    }
  },

  renderCategories() {
    const container = document.getElementById('pos-categories-bar');
    if (!container) return;

    const cats = ['all', ...new Set(this.catalog.map(p => p.category).filter(Boolean))];
    container.innerHTML = cats.map(cat => `
      <button class="cat-btn ${cat === this.currentCategory ? 'active' : ''}" onclick="POS.setCategory('${cat}')">
        ${cat === 'all' ? 'جميع المنتجات' : cat}
      </button>
    `).join('');
  },

  setCategory(cat) {
    this.currentCategory = cat;
    this.renderCategories();
    this.renderCatalog();
  },

  renderCatalog() {
    const grid = document.getElementById('pos-products-grid');
    if (!grid) return;

    let filtered = this.catalog;
    if (this.currentCategory !== 'all') {
      filtered = filtered.filter(p => p.category === this.currentCategory);
    }
    if (this.searchQuery) {
      filtered = filtered.filter(p =>
        (p.name && p.name.toLowerCase().includes(this.searchQuery)) ||
        (p.code && p.code.toLowerCase().includes(this.searchQuery))
      );
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding: 3rem 1rem; color:var(--text-muted);">
          لا توجد منتجات مطابقة في المعرض
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(prod => {
      const stock = prod.stockUnits || 0;
      const isOutOfStock = stock <= 0;
      const isLow = stock <= (prod.minStockUnits || 0);

      return `
        <div class="product-card ${isOutOfStock ? 'out-of-stock' : ''}" onclick="POS.addToCart(${prod.id})">
          <span class="stock-tag ${isOutOfStock ? 'badge-danger' : isLow ? 'badge-warning' : 'badge-success'}">
            ${isOutOfStock ? 'نفد الرصيد' : `${stock} عبوة`}
          </span>
          <div>
            <div class="product-badge-cat">${prod.category || 'مستحضرات تجميل'}</div>
            <h4>${prod.name}</h4>
            <div style="font-size:0.75rem; color:var(--text-muted);">كود: ${prod.code || '-'} | ${prod.netWeight || 0} جم</div>
          </div>
          <div class="price-row">
            <span class="price">${(prod.sellingPrice || 0).toFixed(2)}</span>
            <button class="btn btn-sm btn-primary" style="border-radius:50%; width:32px; height:32px; padding:0;" title="إضافة للسلة">
              +
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  handleBarcodeScan(code) {
    const matched = this.catalog.find(p => p.code && p.code.toLowerCase() === code);
    if (matched) {
      this.addToCart(matched.id);
      document.getElementById('pos-search').value = '';
      this.searchQuery = '';
      this.renderCatalog();
    }
  },

  addToCart(productId) {
    const prod = this.catalog.find(p => p.id === productId);
    if (!prod) return;

    const availableStock = prod.stockUnits || 0;
    if (availableStock <= 0) {
      App.toast(`المنتج "${prod.name}" نفد من المخزون`, 'warning');
      return;
    }

    const existing = this.cart.find(it => it.productId === productId);
    if (existing) {
      if (existing.quantity + 1 > availableStock) {
        App.toast(`لا يمكن إضافة المزيد، الرصيد المتاح هو ${availableStock} عبوة فقط`, 'warning');
        return;
      }
      existing.quantity += 1;
    } else {
      this.cart.push({
        productId: prod.id,
        productName: prod.name,
        code: prod.code,
        unitPrice: prod.sellingPrice || 0,
        unitCost: prod.totalCost || 0,
        quantity: 1,
        maxStock: availableStock
      });
    }

    this.updateCartUI();
  },

  updateQuantity(productId, newQty) {
    const item = this.cart.find(it => it.productId === productId);
    if (!item) return;

    newQty = parseInt(newQty) || 0;
    if (newQty <= 0) {
      this.removeFromCart(productId);
      return;
    }

    if (newQty > item.maxStock) {
      App.toast(`الكمية المتاحة في المخزن هي ${item.maxStock} فقط`, 'warning');
      item.quantity = item.maxStock;
    } else {
      item.quantity = newQty;
    }

    this.updateCartUI();
  },

  removeFromCart(productId) {
    this.cart = this.cart.filter(it => it.productId !== productId);
    this.updateCartUI();
  },

  async updateCartUI() {
    const container = document.getElementById('pos-cart-items');
    const badgeCount = document.getElementById('cart-items-count');
    const config = (await db.getSetting('appConfig')) || { currency: 'ج.م' };
    const curr = config.currency || 'ج.م';

    if (badgeCount) {
      const totalUnits = this.cart.reduce((sum, it) => sum + it.quantity, 0);
      badgeCount.textContent = `${totalUnits} صنف`;
    }

    if (!container) return;

    if (this.cart.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding: 3rem 1rem; color:var(--text-muted);">
          <svg style="width:48px; height:48px; stroke:var(--text-muted); margin-bottom:0.5rem;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
          </svg>
          <p>السلة فارغة حالياً</p>
          <span style="font-size:0.75rem;">اختر المنتجات لإضافتها للفاتورة</span>
        </div>
      `;
    } else {
      container.innerHTML = this.cart.map(item => `
        <div class="cart-item">
          <div class="cart-item-info">
            <div class="cart-item-title">${item.productName}</div>
            <div class="cart-item-price">${(item.unitPrice).toFixed(2)} ${curr}</div>
          </div>
          <div class="cart-qty-ctrl">
            <button class="qty-btn" onclick="POS.updateQuantity(${item.productId}, ${item.quantity - 1})">-</button>
            <input type="number" min="1" max="${item.maxStock}" class="qty-input" value="${item.quantity}" onchange="POS.updateQuantity(${item.productId}, this.value)">
            <button class="qty-btn" onclick="POS.updateQuantity(${item.productId}, ${item.quantity + 1})">+</button>
          </div>
          <div class="cart-item-total">
            ${(item.unitPrice * item.quantity).toFixed(2)}
          </div>
          <button class="btn btn-sm btn-danger" style="padding:2px 6px;" onclick="POS.removeFromCart(${item.productId})" title="إزالة">&times;</button>
        </div>
      `).join('');
    }

    // Calculations
    const subtotal = this.cart.reduce((sum, it) => sum + (it.unitPrice * it.quantity), 0);
    const discountInput = document.getElementById('pos-discount');
    const discount = discountInput ? (parseFloat(discountInput.value) || 0) : 0;

    let taxAmount = 0;
    if (config.taxEnabled && config.taxPercentage > 0) {
      taxAmount = Math.max(0, (subtotal - discount) * (config.taxPercentage / 100));
    }

    const total = Math.max(0, subtotal - discount + taxAmount);

    document.getElementById('pos-subtotal-val').textContent = `${subtotal.toFixed(2)} ${curr}`;
    document.getElementById('pos-tax-val').textContent = `${taxAmount.toFixed(2)} ${curr}`;
    document.getElementById('pos-total-val').textContent = `${total.toFixed(2)} ${curr}`;

    const btnCheckout = document.getElementById('btn-checkout');
    if (btnCheckout) {
      btnCheckout.disabled = this.cart.length === 0;
    }
  },

  async openCheckoutModal() {
    if (this.cart.length === 0) return;

    const modal = document.getElementById('modal-checkout');
    if (!modal) return;

    const config = (await db.getSetting('appConfig')) || { currency: 'ج.م' };
    const curr = config.currency || 'ج.م';

    const subtotal = this.cart.reduce((sum, it) => sum + (it.unitPrice * it.quantity), 0);
    const discount = parseFloat(document.getElementById('pos-discount').value) || 0;
    const total = Math.max(0, subtotal - discount);

    document.getElementById('checkout-modal-total').textContent = `${total.toFixed(2)} ${curr}`;
    document.getElementById('checkout-customer-name').value = 'عميل نقدي';
    document.getElementById('checkout-customer-phone').value = '';
    document.getElementById('checkout-payment-method').value = 'cash';
    document.getElementById('checkout-notes').value = '';

    App.openModal('modal-checkout');
  },

  async processSale(shouldPrint = true) {
    if (this.cart.length === 0) return;

    const customerName = document.getElementById('checkout-customer-name').value.trim() || 'عميل نقدي';
    const customerPhone = document.getElementById('checkout-customer-phone').value.trim();
    const paymentMethod = document.getElementById('checkout-payment-method').value;
    const notes = document.getElementById('checkout-notes').value.trim();
    const discount = parseFloat(document.getElementById('pos-discount').value) || 0;

    const config = (await db.getSetting('appConfig')) || {};
    const subtotal = this.cart.reduce((sum, it) => sum + (it.unitPrice * it.quantity), 0);
    let taxAmount = 0;
    if (config.taxEnabled && config.taxPercentage > 0) {
      taxAmount = Math.max(0, (subtotal - discount) * (config.taxPercentage / 100));
    }

    try {
      const invoice = await db.createInvoice({
        customerName,
        customerPhone,
        paymentMethod,
        discount,
        taxAmount,
        notes,
        items: this.cart.map(it => ({
          productId: it.productId,
          productName: it.productName,
          quantity: it.quantity,
          unitPrice: it.unitPrice
        }))
      });

      App.toast(`تم حفظ الفاتورة بنجاح برقم ${invoice.invoiceNumber}`, 'success');
      App.closeModal('modal-checkout');

      // Clear cart
      this.cart = [];
      document.getElementById('pos-discount').value = 0;
      await this.refreshCatalog();
      if (window.InvoicesManager) await InvoicesManager.render();
      if (window.App) await App.updateDashboard();

      if (shouldPrint) {
        this.printThermalReceipt(invoice);
      }
    } catch (err) {
      console.error(err);
      App.toast(err.message || 'فشلت عملية البيع', 'error');
    }
  },

  async printThermalReceipt(invoice) {
    const config = (await db.getSetting('appConfig')) || {};
    const curr = config.currency || 'ج.م';
    const printArea = document.getElementById('print-area');
    if (!printArea) return;

    const dateStr = new Date(invoice.date).toLocaleString('ar-EG');
    const paymentMethodText = {
      cash: 'نقدي (كاش)',
      card: 'بطاقة ائتمان / شبكة',
      transfer: 'تحويل بنكي / محفظة',
      credit: 'آجل'
    }[invoice.paymentMethod] || invoice.paymentMethod;

    printArea.innerHTML = `
      <div class="receipt-thermal">
        <div class="rc-header">
          <div class="rc-title">${config.storeName || 'مستحضرات تجميل'}</div>
          <div style="font-size:11px;">${config.storeSubtitle || ''}</div>
          <div style="font-size:11px;">هاتف: ${config.phone || '-'}</div>
          <div style="font-size:10px;">${config.address || ''}</div>
        </div>

        <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:11px;">
          <span>رقم الفاتورة:</span>
          <strong>${invoice.invoiceNumber}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:10px;">
          <span>التاريخ:</span>
          <span>${dateStr}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:11px;">
          <span>العميل:</span>
          <span>${invoice.customerName}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:10px;">
          <span>طريقة الدفع:</span>
          <span>${paymentMethodText}</span>
        </div>

        <table>
          <thead>
            <tr>
              <th style="text-align:right;">الصنف</th>
              <th style="text-align:center;">الكمية</th>
              <th style="text-align:left;">السعر</th>
              <th style="text-align:left;">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${(invoice.items || []).map(it => `
              <tr>
                <td>${it.productName}</td>
                <td style="text-align:center;">${it.quantity}</td>
                <td style="text-align:left;">${(it.unitPrice).toFixed(1)}</td>
                <td style="text-align:left;">${(it.total).toFixed(1)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="rc-totals">
          <div style="display:flex; justify-content:space-between; font-size:11px;">
            <span>المجموع:</span>
            <span>${(invoice.subtotal).toFixed(2)} ${curr}</span>
          </div>
          ${invoice.discount > 0 ? `
            <div style="display:flex; justify-content:space-between; font-size:11px; color:#b91c1c;">
              <span>الخصم:</span>
              <span>-${(invoice.discount).toFixed(2)} ${curr}</span>
            </div>
          ` : ''}
          ${invoice.taxAmount > 0 ? `
            <div style="display:flex; justify-content:space-between; font-size:11px;">
              <span>الضريبة:</span>
              <span>+${(invoice.taxAmount).toFixed(2)} ${curr}</span>
            </div>
          ` : ''}
          <div style="display:flex; justify-content:space-between; margin-top:4px; font-size:14px; font-weight:bold;">
            <span>الصافي المطلوب:</span>
            <span>${(invoice.total).toFixed(2)} ${curr}</span>
          </div>
        </div>

        <div class="rc-footer">
          <p>${config.invoiceFooter || 'شكراً لتعاملكم معنا'}</p>
        </div>
      </div>
    `;

    window.print();
  }
};
