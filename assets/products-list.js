import { supabase } from './supabase.js';
import { requireAuth } from './auth.js';
import { renderShell } from './layout.js';

const session = await requireAuth();
if (!session) throw new Error('no session');
const root = renderShell({ active: 'products', session });

root.innerHTML = `
  <div class="page-header">
    <div><h1>Produtos</h1><div class="subtitle">Cadastro, variantes, custos e preços</div></div>
    <input type="text" id="search" placeholder="Buscar produto..." style="width: 260px;">
  </div>
  <div id="products" class="product-grid"></div>
`;

let all = [];

async function load() {
  const { data, error } = await supabase.from('products')
    .select(`id, name, brand, active,
      product_variants(id, sale_price, cost_price, stock_quantity, min_stock_alert, active)`)
    .order('name');
  if (error) { document.getElementById('products').innerHTML = `<div class="error">Erro: ${error.message}</div>`; return; }
  all = data;
  render(all);
}

function render(items) {
  const container = document.getElementById('products');
  if (!items.length) { container.innerHTML = `<div class="empty">Nenhum produto encontrado.</div>`; return; }
  container.innerHTML = items.map(p => {
    const vars = (p.product_variants || []).filter(v => v.active);
    const minPrice = vars.length ? Math.min(...vars.map(v => Number(v.sale_price))) : 0;
    const totalStock = vars.reduce((s, v) => s + Number(v.stock_quantity ?? 0), 0);
    const anyLow = vars.some(v => Number(v.min_stock_alert) > 0 && Number(v.stock_quantity) <= Number(v.min_stock_alert));
    const stockClass = totalStock === 0 ? 'zero' : (anyLow ? 'low' : '');
    const stockLabel = totalStock === 0 ? 'Sem estoque' : `${totalStock.toLocaleString('pt-BR')} un`;
    return `
      <a class="product-card" href="product.html?id=${p.id}">
        <div class="brand">${esc(p.brand ?? 'Sem marca')}</div>
        <div class="name">${esc(p.name)}</div>
        <div class="row">
          <span class="price">${minPrice > 0 ? 'R$ ' + minPrice.toFixed(2).replace('.', ',') : '—'}</span>
          <span class="stock-badge ${stockClass}">${stockLabel}</span>
        </div>
        <div class="row"><span class="hint">${vars.length} variante(s)</span>
          ${p.active ? '<span class="chip active">ativo</span>' : '<span class="chip inactive">inativo</span>'}
        </div>
      </a>`;
  }).join('');
}

document.getElementById('search').oninput = e => {
  const q = e.target.value.toLowerCase().trim();
  render(q ? all.filter(p => (p.name + (p.brand ?? '')).toLowerCase().includes(q)) : all);
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
load();
