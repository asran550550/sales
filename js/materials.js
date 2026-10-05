/**
 * RoseCosmetics - Raw Materials Management (إدارة المواد الخام)
 * Handles addition, editing, unit cost calculations (Gram vs Kg), stock in grams, and alerts.
 */

const MaterialsManager = {
  currentFilter: '',
  currentCategory: 'all',

  async init() {
    this.bindEvents();
    await this.render();
  },

  bindEvents() {
    // Add Material Button
    const btnAdd = document.getElementById('btn-add-material');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => this.openModal());
    }

    // Material Form Submit
    const form = document.getElementById('form-material');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSave(e));
    }

    // Cost Per Kg / Gram sync calculator inside modal
    const inputCostPerGram = document.getElementById('mat-cost-gram');
    const inputCostPerKg = document.getElementById('mat-cost-kg');
    if (inputCostPerGram && inputCostPerKg) {
      inputCostPerGram.addEventListener('input', () => {
        const val = parseFloat(inputCostPerGram.value) || 0;
        inputCostPerKg.value = (val * 1000).toFixed(2);
      });
      inputCostPerKg.addEventListener('input', () => {
        const val = parseFloat(inputCostPerKg.value) || 0;
        inputCostPerGram.value = (val / 1000).toFixed(4);
      });
    }

    // Search & Filter
    const searchInput = document.getElementById('search-materials');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.currentFilter = e.target.value.trim().toLowerCase();
        this.render();
      });
    }

    const catFilter = document.getElementById('filter-material-category');
    if (catFilter) {
      catFilter.addEventListener('change', (e) => {
        this.currentCategory = e.target.value;
        this.render();
      });
    }
  },

  async render() {
    const list = await db.getAll('materials');
    const tbody = document.getElementById('materials-table-body');
    const config = (await db.getSetting('appConfig')) || { currency: 'ج.م' };
    const curr = config.currency || 'ج.م';

    if (!tbody) return;

    // Filter
    let filtered = list;
    if (this.currentCategory !== 'all') {
      filtered = filtered.filter(m => m.category === this.currentCategory);
    }
    if (this.currentFilter) {
      filtered = filtered.filter(m => 
        (m.name && m.name.toLowerCase().includes(this.currentFilter)) ||
        (m.code && m.code.toLowerCase().includes(this.currentFilter)) ||
        (m.supplier && m.supplier.toLowerCase().includes(this.currentFilter))
      );
    }

    // Update categories filter dropdown
    this.updateCategoryDropdown(list);

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding: 2.5rem 1rem; color: var(--text-muted);">
            <div style="font-size:1.1rem; font-weight:700; color:var(--text-primary); margin-bottom:0.5rem;">لا توجد مواد خام مسجلة حالياً</div>
            <p style="font-size:0.85rem; margin-bottom:1rem;">يمكنك شحن قائمة المواد الخام الأساسية (زيوت، زبدة، شموع، مواد فعالة، عطور) بضغطة زر:</p>
            <div style="display:flex; justify-content:center; gap:0.75rem;">
              <button class="btn btn-primary" onclick="SettingsManager.handleResetDemoData()">
                🌸 شحن الخامات والمنتجات التجريبية الآن
              </button>
              <button class="btn btn-secondary" onclick="MaterialsManager.openModal()">
                + إضافة مادة خام يدوياً
              </button>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(m => {
      const isLow = m.stockGrams <= (m.minStockGrams || 0);
      const totalVal = ((m.stockGrams || 0) * (m.costPerGram || 0)).toFixed(2);
      const kgStock = ((m.stockGrams || 0) / 1000).toFixed(2);

      return `
        <tr>
          <td><strong style="color: var(--primary-dark);">${m.code || '-'}</strong></td>
          <td>
            <strong>${m.name}</strong>
            ${m.notes ? `<div style="font-size:0.75rem; color:var(--text-muted);">${m.notes}</div>` : ''}
          </td>
          <td><span class="badge badge-secondary">${m.category || 'عام'}</span></td>
          <td>
            <strong>${(m.costPerGram || 0).toFixed(3)} ${curr}</strong>
            <span style="font-size:0.75rem; color:var(--text-secondary);">(${((m.costPerGram || 0) * 1000).toFixed(1)} ${curr}/كجم)</span>
          </td>
          <td>
            <span class="badge ${isLow ? 'badge-danger' : 'badge-success'}">
              ${(m.stockGrams || 0).toLocaleString()} جم
            </span>
            <div style="font-size:0.75rem; color:var(--text-muted);">${kgStock} كجم</div>
          </td>
          <td>
            <span style="font-size:0.8rem; color:var(--text-secondary);">${(m.minStockGrams || 0).toLocaleString()} جم</span>
          </td>
          <td>
            <strong>${totalVal} ${curr}</strong>
          </td>
          <td>
            <div style="display:flex; gap: 0.35rem;">
              <button class="btn btn-sm btn-secondary" onclick="MaterialsManager.openStockModal(${m.id})" title="تعديل أو توريد كمية">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                تزويد
              </button>
              <button class="btn btn-sm btn-secondary" onclick="MaterialsManager.openModal(${m.id})" title="تعديل">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button class="btn btn-sm btn-danger" onclick="MaterialsManager.deleteMaterial(${m.id})" title="حذف">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  updateCategoryDropdown(materials) {
    const dropdown = document.getElementById('filter-material-category');
    if (!dropdown) return;
    const cats = [...new Set(materials.map(m => m.category).filter(Boolean))];
    const curVal = dropdown.value;
    dropdown.innerHTML = `<option value="all">جميع التصنيفات</option>` + cats.map(c => 
      `<option value="${c}" ${c === curVal ? 'selected' : ''}>${c}</option>`
    ).join('');
  },

  async openModal(id = null) {
    const modal = document.getElementById('modal-material');
    const title = document.getElementById('modal-material-title');
    const form = document.getElementById('form-material');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('mat-id').value = '';

    if (id) {
      title.textContent = 'تعديل مادة خام';
      const item = await db.getById('materials', id);
      if (item) {
        document.getElementById('mat-id').value = item.id;
        document.getElementById('mat-code').value = item.code || '';
        document.getElementById('mat-name').value = item.name || '';
        document.getElementById('mat-category').value = item.category || '';
        document.getElementById('mat-cost-gram').value = item.costPerGram || '';
        document.getElementById('mat-cost-kg').value = ((item.costPerGram || 0) * 1000).toFixed(2);
        document.getElementById('mat-stock').value = item.stockGrams || '';
        document.getElementById('mat-min-stock').value = item.minStockGrams || '';
        document.getElementById('mat-supplier').value = item.supplier || '';
        document.getElementById('mat-notes').value = item.notes || '';
      }
    } else {
      title.textContent = 'إضافة مادة خام جديدة';
      // Auto-generate code
      const count = await db.count('materials');
      document.getElementById('mat-code').value = 'RM-' + String(count + 1).padStart(3, '0');
    }

    App.openModal('modal-material');
  },

  async handleSave(e) {
    e.preventDefault();
    const id = document.getElementById('mat-id').value;
    const code = document.getElementById('mat-code').value.trim();
    const name = document.getElementById('mat-name').value.trim();
    const category = document.getElementById('mat-category').value.trim();
    const costPerGram = parseFloat(document.getElementById('mat-cost-gram').value) || 0;
    const stockGrams = parseFloat(document.getElementById('mat-stock').value) || 0;
    const minStockGrams = parseFloat(document.getElementById('mat-min-stock').value) || 0;
    const supplier = document.getElementById('mat-supplier').value.trim();
    const notes = document.getElementById('mat-notes').value.trim();

    if (!name) {
      App.toast('يرجى إدخال اسم المادة الخام', 'warning');
      return;
    }
    if (costPerGram <= 0) {
      App.toast('يرجى إدخال سعر تكلفة صحيح للجرام', 'warning');
      return;
    }

    const payload = {
      code,
      name,
      category: category || 'عام',
      costPerGram,
      costPerKg: costPerGram * 1000,
      stockGrams,
      minStockGrams,
      supplier,
      notes,
      updatedAt: new Date().toISOString()
    };

    try {
      if (id) {
        payload.id = Number(id);
        await db.update('materials', payload);
        App.toast('تم تحديث المادة الخام بنجاح', 'success');
      } else {
        payload.createdAt = new Date().toISOString();
        await db.add('materials', payload);
        App.toast('تمت إضافة المادة الخام بنجاح', 'success');
      }

      App.closeModal('modal-material');
      await this.render();
      if (window.ProductsManager) await ProductsManager.refreshMaterialsList();
      if (window.App) await App.updateDashboard();
    } catch (err) {
      console.error(err);
      App.toast('حدث خطأ أثناء الحفظ (تأكد من عدم تكرار كود المادة)', 'error');
    }
  },

  async openStockModal(id) {
    const item = await db.getById('materials', id);
    if (!item) return;

    const modal = document.getElementById('modal-stock-supply');
    if (!modal) return;

    document.getElementById('stock-supply-mat-id').value = item.id;
    document.getElementById('stock-supply-title').textContent = `تزويد رصيد: ${item.name}`;
    document.getElementById('stock-current-grams').textContent = `${(item.stockGrams || 0).toLocaleString()} جم (${((item.stockGrams || 0) / 1000).toFixed(2)} كجم)`;
    document.getElementById('stock-add-grams').value = '';
    document.getElementById('stock-add-notes').value = '';

    App.openModal('modal-stock-supply');
  },

  async handleStockSupply(e) {
    e.preventDefault();
    const id = Number(document.getElementById('stock-supply-mat-id').value);
    const addedGrams = parseFloat(document.getElementById('stock-add-grams').value) || 0;
    const notes = document.getElementById('stock-add-notes').value.trim();

    if (addedGrams <= 0) {
      App.toast('يرجى إدخال كمية جرامات صحيحة للإضافة', 'warning');
      return;
    }

    const item = await db.getById('materials', id);
    if (!item) return;

    item.stockGrams = (item.stockGrams || 0) + addedGrams;
    item.updatedAt = new Date().toISOString();
    await db.update('materials', item);

    App.toast(`تم إضافة ${addedGrams.toLocaleString()} جم إلى رصيد "${item.name}"`, 'success');
    App.closeModal('modal-stock-supply');
    await this.render();
    if (window.App) await App.updateDashboard();
  },

  async deleteMaterial(id) {
    if (!confirm('هل أنت متأكد من حذف هذه المادة الخام؟ لن يمكنك التراجع عن ذلك.')) return;

    try {
      await db.delete('materials', id);
      App.toast('تم حذف المادة الخام بنجاح', 'success');
      await this.render();
      if (window.ProductsManager) await ProductsManager.refreshMaterialsList();
      if (window.App) await App.updateDashboard();
    } catch (err) {
      console.error(err);
      App.toast('تعذر حذف المادة الخام', 'error');
    }
  }
};
