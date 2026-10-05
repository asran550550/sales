/**
 * RoseCosmetics - Products & Formulation (BOM) Management
 * Dynamically computes product cost from raw materials (grams * unit cost),
 * packaging, and labor overhead. Sets selling price with profit margin.
 * Handles Batch Production execution with automatic stock deduction.
 */

const ProductsManager = {
  currentFilter: '',
  currentCategory: 'all',
  cachedMaterials: [],

  async init() {
    await this.refreshMaterialsList();
    this.bindEvents();
    await this.render();
  },

  async refreshMaterialsList() {
    this.cachedMaterials = await db.getAll('materials');
  },

  bindEvents() {
    // Open New Product Modal
    const btnNew = document.getElementById('btn-add-product');
    if (btnNew) {
      btnNew.addEventListener('click', () => this.openProductModal());
    }

    // Add Ingredient Row Button
    const btnAddIng = document.getElementById('btn-add-ingredient-row');
    if (btnAddIng) {
      btnAddIng.addEventListener('click', () => this.addIngredientRow());
    }

    // Dynamic cost calculator listeners
    const packagingInput = document.getElementById('prod-packaging-cost');
    const laborInput = document.getElementById('prod-labor-cost');
    const profitMarginInput = document.getElementById('prod-profit-margin');
    const profitTypeSelect = document.getElementById('prod-profit-type');

    [packagingInput, laborInput, profitMarginInput].forEach(el => {
      if (el) el.addEventListener('input', () => this.recalculateProductCost());
    });
    if (profitTypeSelect) {
      profitTypeSelect.addEventListener('change', () => this.recalculateProductCost());
    }

    // Manual override of selling price if user adjusts it directly
    const sellingPriceInput = document.getElementById('prod-selling-price');
    if (sellingPriceInput) {
      sellingPriceInput.addEventListener('input', () => {
        // Recalculate profit margin based on entered selling price
        const totalCost = parseFloat(document.getElementById('calc-total-cost-val').dataset.val) || 0;
        const enteredPrice = parseFloat(sellingPriceInput.value) || 0;
        if (totalCost > 0 && enteredPrice >= totalCost) {
          const profit = enteredPrice - totalCost;
          const pType = profitTypeSelect.value;
          if (pType === 'percent') {
            profitMarginInput.value = Math.round((profit / totalCost) * 100);
          } else {
            profitMarginInput.value = profit.toFixed(2);
          }
        }
      });
    }

    // Form submission
    const form = document.getElementById('form-product');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSaveProduct(e));
    }

    // Batch Production Form Submit
    const batchForm = document.getElementById('form-batch-produce');
    if (batchForm) {
      batchForm.addEventListener('submit', (e) => this.handleBatchProduce(e));
    }

    // Search & Filter
    const searchInput = document.getElementById('search-products');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.currentFilter = e.target.value.trim().toLowerCase();
        this.render();
      });
    }

    const catFilter = document.getElementById('filter-product-category');
    if (catFilter) {
      catFilter.addEventListener('change', (e) => {
        this.currentCategory = e.target.value;
        this.render();
      });
    }
  },

  async render() {
    const list = await db.getAll('products');
    const tbody = document.getElementById('products-table-body');
    const config = (await db.getSetting('appConfig')) || { currency: 'ج.م' };
    const curr = config.currency || 'ج.م';

    if (!tbody) return;

    let filtered = list;
    if (this.currentCategory !== 'all') {
      filtered = filtered.filter(p => p.category === this.currentCategory);
    }
    if (this.currentFilter) {
      filtered = filtered.filter(p => 
        (p.name && p.name.toLowerCase().includes(this.currentFilter)) ||
        (p.code && p.code.toLowerCase().includes(this.currentFilter)) ||
        (p.category && p.category.toLowerCase().includes(this.currentFilter))
      );
    }

    this.updateCategoryDropdown(list);

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center; padding: 2.5rem 1rem; color: var(--text-muted);">
            <div style="font-size:1.1rem; font-weight:700; color:var(--text-primary); margin-bottom:0.5rem;">لا توجد منتجات مسجلة حالياً</div>
            <p style="font-size:0.85rem; margin-bottom:1rem;">يمكنك شحن نماذج لمستحضرات التجميل (سيروم، كريمات، مقشرات بتركيباتها وتكاليفها) بضغطة زر واحدة:</p>
            <div style="display:flex; justify-content:center; gap:0.75rem;">
              <button class="btn btn-primary" onclick="SettingsManager.handleResetDemoData()">
                🌸 شحن منتجات وخامات تجريبية الآن
              </button>
              <button class="btn btn-secondary" onclick="ProductsManager.openProductModal()">
                + إضافة منتج جديد يدوياً
              </button>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(p => {
      const isLowStock = (p.stockUnits || 0) <= (p.minStockUnits || 0);
      const profitPerUnit = ((p.sellingPrice || 0) - (p.totalCost || 0)).toFixed(2);
      const profitPercent = p.totalCost > 0 ? (((p.sellingPrice - p.totalCost) / p.totalCost) * 100).toFixed(0) : 0;

      return `
        <tr>
          <td><strong style="color: var(--primary-dark);">${p.code || '-'}</strong></td>
          <td>
            <strong>${p.name}</strong>
            <div style="font-size:0.75rem; color:var(--text-secondary);">${(p.ingredients || []).length} مكونات خام (${p.netWeight || 0} جم)</div>
          </td>
          <td><span class="badge badge-secondary">${p.category || 'عام'}</span></td>
          <td>
            <span style="font-weight:600; color:var(--text-secondary);">${(p.totalCost || 0).toFixed(2)} ${curr}</span>
            <div style="font-size:0.72rem; color:var(--text-muted);">خام: ${(p.rawMaterialsCost || 0).toFixed(1)} | عبوة: ${(p.packagingCost || 0).toFixed(1)}</div>
          </td>
          <td>
            <strong style="color: var(--accent); font-size:1.05rem;">${(p.sellingPrice || 0).toFixed(2)} ${curr}</strong>
          </td>
          <td>
            <span class="badge badge-success">+${profitPerUnit} ${curr} (${profitPercent}%)</span>
          </td>
          <td>
            <span class="badge ${isLowStock ? 'badge-danger' : 'badge-primary'}">
              ${(p.stockUnits || 0).toLocaleString()} عبوة
            </span>
          </td>
          <td>
            <div style="display:flex; gap: 0.35rem; align-items:center;">
              <button class="btn btn-sm btn-accent" onclick="ProductsManager.openBatchModal(${p.id})" title="تشغيل خط إنتاج لخصم المواد الخام وتعبئة المنتج">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                إنتاج دفعة
              </button>
              <button class="btn btn-sm btn-secondary" onclick="ProductsManager.openRecipeModal(${p.id})" title="عرض بطاقة التركيبة والتكاليف">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              </button>
              <button class="btn btn-sm btn-secondary" onclick="ProductsManager.openProductModal(${p.id})" title="تعديل">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button class="btn btn-sm btn-danger" onclick="ProductsManager.deleteProduct(${p.id})" title="حذف">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  updateCategoryDropdown(products) {
    const dropdown = document.getElementById('filter-product-category');
    if (!dropdown) return;
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))];
    const curVal = dropdown.value;
    dropdown.innerHTML = `<option value="all">جميع التصنيفات</option>` + cats.map(c => 
      `<option value="${c}" ${c === curVal ? 'selected' : ''}>${c}</option>`
    ).join('');
  },

  // --- Product Creation / Editing Modal ---

  async openProductModal(id = null) {
    await this.refreshMaterialsList();
    if (this.cachedMaterials.length === 0) {
      App.toast('يرجى إضافة مواد خام أولاً لتتمكن من إنشاء تركيبة المنتج', 'warning');
      return;
    }

    const modal = document.getElementById('modal-product');
    const title = document.getElementById('modal-product-title');
    const form = document.getElementById('form-product');
    const container = document.getElementById('ingredients-container');
    if (!modal || !form || !container) return;

    form.reset();
    container.innerHTML = '';
    document.getElementById('prod-id').value = '';

    if (id) {
      title.textContent = 'تعديل تركيبة وبيانات المنتج';
      const item = await db.getById('products', id);
      if (item) {
        document.getElementById('prod-id').value = item.id;
        document.getElementById('prod-code').value = item.code || '';
        document.getElementById('prod-name').value = item.name || '';
        document.getElementById('prod-category').value = item.category || '';
        document.getElementById('prod-net-weight').value = item.netWeight || '';
        document.getElementById('prod-packaging-cost').value = item.packagingCost || 0;
        document.getElementById('prod-labor-cost').value = item.laborCost || 0;
        document.getElementById('prod-profit-type').value = item.profitType || 'percent';
        document.getElementById('prod-profit-margin').value = item.profitMargin || 50;
        document.getElementById('prod-selling-price').value = item.sellingPrice || 0;
        document.getElementById('prod-stock').value = item.stockUnits || 0;
        document.getElementById('prod-min-stock').value = item.minStockUnits || 5;
        document.getElementById('prod-notes').value = item.notes || '';

        // Fill ingredients
        if (item.ingredients && item.ingredients.length > 0) {
          item.ingredients.forEach(ing => {
            this.addIngredientRow(ing.materialId, ing.grams);
          });
        } else {
          this.addIngredientRow();
        }
      }
    } else {
      title.textContent = 'إنشاء منتج جديد وحساب تكلفة التركيبة';
      const count = await db.count('products');
      document.getElementById('prod-code').value = 'PRD-' + String(count + 1).padStart(3, '0');
      document.getElementById('prod-profit-type').value = 'percent';
      document.getElementById('prod-profit-margin').value = 60;
      document.getElementById('prod-packaging-cost').value = 8;
      document.getElementById('prod-labor-cost').value = 4;
      document.getElementById('prod-stock').value = 0;
      document.getElementById('prod-min-stock').value = 5;

      // Add two empty rows to start
      this.addIngredientRow();
      this.addIngredientRow();
    }

    this.recalculateProductCost();
    App.openModal('modal-product');
  },

  addIngredientRow(selectedMatId = '', gramsVal = '') {
    const container = document.getElementById('ingredients-container');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'ingredient-row';

    // Materials options
    const optionsHtml = this.cachedMaterials.map(m => {
      const isSel = String(m.id) === String(selectedMatId);
      return `<option value="${m.id}" data-cost="${m.costPerGram}" data-stock="${m.stockGrams}" ${isSel ? 'selected' : ''}>
        ${m.name} (${(m.costPerGram || 0).toFixed(3)} ج/جم | متاح: ${m.stockGrams || 0} جم)
      </option>`;
    }).join('');

    row.innerHTML = `
      <div>
        <select class="form-control ing-select" required>
          <option value="">-- اختر المادة الخام --</option>
          ${optionsHtml}
        </select>
      </div>
      <div>
        <input type="number" step="0.01" min="0.01" class="form-control ing-grams" placeholder="الوزن بالجرام" value="${gramsVal}" required>
      </div>
      <div>
        <span class="ing-unit-cost-preview" style="font-size:0.8rem; color:var(--text-secondary);">0.00 ج/جم</span>
      </div>
      <div>
        <strong class="ing-total-cost-preview" style="color:var(--primary-dark); font-size:0.9rem;">0.00</strong>
      </div>
      <div>
        <button type="button" class="btn btn-sm btn-danger del-btn" style="padding:4px 8px;" title="حذف المكون">
          &times;
        </button>
      </div>
    `;

    // Events
    const sel = row.querySelector('.ing-select');
    const inp = row.querySelector('.ing-grams');
    const delBtn = row.querySelector('.del-btn');

    const updateRowCalc = () => {
      const opt = sel.selectedOptions[0];
      const costPerGram = opt && opt.dataset.cost ? parseFloat(opt.dataset.cost) : 0;
      const grams = parseFloat(inp.value) || 0;
      const totalCost = costPerGram * grams;

      row.querySelector('.ing-unit-cost-preview').textContent = `${costPerGram.toFixed(3)} /جم`;
      row.querySelector('.ing-total-cost-preview').textContent = `${totalCost.toFixed(2)}`;
      this.recalculateProductCost();
    };

    sel.addEventListener('change', updateRowCalc);
    inp.addEventListener('input', updateRowCalc);
    delBtn.addEventListener('click', () => {
      row.remove();
      this.recalculateProductCost();
    });

    container.appendChild(row);
    if (selectedMatId) {
      updateRowCalc();
    }
  },

  recalculateProductCost() {
    const container = document.getElementById('ingredients-container');
    if (!container) return;

    let rawMaterialsTotal = 0;
    let totalWeightGrams = 0;

    const rows = container.querySelectorAll('.ingredient-row');
    rows.forEach(r => {
      const sel = r.querySelector('.ing-select');
      const inp = r.querySelector('.ing-grams');
      const opt = sel.selectedOptions[0];
      const cost = opt && opt.dataset.cost ? parseFloat(opt.dataset.cost) : 0;
      const grams = parseFloat(inp.value) || 0;
      rawMaterialsTotal += (cost * grams);
      totalWeightGrams += grams;
    });

    // Auto update Net Weight if not filled manually or matches sum
    const netWeightInput = document.getElementById('prod-net-weight');
    if (netWeightInput && (!netWeightInput.value || parseFloat(netWeightInput.dataset.auto) === parseFloat(netWeightInput.value))) {
      netWeightInput.value = Math.round(totalWeightGrams * 100) / 100;
      netWeightInput.dataset.auto = netWeightInput.value;
    }

    const packagingCost = parseFloat(document.getElementById('prod-packaging-cost').value) || 0;
    const laborCost = parseFloat(document.getElementById('prod-labor-cost').value) || 0;
    const totalCost = rawMaterialsTotal + packagingCost + laborCost;

    const profitType = document.getElementById('prod-profit-type').value;
    const profitMargin = parseFloat(document.getElementById('prod-profit-margin').value) || 0;

    let sellingPrice = 0;
    if (profitType === 'percent') {
      sellingPrice = totalCost * (1 + (profitMargin / 100));
    } else {
      sellingPrice = totalCost + profitMargin;
    }

    // Update UI Previews
    document.getElementById('calc-raw-materials-val').textContent = rawMaterialsTotal.toFixed(2);
    document.getElementById('calc-packaging-val').textContent = packagingCost.toFixed(2);
    document.getElementById('calc-labor-val').textContent = laborCost.toFixed(2);
    
    const costElem = document.getElementById('calc-total-cost-val');
    costElem.textContent = totalCost.toFixed(2);
    costElem.dataset.val = totalCost;

    const sellingPriceInput = document.getElementById('prod-selling-price');
    sellingPriceInput.value = Math.round(sellingPrice * 100) / 100;

    const badgeElem = document.getElementById('calc-profit-val-badge');
    const profitVal = (sellingPrice - totalCost).toFixed(2);
    badgeElem.textContent = `صافي الربح المتوقع للعبوة: +${profitVal}`;
  },

  async handleSaveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    const code = document.getElementById('prod-code').value.trim();
    const name = document.getElementById('prod-name').value.trim();
    const category = document.getElementById('prod-category').value.trim();
    const netWeight = parseFloat(document.getElementById('prod-net-weight').value) || 0;
    const packagingCost = parseFloat(document.getElementById('prod-packaging-cost').value) || 0;
    const laborCost = parseFloat(document.getElementById('prod-labor-cost').value) || 0;
    const profitType = document.getElementById('prod-profit-type').value;
    const profitMargin = parseFloat(document.getElementById('prod-profit-margin').value) || 0;
    const sellingPrice = parseFloat(document.getElementById('prod-selling-price').value) || 0;
    const stockUnits = parseInt(document.getElementById('prod-stock').value) || 0;
    const minStockUnits = parseInt(document.getElementById('prod-min-stock').value) || 0;
    const notes = document.getElementById('prod-notes').value.trim();

    // Extract ingredients
    const container = document.getElementById('ingredients-container');
    const rows = container.querySelectorAll('.ingredient-row');
    const ingredients = [];
    let rawMaterialsCost = 0;

    for (const r of rows) {
      const sel = r.querySelector('.ing-select');
      const inp = r.querySelector('.ing-grams');
      const matId = sel.value;
      const grams = parseFloat(inp.value) || 0;

      if (matId && grams > 0) {
        const mat = this.cachedMaterials.find(m => String(m.id) === String(matId));
        const costPerGram = mat ? (mat.costPerGram || 0) : 0;
        const totalCost = costPerGram * grams;
        rawMaterialsCost += totalCost;
        ingredients.push({
          materialId: Number(matId),
          materialName: mat ? mat.name : '',
          grams,
          costPerGram,
          totalCost
        });
      }
    }

    if (ingredients.length === 0) {
      App.toast('يرجى إضافة مادة خام واحدة على الأقل في تركيبة المنتج مع تحديد الوزن بالجرام', 'warning');
      return;
    }

    const totalCost = Math.round((rawMaterialsCost + packagingCost + laborCost) * 100) / 100;

    const payload = {
      code,
      name,
      category: category || 'عام',
      netWeight,
      ingredients,
      rawMaterialsCost: Math.round(rawMaterialsCost * 100) / 100,
      packagingCost,
      laborCost,
      totalCost,
      profitType,
      profitMargin,
      sellingPrice,
      stockUnits,
      minStockUnits,
      notes,
      updatedAt: new Date().toISOString()
    };

    try {
      if (id) {
        payload.id = Number(id);
        await db.update('products', payload);
        App.toast('تم تحديث المنتج وتركيبته بنجاح', 'success');
      } else {
        payload.createdAt = new Date().toISOString();
        await db.add('products', payload);
        App.toast('تم حفظ المنتج الجديد بنجاح', 'success');
      }

      App.closeModal('modal-product');
      await this.render();
      if (window.POS) await POS.refreshCatalog();
      if (window.App) await App.updateDashboard();
    } catch (err) {
      console.error(err);
      App.toast('حدث خطأ أثناء حفظ المنتج', 'error');
    }
  },

  // --- Batch Production Modal & Execution ---

  async openBatchModal(productId) {
    await this.refreshMaterialsList();
    const product = await db.getById('products', productId);
    if (!product) return;

    const modal = document.getElementById('modal-batch-produce');
    if (!modal) return;

    document.getElementById('batch-prod-id').value = product.id;
    document.getElementById('batch-prod-name').textContent = product.name;
    document.getElementById('batch-prod-cur-stock').textContent = `${product.stockUnits || 0} عبوة`;
    document.getElementById('batch-quantity').value = 10;
    document.getElementById('batch-notes').value = '';

    this.calculateBatchRequirements(product, 10);

    const qtyInput = document.getElementById('batch-quantity');
    qtyInput.oninput = () => {
      const q = parseInt(qtyInput.value) || 0;
      this.calculateBatchRequirements(product, q);
    };

    App.openModal('modal-batch-produce');
  },

  calculateBatchRequirements(product, quantity) {
    const listElem = document.getElementById('batch-ingredients-checklist');
    const btnSubmit = document.getElementById('btn-confirm-batch');
    if (!listElem) return;

    if (quantity <= 0) {
      listElem.innerHTML = `<div style="color:var(--danger); padding:1rem;">الكمية يجب أن تكون أكبر من صفر</div>`;
      if (btnSubmit) btnSubmit.disabled = true;
      return;
    }

    const matMap = new Map(this.cachedMaterials.map(m => [m.id, m]));
    let canProduce = true;
    let html = '';

    (product.ingredients || []).forEach(ing => {
      const mat = matMap.get(Number(ing.materialId));
      const requiredGrams = (ing.grams || 0) * quantity;
      const currentStock = mat ? (mat.stockGrams || 0) : 0;
      const isSufficient = currentStock >= requiredGrams;

      if (!isSufficient) canProduce = false;

      html += `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 0; border-bottom:1px dashed var(--border);">
          <div>
            <strong>${ing.materialName || (mat ? mat.name : 'مادة')}</strong>
            <span style="font-size:0.75rem; color:var(--text-secondary);">(${ing.grams} جم / عبوة)</span>
          </div>
          <div style="text-align:left;">
            <div>
              <strong style="color:${isSufficient ? 'var(--text-primary)' : 'var(--danger)'};">
                المطلوب: ${requiredGrams.toLocaleString()} جم
              </strong>
            </div>
            <div style="font-size:0.75rem; color:${isSufficient ? 'var(--success)' : 'var(--danger)'};">
              ${isSufficient ? `متوفر بالمخزن (${currentStock.toLocaleString()} جم)` : `عجز بالمخزن! (المتاح: ${currentStock.toLocaleString()} جم فقط)`}
            </div>
          </div>
        </div>
      `;
    });

    listElem.innerHTML = html;
    if (btnSubmit) {
      btnSubmit.disabled = !canProduce;
      if (!canProduce) {
        btnSubmit.title = 'لا يمكن التصنيع بسبب نقص رصيد المواد الخام';
      } else {
        btnSubmit.title = 'تأكيد خصم المواد وتصنيع الكمية';
      }
    }
  },

  async handleBatchProduce(e) {
    e.preventDefault();
    const productId = Number(document.getElementById('batch-prod-id').value);
    const quantity = parseInt(document.getElementById('batch-quantity').value) || 0;
    const notes = document.getElementById('batch-notes').value.trim();

    try {
      const res = await db.produceBatch(productId, quantity, notes);
      App.toast(`تم تصنيع ${quantity} عبوة بنجاح، وخصم المواد الخام من المخزن`, 'success');
      App.closeModal('modal-batch-produce');
      await this.render();
      if (window.MaterialsManager) await MaterialsManager.render();
      if (window.POS) await POS.refreshCatalog();
      if (window.App) await App.updateDashboard();
    } catch (err) {
      console.error(err);
      App.toast(err.message || 'حدث خطأ أثناء تشغيل الدفعة', 'error');
    }
  },

  // --- Recipe & Cost Breakdown Modal ---

  async openRecipeModal(productId) {
    const product = await db.getById('products', productId);
    if (!product) return;

    const modal = document.getElementById('modal-recipe-view');
    if (!modal) return;

    const config = (await db.getSetting('appConfig')) || { currency: 'ج.م' };
    const curr = config.currency || 'ج.م';

    document.getElementById('recipe-view-title').textContent = `بطاقة تركيبة وتكاليف: ${product.name} (${product.code})`;
    document.getElementById('recipe-net-weight').textContent = `${product.netWeight || 0} جم`;
    document.getElementById('recipe-total-cost').textContent = `${(product.totalCost || 0).toFixed(2)} ${curr}`;
    document.getElementById('recipe-selling-price').textContent = `${(product.sellingPrice || 0).toFixed(2)} ${curr}`;
    document.getElementById('recipe-profit-val').textContent = `+${((product.sellingPrice || 0) - (product.totalCost || 0)).toFixed(2)} ${curr}`;

    const tbody = document.getElementById('recipe-ingredients-body');
    tbody.innerHTML = (product.ingredients || []).map(ing => `
      <tr>
        <td><strong>${ing.materialName}</strong></td>
        <td><strong>${ing.grams} جم</strong></td>
        <td>${(ing.costPerGram || 0).toFixed(3)} ${curr}</td>
        <td><strong>${(ing.totalCost || 0).toFixed(2)} ${curr}</strong></td>
      </tr>
    `).join('');

    document.getElementById('recipe-packaging-val').textContent = `${(product.packagingCost || 0).toFixed(2)} ${curr}`;
    document.getElementById('recipe-labor-val').textContent = `${(product.laborCost || 0).toFixed(2)} ${curr}`;
    document.getElementById('recipe-raw-val').textContent = `${(product.rawMaterialsCost || 0).toFixed(2)} ${curr}`;

    App.openModal('modal-recipe-view');
  },

  async deleteProduct(id) {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
    try {
      await db.delete('products', id);
      App.toast('تم حذف المنتج بنجاح', 'success');
      await this.render();
      if (window.POS) await POS.refreshCatalog();
      if (window.App) await App.updateDashboard();
    } catch (err) {
      console.error(err);
      App.toast('تعذر حذف المنتج', 'error');
    }
  }
};
