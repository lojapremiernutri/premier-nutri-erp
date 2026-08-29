import { supabase } from './supabase.js';
import { requireAuth } from './auth.js';
import { renderShell } from './layout.js';

const session = await requireAuth();
if (!session) throw new Error('no session');
const root = renderShell({ active: 'products', session });

const productId = new URLSearchParams(location.search).get('id');
if (!productId) location.href = 'products.html';

root.innerHTML = `
  <div class="page-header">
    <div><h1 id="product-name">Carregando...</h1><div class="subtitle" id="product-brand"></div></div>
    <a href="products.html" class="secondary" style="text-decoration: none; padding: 8px 14px; border-radius: 6px;">← Voltar</a>
  </div>
  <div class="card">
    <div class="card-header"><h2>Variantes</h2><button id="add-variant">+ Nova variante</button></div>
    <div class="table-wrap">
      <table class="data" id="variants">
        <thead><tr>
          <th>SKU</th><th>Sabor</th><th>Tamanho</th>
          <th class="num">Custo</th><th class="num">Preço</th><th class="num">Margem</th>
          <th class="num">Estoque</th><th class="num">Mín.</th>
          <th class="center">Ativo</th><th></th>
        </tr></thead>
        <tbody></tbody>
      </table>
    </div>
    <p class="hint" style="margin-top: 14px;">
      Editar <b>Estoque</b> aqui é ajuste manual (bom pra saldo inicial). Quando o módulo de Estoque estiver pronto, entradas e baixas atualizam esse número automaticamente.
    </p>
  </div>
`;

async function loadProduct() {
  const { data } = await supabase.from('products').select('name, brand').eq('id', productId).single();
  if (data) { document.getElementById('product-name').textContent = data.name; document.getElementById('product-brand').textContent = data.brand ?? ''; }
}

async function loadVariants() {
  const { data, error } = await supabase.from('product_variants').select('*').eq('product_id', productId).order('created_at');
  if (error) return alert('Erro: ' + error.message);
  render(data);
}

function render(variants) {
  const tbody = document.querySelector('#variants tbody');
  if (!variants.length) { tbody.innerHTML = `<tr><td colspan="10" class="empty">Nenhuma variante. Clique em "+ Nova variante".</td></tr>`; return; }
  tbody.innerHTML = variants.map(v => `
    <tr data-id="${v.id}">
      <td><input class="sku" value="${v.sku ?? ''}" style="min-width: 90px;"></td>
      <td><input class="flavor" value="${v.flavor ?? ''}" placeholder="—" style="min-width: 90px;"></td>
      <td><input class="size" value="${v.size ?? ''}" placeholder="—" style="min-width: 70px;"></td>
      <td class="num"><input class="cost" type="number" step="0.01" value="${v.cost_price}" style="min-width: 80px;"></td>
      <td class="num"><input class="price" type="number" step="0.01" value="${v.sale_price}" style="min-width: 80px;"></td>
      <td class="num margin-cell">${Number(v.margin_on_sale_pct).toFixed(1)}%</td>
      <td class="num"><input class="stock" type="number" step="1" value="${v.stock_quantity}" style="min-width: 70px;"></td>
      <td class="num"><input class="min-stock" type="number" step="1" value="${v.min_stock_alert}" style="min-width: 60px;"></td>
      <td class="center"><input class="active" type="checkbox" ${v.active ? 'checked' : ''}></td>
      <td style="white-space: nowrap;"><button class="save small">Salvar</button> <button class="del danger small">×</button></td>
    </tr>`).join('');
  wire();
}

function wire() {
  document.querySelectorAll('#variants tbody tr').forEach(tr => {
    const cost = tr.querySelector('.cost'), price = tr.querySelector('.price');
    const recalc = () => {
      const c = parseFloat(cost.value) || 0, p = parseFloat(price.value) || 0;
      tr.querySelector('.margin-cell').textContent = p > 0 ? (((p - c) / p) * 100).toFixed(1) + '%' : '0%';
    };
    cost.addEventListener('input', recalc); price.addEventListener('input', recalc);
    tr.querySelector('.save').onclick = () => save(tr);
    tr.querySelector('.del').onclick = () => del(tr);
  });
}

async function save(tr) {
  const payload = {
    sku: tr.querySelector('.sku').value.trim() || null,
    flavor: tr.querySelector('.flavor').value.trim() || null,
    size: tr.querySelector('.size').value.trim() || null,
    cost_price: parseFloat(tr.querySelector('.cost').value) || 0,
    sale_price: parseFloat(tr.querySelector('.price').value) || 0,
    stock_quantity: parseFloat(tr.querySelector('.stock').value) || 0,
    min_stock_alert: parseFloat(tr.querySelector('.min-stock').value) || 0,
    active: tr.querySelector('.active').checked,
  };
  const { error } = await supabase.from('product_variants').update(payload).eq('id', tr.dataset.id);
  if (error) alert('Erro: ' + error.message); else loadVariants();
}

async function del(tr) {
  if (!confirm('Excluir esta variante?')) return;
  const { error } = await supabase.from('product_variants').delete().eq('id', tr.dataset.id);
  if (error) alert('Erro: ' + error.message); else loadVariants();
}

document.getElementById('add-variant').onclick = async () => {
  const { error } = await supabase.from('product_variants').insert({ product_id: productId, sale_price: 0, cost_price: 0 });
  if (error) alert('Erro: ' + error.message); else loadVariants();
};

loadProduct(); loadVariants();
