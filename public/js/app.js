/**
 * RoseCosmetics - Core Application Controller
 * Handles navigation, tabs routing, dashboard metrics, modals, and toasts.
 */

const App = {
  currentTab: 'dashboard',

  async init() {
    this.bindNavigation();
    this.bindModals();
    this.bindMobileDrawer();

    // Initialize modules
    await MaterialsManager.init();
    await ProductsManager.init();
    await POS.init();
    await InvoicesManager.init();
    await InventoryManager.init();
    await SettingsManager.init();

    // Check if products exist, otherwise seed immediately and re-render
    const prodCount = await db.count('products');
    if (prodCount === 0) {
      console.log('Seeding demo cosmetics data...');
      await db.seedDemoData();
      await MaterialsManager.render();
      await ProductsManager.render();
      await POS.refreshCatalog();
      await InvoicesManager.render();
      await InventoryManager.render();
    }

    await this.updateDashboard();

    // Check for stock alerts to display notification badge in sidebar
    await this.checkLowStockBadges();
  },

  bindNavigation() {
    // Desktop sidebar navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = item.dataset.tab;
        this.switchTab(tab);
        this.closeMobileDrawer();
      });
    });

    // Mobile bottom navigation bar
    const bottomNavItems = document.querySelectorAll('.bottom-nav-item[data-tab]');
    bottomNavItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = item.dataset.tab;
        this.switchTab(tab);
        this.closeMobileDrawer();
      });
    });

    // Quick action buttons in topbar or dashboard
    const quickPosBtn = document.getElementById('btn-quick-pos');
    if (quickPosBtn) {
      quickPosBtn.addEventListener('click', () => this.switchTab('pos'));
    }
  },

  switchTab(tabId) {
    this.currentTab = tabId;

    // Update active class on desktop sidebar nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tabId);
    });

    // Update active class on mobile bottom nav
    document.querySelectorAll('.bottom-nav-item[data-tab]').forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tabId);
    });

    // Switch tab pane
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('active');
    });
    const targetPane = document.getElementById(`tab-${tabId}`);
    if (targetPane) {
      targetPane.classList.add('active');
    }

    // Scroll to top of content on tab switch
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Update Topbar Title
    const titles = {
      dashboard: { title: 'لوحة التحكم والمؤشرات', sub: 'نظرة عامة على المبيعات، الأرباح، والمخزون' },
      pos: { title: 'نقطة البيع والكاشير', sub: 'إصدار الفواتير وطباعة الإيصالات الفورية' },
      materials: { title: 'المواد الخام بالجرام', sub: 'إدارة وتتبع رصيد الخامات وتكلفتها بالجرام والكيلو' },
      products: { title: 'المنتجات والتصنيع (BOM)', sub: 'تركيبات المستحضرات، حساب التكلفة، وهامش الربح والإنتاج' },
      invoices: { title: 'سجل الفواتير والمبيعات', sub: 'متابعة الفواتير السابقة، الطباعة، ومرتجعات المبيعات' },
      inventory: { title: 'المخزون والجرد المالي', sub: 'جرد الخامات والمنتجات وقيمتها السوقية وتنبيهات النواقص' },
      settings: { title: 'إعدادات النظام والنسخ الاحتياطي', sub: 'تخصيص المتجر، تصدير واسترجاع قاعدة البيانات في المتصفح' }
    };

    const header = titles[tabId] || { title: 'نظام إدارة المبيعات', sub: '' };
    const topTitle = document.getElementById('topbar-title');
    const topSub = document.getElementById('topbar-subtitle');
    if (topTitle) topTitle.textContent = header.title;
    if (topSub) topSub.textContent = header.sub;

    // Trigger tab-specific refresh
    if (tabId === 'dashboard') this.updateDashboard();
    if (tabId === 'inventory') InventoryManager.render();
    if (tabId === 'pos') POS.refreshCatalog();
  },

  bindMobileDrawer() {
    const toggleBtn = document.getElementById('menu-toggle-btn');
    const bottomMenuBtn = document.getElementById('bottom-nav-menu-btn');
    const closeBtn = document.getElementById('sidebar-close-btn');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    const openDrawer = (e) => {
      if (e) e.preventDefault();
      if (sidebar) sidebar.classList.add('open');
      if (overlay) overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    };

    const closeDrawer = (e) => {
      if (e) e.preventDefault();
      this.closeMobileDrawer();
    };

    if (toggleBtn) {
      toggleBtn.addEventListener('click', openDrawer);
      toggleBtn.addEventListener('touchend', (e) => { e.preventDefault(); openDrawer(); });
    }

    if (bottomMenuBtn) {
      bottomMenuBtn.addEventListener('click', openDrawer);
      bottomMenuBtn.addEventListener('touchend', (e) => { e.preventDefault(); openDrawer(); });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closeDrawer);
      closeBtn.addEventListener('touchend', (e) => { e.preventDefault(); closeDrawer(); });
    }

    if (overlay) {
      overlay.addEventListener('click', closeDrawer);
      overlay.addEventListener('touchend', (e) => { e.preventDefault(); closeDrawer(); });
    }
  },

  closeMobileDrawer() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
  },

  bindModals() {
    // Backdrop close
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal(modal.id);
        }
      });
    });

    // Close buttons
    document.querySelectorAll('.modal-close, [data-modal-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-backdrop');
        if (modal) this.closeModal(modal.id);
      });
    });
  },

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('open');
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('open');
    }
  },

  toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg style="width:20px;height:20px;stroke:#34d399;flex-shrink:0;" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg style="width:20px;height:20px;stroke:#f87171;flex-shrink:0;" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    } else {
      iconSvg = '<svg style="width:20px;height:20px;stroke:#fbbf24;flex-shrink:0;" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
    }

    toast.innerHTML = `${iconSvg}<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  async updateDashboard() {
    const [invoices, products, materials] = await Promise.all([
      db.getAll('invoices'),
      db.getAll('products'),
      db.getAll('materials')
    ]);

    const config = (await db.getSetting('appConfig')) || { currency: 'ج.م' };
    const curr = config.currency || 'ج.م';

    // Total Completed Sales and Profits
    let totalSales = 0;
    let totalProfit = 0;
    let completedInvoicesCount = 0;

    const banner = document.getElementById('dash-empty-banner');
    if (banner) {
      banner.style.display = products.length === 0 ? 'flex' : 'none';
    }

    invoices.forEach(inv => {
      if (inv.status !== 'refunded') {
        totalSales += (inv.total || 0);
        totalProfit += (inv.netProfit || 0);
        completedInvoicesCount++;
      }
    });

    // Finished Products Stock Value
    let productsCostVal = 0;
    products.forEach(p => {
      productsCostVal += (p.stockUnits || 0) * (p.totalCost || 0);
    });

    // Update KPI Card numbers
    document.getElementById('dash-total-sales').textContent = `${totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr}`;
    document.getElementById('dash-total-profit').textContent = `+${totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr}`;
    document.getElementById('dash-invoices-count').textContent = `${completedInvoicesCount} فاتورة`;
    document.getElementById('dash-inventory-val').textContent = `${productsCostVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr}`;

    // Low stock count
    let lowStockCount = 0;
    materials.forEach(m => {
      if ((m.stockGrams || 0) <= (m.minStockGrams || 0)) lowStockCount++;
    });
    products.forEach(p => {
      if ((p.stockUnits || 0) <= (p.minStockUnits || 0)) lowStockCount++;
    });
    document.getElementById('dash-low-stock-count').textContent = `${lowStockCount} أصناف منخفضة`;

    // Render Recent Invoices
    const recentInvoices = [...invoices].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    const tbody = document.getElementById('dash-recent-invoices-tbody');
    if (tbody) {
      if (recentInvoices.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">لا توجد فواتير بعد</td></tr>`;
      } else {
        tbody.innerHTML = recentInvoices.map(inv => `
          <tr>
            <td><strong>${inv.invoiceNumber}</strong></td>
            <td>${inv.customerName}</td>
            <td style="font-size:0.8rem; color:var(--text-secondary);">${new Date(inv.date).toLocaleDateString('ar-EG')}</td>
            <td><strong>${(inv.total || 0).toFixed(2)} ${curr}</strong></td>
            <td><span class="badge ${inv.status === 'refunded' ? 'badge-danger' : 'badge-success'}">${inv.status === 'refunded' ? 'مسترجعة' : 'مكتملة'}</span></td>
            <td>
              <button class="btn btn-sm btn-secondary" onclick="InvoicesManager.viewInvoice(${inv.id})">عرض</button>
            </td>
          </tr>
        `).join('');
      }
    }

    // Render Low Stock Alert items list on dashboard
    const lowStockContainer = document.getElementById('dash-low-stock-list');
    if (lowStockContainer) {
      const lowMaterials = materials.filter(m => (m.stockGrams || 0) <= (m.minStockGrams || 0));
      const lowProds = products.filter(p => (p.stockUnits || 0) <= (p.minStockUnits || 0));

      if (lowMaterials.length === 0 && lowProds.length === 0) {
        lowStockContainer.innerHTML = `
          <div style="text-align:center; padding: 2rem; color: var(--success); font-weight: 600;">
            ✓ جميع أرصدة المواد الخام والمنتجات متوفرة وبحالة ممتازة
          </div>
        `;
      } else {
        let html = '';
        lowMaterials.forEach(m => {
          html += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 0.6rem 0; border-bottom: 1px dashed var(--border);">
              <div>
                <strong style="color:var(--text-primary);">${m.name}</strong>
                <span class="badge badge-secondary" style="font-size:0.7rem; margin-right:4px;">مادة خام</span>
              </div>
              <div style="text-align:left;">
                <span class="badge badge-danger">المتبقي: ${(m.stockGrams || 0).toLocaleString()} جم</span>
                <button class="btn btn-sm btn-secondary" style="margin-right:6px;" onclick="MaterialsManager.openStockModal(${m.id})">تزويد</button>
              </div>
            </div>
          `;
        });
        lowProds.forEach(p => {
          html += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 0.6rem 0; border-bottom: 1px dashed var(--border);">
              <div>
                <strong style="color:var(--text-primary);">${p.name}</strong>
                <span class="badge badge-primary" style="font-size:0.7rem; margin-right:4px;">منتج جاهز</span>
              </div>
              <div style="text-align:left;">
                <span class="badge badge-warning">المتبقي: ${p.stockUnits || 0} عبوة</span>
                <button class="btn btn-sm btn-accent" style="margin-right:6px;" onclick="ProductsManager.openBatchModal(${p.id})">إنتاج</button>
              </div>
            </div>
          `;
        });
        lowStockContainer.innerHTML = html;
      }
    }
  },

  async checkLowStockBadges() {
    const [materials, products] = await Promise.all([
      db.getAll('materials'),
      db.getAll('products')
    ]);

    let matAlerts = 0;
    materials.forEach(m => {
      if ((m.stockGrams || 0) <= (m.minStockGrams || 0)) matAlerts++;
    });

    let prodAlerts = 0;
    products.forEach(p => {
      if ((p.stockUnits || 0) <= (p.minStockUnits || 0)) prodAlerts++;
    });

    const badgeMat = document.getElementById('nav-badge-materials');
    if (badgeMat) {
      badgeMat.textContent = matAlerts > 0 ? matAlerts : '';
      badgeMat.style.display = matAlerts > 0 ? 'inline-block' : 'none';
    }

    const badgeProd = document.getElementById('nav-badge-products');
    if (badgeProd) {
      badgeProd.textContent = prodAlerts > 0 ? prodAlerts : '';
      badgeProd.style.display = prodAlerts > 0 ? 'inline-block' : 'none';
    }
  },

  openMobileModal() {
    // If running on a web server, update QR code with actual host IP
    const currentHost = window.location.hostname;
    if (currentHost && currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
      const fullUrl = `${window.location.protocol}//${window.location.host}`;
      const txtElem = document.getElementById('mobile-local-ip-text');
      const imgElem = document.getElementById('mobile-qr-img');
      if (txtElem) txtElem.textContent = fullUrl;
      if (imgElem) imgElem.src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(fullUrl)}`;
    }
    this.openModal('modal-mobile-guide');
  }
};

// Register Service Worker for mobile offline PWA
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// Start application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
