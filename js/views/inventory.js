/**
 * SerenityCare Facility Store & Pharmacy Inventory View
 * Manages stock levels, batch tracking, stock-in/dispensing transactions, and printable inventory audits.
 */

class InventoryView {
  constructor() {
    this.categoryFilter = 'all';
    this.searchQuery = '';
  }

  render(container) {
    const state = window.AppStore.getState();
    const inventory = state.inventory;
    const transactions = state.inventoryTransactions;

    const filteredItems = inventory.filter(item => {
      const matchCat = this.categoryFilter === 'all' || item.category === this.categoryFilter;
      const q = this.searchQuery.toLowerCase();
      const matchSearch = !q || item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q) || item.location.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });

    const totalValuation = inventory.reduce((sum, i) => sum + (i.quantity * i.cost), 0);
    const lowStockCount = inventory.filter(i => i.quantity <= i.minThreshold).length;

    container.innerHTML = `
      <div class="space-y-6">
        
        <!-- Header -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 class="text-2xl font-black text-slate-900 tracking-tight">Facility Store &amp; Pharmacy Inventory</h2>
            <p class="text-xs text-slate-500 mt-0.5">Track medication stocks, clinical diagnostics, recovery literature, and usage audits</p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <button id="print-inventory-report-btn" class="px-4 py-2.5 rounded-xl text-xs font-bold btn-decor-secondary flex items-center gap-2">
              <i data-lucide="printer" class="w-4 h-4 text-teal-600"></i>
              <span>Print Inventory Audit Report</span>
            </button>
            <button id="add-inventory-item-btn" class="px-4 py-2.5 rounded-xl text-xs font-bold btn-decor-primary flex items-center gap-2">
              <i data-lucide="plus-circle" class="w-4 h-4"></i>
              <span>Add Store Item</span>
            </button>
          </div>
        </div>

        <!-- Metric KPI Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="medical-card p-4 flex items-center gap-4">
            <div class="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <i data-lucide="boxes" class="w-5 h-5"></i>
            </div>
            <div>
              <span class="text-xs text-slate-500 font-semibold uppercase">Total Cataloged Items</span>
              <div class="text-2xl font-black text-slate-900">${inventory.length}</div>
            </div>
          </div>

          <div class="medical-card p-4 flex items-center gap-4 border-l-4 ${lowStockCount > 0 ? 'border-l-rose-500' : 'border-l-emerald-500'}">
            <div class="w-10 h-10 rounded-xl ${lowStockCount > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'} flex items-center justify-center shrink-0">
              <i data-lucide="alert-triangle" class="w-5 h-5"></i>
            </div>
            <div>
              <span class="text-xs text-slate-500 font-semibold uppercase">Low Stock Alerts</span>
              <div class="text-2xl font-black ${lowStockCount > 0 ? 'text-rose-600' : 'text-slate-900'}">${lowStockCount} Items</div>
            </div>
          </div>

          <div class="medical-card p-4 flex items-center gap-4">
            <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <i data-lucide="circle-dollar-sign" class="w-5 h-5"></i>
            </div>
            <div>
              <span class="text-xs text-slate-500 font-semibold uppercase">Total Inventory Value</span>
              <div class="text-2xl font-black text-slate-900">${window.I18n ? window.I18n.formatCurrency(totalValuation) : `TZS ${totalValuation.toLocaleString()}`}</div>
            </div>
          </div>
        </div>

        <!-- Filter & Search Controls -->
        <div class="medical-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div class="flex flex-wrap items-center gap-2 text-xs">
            ${[
              { key: 'all', label: 'All Categories' },
              { key: 'Prescription Pharmaceuticals', label: 'Pharmaceuticals' },
              { key: 'Emergency Medical Supplies', label: 'Emergency / Narcan' },
              { key: 'Diagnostic & Testing', label: 'Test Cups / Diagnostics' },
              { key: 'Recovery Literature', label: 'Literature' }
            ].map(tab => `
              <button class="inv-cat-filter-btn px-3 py-1.5 rounded-lg font-semibold transition ${this.categoryFilter === tab.key ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
                      data-cat="${tab.key}">
                ${tab.label}
              </button>
            `).join('')}
          </div>

          <div class="relative w-full md:w-64">
            <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>
            <input type="text" id="inv-search-input" value="${this.searchQuery}" placeholder="Search item, code, shelf..." 
                   class="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500">
          </div>
        </div>

        <!-- Inventory Store Items Table -->
        <div class="medical-card overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="border-b border-slate-200 bg-slate-50 text-[11px] text-slate-500 font-semibold uppercase">
                  <th class="py-3 px-4">Item Code</th>
                  <th class="py-3 px-4">Item Description</th>
                  <th class="py-3 px-4">Category</th>
                  <th class="py-3 px-4 text-right">Stock Level</th>
                  <th class="py-3 px-4 text-right">Unit Cost</th>
                  <th class="py-3 px-4">Location</th>
                  <th class="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${filteredItems.length > 0 ? filteredItems.map(item => {
                  const isLow = item.quantity <= item.minThreshold;
                  return `
                    <tr class="hover:bg-slate-50/70 transition">
                      <td class="py-3 px-4 font-mono font-bold text-slate-600">${item.code}</td>
                      <td class="py-3 px-4">
                        <div class="font-bold text-slate-900">${item.name}</div>
                        <div class="text-[10px] text-slate-400">Batch: ${item.batchNumber} &bull; Exp: ${item.expiryDate}</div>
                      </td>
                      <td class="py-3 px-4">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">${item.category}</span>
                      </td>
                      <td class="py-3 px-4 text-right">
                        <span class="font-bold text-sm ${isLow ? 'text-rose-600 font-black' : 'text-slate-900'}">${item.quantity}</span>
                        <span class="text-[11px] text-slate-400"> ${item.unit}</span>
                        ${isLow ? `<span class="block text-[10px] font-bold text-rose-500 animate-pulse">Low Stock (Min: ${item.minThreshold})</span>` : ''}
                      </td>
                      <td class="py-3 px-4 text-right font-mono font-semibold text-slate-700">${window.I18n ? window.I18n.formatCurrency(item.cost) : `TZS ${item.cost.toLocaleString()}`}</td>
                      <td class="py-3 px-4 text-slate-500">${item.location}</td>
                      <td class="py-3 px-4 text-right">
                        <div class="flex items-center justify-end gap-1.5">
                          <button class="px-2.5 py-1 rounded-lg text-[11px] font-bold btn-decor-primary stock-in-btn" data-item-id="${item.id}">
                            + Restock
                          </button>
                          <button class="px-2.5 py-1 rounded-lg text-[11px] font-bold btn-decor-secondary text-rose-700 hover:bg-rose-50 dispense-btn" data-item-id="${item.id}">
                            - Dispense
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('') : `
                  <tr>
                    <td colspan="7" class="py-12 text-center text-slate-400 text-xs">
                      <i data-lucide="boxes" class="w-8 h-8 mx-auto text-slate-300 mb-2"></i>
                      <p class="font-bold text-slate-600">Store &amp; Pharmacy Catalog is Empty</p>
                      <p class="text-[11px] text-slate-400 mt-1">Click "Add Store Item" above to register pharmaceuticals, kits, or supplies.</p>
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Recent Stock Transactions Audit Trail -->
        <div class="medical-card p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-sm font-bold text-slate-900">Recent Stock Transactions Audit Trail</h3>
              <p class="text-xs text-slate-500">Every restock and dispense activity is permanently logged</p>
            </div>
            <i data-lucide="history" class="w-4 h-4 text-slate-400"></i>
          </div>

          <div class="space-y-2">
            ${transactions.length > 0 ? transactions.slice(0, 5).map(tx => `
              <div class="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                <div class="flex items-center gap-3">
                  <span class="px-2 py-0.5 rounded font-bold text-[10px] ${tx.type === 'Stock In' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                    ${tx.type}
                  </span>
                  <div>
                    <strong class="text-slate-800">${tx.itemName}</strong>
                    <span class="text-slate-500"> (${tx.quantity} units)</span>
                    <div class="text-[10px] text-slate-400 italic">${tx.notes}</div>
                  </div>
                </div>
                <div class="text-right text-[11px]">
                  <span class="text-slate-700 font-semibold">${tx.user}</span>
                  <div class="text-slate-400 font-mono text-[10px]">${tx.date}</div>
                </div>
              </div>
            `).join('') : `
              <p class="text-xs text-slate-400 italic py-3 text-center">No inventory movements or dispense transactions recorded yet.</p>
            `}
          </div>
        </div>

      </div>
    `;

