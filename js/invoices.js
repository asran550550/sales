/**
 * RoseCosmetics - Invoices History & Log Management (سجل الفواتير)
 * Complete log of sales invoices, detailed breakdown, reprint, and return/refund capability.
 */

const InvoicesManager = {
  searchQuery: '',
  statusFilter: 'all',

  async init() {
    this.bindEvents();
    await this.render();
  },

  bindEvents() {
    const searchInput = document.getElementById('search-invoices');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.render();
      });
    }

    const filterStatus = document.getElementById('filter-invoice-status');
    if (filterStatus) {
      filterStatus.addEventListener('change', (e) => {
        this.statusFilter = e.target.value;
        this.render();
      });
    }
  },

  async render() {
    const list = await db.getAll('invoices');
    const tbody = document.getElementById('invoices-table-body');
    const config = (await db.getSetting('appConfig')) || { currency: 'ج.م' };
    const curr = config.currency || 'ج.م';

    if (!tbody) return;

    // Sort descending by date
    let filtered = [...list].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(i => i.status === this.statusFilter);
    }

    if (this.searchQuery) {
      filtered = filtered.filter(i =>
        (i.invoiceNumber && i.invoiceNumber.toLowerCase().includes(this.searchQuery)) ||
        (i.customerName && i.customerName.toLowerCase().includes(this.searchQuery)) ||
        (i.customerPhone && i.customerPhone.includes(this.searchQuery))
      );
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center; padding: 2.5rem; color:var(--text-muted);">
            لا توجد فواتير مطابقة
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(inv => {
      const isRefunded = inv.status === 'refunded';
      const dateStr = new Date(inv.date).toLocaleDateString('ar-EG', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const paymentText = {
        cash: 'نقدي',
        card: 'بطاقة',
        transfer: 'تحويل',
        credit: 'آجل'
      }[inv.paymentMethod] || inv.paymentMethod;

      const itemsSummary = (inv.items || []).map(it => `${it.productName} (${it.quantity})`).join(', ');

      return `
        <tr style="${isRefunded ? 'opacity: 0.7; background-color: #fff1f2;' : ''}">
          <td><strong style="color:var(--primary-dark);">${inv.invoiceNumber}</strong></td>
          <td style="font-size:0.8rem; color:var(--text-secondary);">${dateStr}</td>
          <td>
            <strong>${inv.customerName}</strong>
            ${inv.customerPhone ? `<div style="font-size:0.75rem; color:var(--text-muted);">${inv.customerPhone}</div>` : ''}
          </td>
          <td>
            <div style="max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:0.8rem;" title="${itemsSummary}">
              ${itemsSummary}
            </div>
            <span class="badge badge-secondary" style="font-size:0.7rem;">${(inv.items || []).length} أصناف</span>
          </td>
          <td>
            <strong style="font-size:1rem; color:var(--text-primary);">${(inv.total || 0).toFixed(2)} ${curr}</strong>
            ${inv.discount > 0 ? `<div style="font-size:0.72rem; color:var(--danger);">خصم: ${inv.discount} ${curr}</div>` : ''}
          </td>
          <td>
            <span class="badge ${isRefunded ? 'badge-secondary' : 'badge-success'}">
              ${isRefunded ? '0.00' : `+${(inv.netProfit || 0).toFixed(2)} ${curr}`}
            </span>
          </td>
          <td><span class="badge badge-secondary">${paymentText}</span></td>
          <td>
            <span class="badge ${isRefunded ? 'badge-danger' : 'badge-success'}">
              ${isRefunded ? 'مسترجعة' : 'مكتملة'}
            </span>
          </td>
          <td>
            <div style="display:flex; gap: 0.35rem;">
              <button class="btn btn-sm btn-secondary" onclick="InvoicesManager.viewInvoice(${inv.id})" title="عرض التفاصيل">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              </button>
              <button class="btn btn-sm btn-primary" onclick="InvoicesManager.reprintThermal(${inv.id})" title="طباعة إيصال حراري">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              </button>
              ${!isRefunded ? `
                <button class="btn btn-sm btn-danger" onclick="InvoicesManager.refundInvoice(${inv.id})" title="استرجاع الفاتورة وإعادة البضاعة للمخزن">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  async viewInvoice(id) {
    const inv = await db.getById('invoices', id);
    if (!inv) return;

    const modal = document.getElementById('modal-invoice-detail');
    if (!modal) return;

    const config = (await db.getSetting('appConfig')) || { currency: 'ج.م' };
    const curr = config.currency || 'ج.م';

    document.getElementById('inv-detail-num').textContent = inv.invoiceNumber;
    document.getElementById('inv-detail-date').textContent = new Date(inv.date).toLocaleString('ar-EG');
    document.getElementById('inv-detail-customer').textContent = `${inv.customerName} ${inv.customerPhone ? '(' + inv.customerPhone + ')' : ''}`;
    document.getElementById('inv-detail-status').innerHTML = inv.status === 'refunded' 
      ? '<span class="badge badge-danger">فاتورة مسترجعة وملغية</span>' 
      : '<span class="badge badge-success">فاتورة مكتملة</span>';

    const tbody = document.getElementById('inv-detail-items');
    tbody.innerHTML = (inv.items || []).map(it => `
      <tr>
        <td><strong>${it.productName}</strong></td>
        <td>${(it.unitCost || 0).toFixed(2)} ${curr}</td>
        <td>${(it.unitPrice || 0).toFixed(2)} ${curr}</td>
        <td style="text-align:center;">${it.quantity}</td>
        <td><strong>${(it.total || 0).toFixed(2)} ${curr}</strong></td>
        <td><span class="badge badge-success">+${(it.profit || 0).toFixed(2)} ${curr}</span></td>
      </tr>
    `).join('');

    document.getElementById('inv-detail-subtotal').textContent = `${(inv.subtotal || 0).toFixed(2)} ${curr}`;
    document.getElementById('inv-detail-discount').textContent = `${(inv.discount || 0).toFixed(2)} ${curr}`;
    document.getElementById('inv-detail-tax').textContent = `${(inv.taxAmount || 0).toFixed(2)} ${curr}`;
    document.getElementById('inv-detail-total').textContent = `${(inv.total || 0).toFixed(2)} ${curr}`;
    document.getElementById('inv-detail-profit').textContent = `${(inv.netProfit || 0).toFixed(2)} ${curr}`;

    const printBtn = document.getElementById('btn-modal-reprint');
    if (printBtn) {
      printBtn.onclick = () => this.reprintThermal(inv.id);
    }

    App.openModal('modal-invoice-detail');
  },

  async reprintThermal(id) {
    const inv = await db.getById('invoices', id);
    if (!inv) return;
    if (window.POS) {
      POS.printThermalReceipt(inv);
    }
  },

  async refundInvoice(id) {
    if (!confirm('هل تريد بالتأكيد استرجاع هذه الفاتورة؟ سيتم إعادة كميات المنتجات إلى المخزن تلقائياً.')) {
      return;
    }
    const reason = prompt('أدخل سبب الإرجاع (اختياري):', 'إرجاع بناءً على رغبة العميل');

    try {
      await db.refundInvoice(id, reason);
      App.toast('تم استرجاع الفاتورة وإعادة المنتجات إلى المخزن بنجاح', 'success');
      await this.render();
      if (window.ProductsManager) await ProductsManager.render();
      if (window.POS) await POS.refreshCatalog();
      if (window.App) await App.updateDashboard();
    } catch (err) {
      console.error(err);
      App.toast(err.message || 'تعذر استرجاع الفاتورة', 'error');
    }
  }
};