    // Filter bindings
    document.querySelectorAll('.inv-cat-filter-btn').forEach(btn => {
      btn.onclick = () => {
        this.categoryFilter = btn.getAttribute('data-cat');
        this.render(container);
      };
    });

    const searchInput = document.getElementById('inv-search-input');
    if (searchInput) {
      searchInput.oninput = (e) => {
        this.searchQuery = e.target.value;
        this.render(container);
      };
    }

    // Print Report
    document.getElementById('print-inventory-report-btn').onclick = () => {
      window.AppDocs.openInventoryReport();
    };

    // Add Item
    document.getElementById('add-inventory-item-btn').onclick = () => {
      this.openAddItemModal();
    };

    // Restock & Dispense buttons
    document.querySelectorAll('.stock-in-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-item-id');
        this.openTransactionModal(id, 'Stock In');
      };
    });

    document.querySelectorAll('.dispense-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-item-id');
        this.openTransactionModal(id, 'Dispensed');
      };
    });

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  openAddItemModal() {
    const html = `
      <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
        <h3 class="text-lg font-bold text-slate-900">Add New Store &amp; Pharmacy Item</h3>
        <button id="close-item-modal" class="p-1 text-slate-400 hover:bg-slate-100 rounded-lg">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <form id="new-item-form" class="space-y-4 text-xs">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Item Code *</label>
            <input type="text" id="item-code" required placeholder="MED-XYZ-01" class="w-full px-3 py-2 rounded-lg border border-slate-200">
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Item Name *</label>
            <input type="text" id="item-name" required placeholder="E.g., Narcan 4mg Spray" class="w-full px-3 py-2 rounded-lg border border-slate-200">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Category *</label>
            <select id="item-cat" class="w-full px-3 py-2 rounded-lg border border-slate-200">
              <option value="Prescription Pharmaceuticals">Prescription Pharmaceuticals</option>
              <option value="Emergency Medical Supplies">Emergency Medical Supplies</option>
              <option value="Diagnostic &amp; Testing">Diagnostic &amp; Testing</option>
              <option value="Vitamins &amp; Supplements">Vitamins &amp; Supplements</option>
              <option value="Recovery Literature">Recovery Literature</option>
            </select>
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Unit of Measure *</label>
            <input type="text" id="item-unit" value="Tablets" placeholder="Tablets, Films, Kits, Books" class="w-full px-3 py-2 rounded-lg border border-slate-200">
          </div>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Initial Qty *</label>
            <input type="number" id="item-qty" required value="50" min="0" class="w-full px-3 py-2 rounded-lg border border-slate-200">
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Min Threshold *</label>
            <input type="number" id="item-min" required value="20" min="0" class="w-full px-3 py-2 rounded-lg border border-slate-200">
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Unit Cost (TZS) *</label>
            <input type="number" id="item-cost" required step="100" value="15000" class="w-full px-3 py-2 rounded-lg border border-slate-200">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Batch Number</label>
            <input type="text" id="item-batch" value="BT-2026-A" class="w-full px-3 py-2 rounded-lg border border-slate-200">
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Storage Location</label>
            <input type="text" id="item-loc" value="Pharmacy Cabinet 1" class="w-full px-3 py-2 rounded-lg border border-slate-200">
          </div>
        </div>

        <div class="pt-4 border-t border-slate-200 flex justify-end gap-3">
          <button type="button" id="cancel-item-btn" class="px-4 py-2 rounded-xl btn-decor-secondary font-semibold">Cancel</button>
          <button type="submit" class="px-5 py-2 rounded-xl btn-decor-primary font-bold">Register Item</button>
        </div>
      </form>
    `;

    window.AppModal.showCustom(html, 'max-w-lg');

    document.getElementById('close-item-modal').onclick = () => window.AppModal.close();
    document.getElementById('cancel-item-btn').onclick = () => window.AppModal.close();

    document.getElementById('new-item-form').onsubmit = (e) => {
      e.preventDefault();
      window.AppStore.addInventoryItem({
        code: document.getElementById('item-code').value.trim(),
        name: document.getElementById('item-name').value.trim(),
        category: document.getElementById('item-cat').value,
        unit: document.getElementById('item-unit').value.trim(),
        quantity: document.getElementById('item-qty').value,
        minThreshold: document.getElementById('item-min').value,
        cost: document.getElementById('item-cost').value,
        batchNumber: document.getElementById('item-batch').value.trim(),
        location: document.getElementById('item-loc').value.trim(),
        expiryDate: '2028-01-01'
      });
      window.AppModal.close();
      window.AppModal.alert('Item Added', 'Store item registered and inventory catalog updated.', 'success');
    };
  }

  openTransactionModal(itemId, type) {
    const state = window.AppStore.getState();
    const item = state.inventory.find(i => i.id === itemId);
    if (!item) return;

    const isStockIn = type === 'Stock In';

    window.AppModal.showAcceptanceCard({
      title: isStockIn ? `Restock: ${item.name}` : `Dispense: ${item.name}`,
      subtitle: `Current Stock: ${item.quantity} ${item.unit}`,
      icon: isStockIn ? 'package-plus' : 'package-minus',
      badgeText: isStockIn ? 'INVENTORY RECEIPT' : 'PHARMACY DISPENSE',
      badgeColor: isStockIn ? 'badge-medical-emerald' : 'badge-medical-rose',
      confirmType: isStockIn ? 'success' : 'primary',
      contentHtml: `
        <div class="space-y-3 text-xs">
          <div>
            <label class="block font-bold text-slate-700 mb-1">${isStockIn ? 'Quantity to Add' : 'Quantity to Dispense'} (${item.unit}) *</label>
            <input type="number" id="tx-qty" value="10" min="1" max="${isStockIn ? 9999 : item.quantity}" class="w-full px-3 py-2 rounded-lg border border-slate-200">
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Reason / Clinical Note</label>
            <input type="text" id="tx-notes" placeholder="${isStockIn ? 'Supplier restock invoice #123' : 'Dispensed for resident floor supply'}" class="w-full px-3 py-2 rounded-lg border border-slate-200">
          </div>
        </div>
      `,
      confirmText: isStockIn ? 'Confirm Restock' : 'Authorize Dispense',
      cancelText: 'Cancel',
      onConfirm: () => {
        const qty = parseInt(document.getElementById('tx-qty').value) || 1;
        const notes = document.getElementById('tx-notes').value.trim();
        window.AppStore.updateInventoryStock(item.id, qty, type, notes);
        window.AppModal.close();
      }
    });
  }
}

window.InventoryView = InventoryView;
