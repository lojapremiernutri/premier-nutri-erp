import { supabase } from './supabase.js';
import { requireAuth, doLogout } from './auth.js';

const session = await requireAuth();
if (!session) throw new Error('no session');
document.getElementById('btn-logout').onclick = doLogout;

const productId = new URLSearchParams(location.search).get('id');
if (!productId) location.href = 'index.html';

async function loadProduct() {
  const { data, error } = await supabase
    .from('products')
    .select('name, brand')
    .eq('id', productId)
    .single();
  if (error) return alert('Erro ao carregar produto: ' + error.message);
  document.getElementById('product-name').textContent = data.name;
  document.getElementById('product-brand').textContent = data.brand ?? '';
}

async function loadVariants() {
  const { data, error } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: true });
  if (error) return alert('Erro ao carregar variantes: ' + error.message);
  renderVariants(data);
}

function renderVariants(variants) {
  const tbody = document.querySelector('#variants tbody');
  if (!variants.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="hint">Nenhuma variante. Clique em "+ Nova variante".</td></tr>`;
    return;
  }
  tbody.innerHTML = variants.map(v => `
    <tr data-id="${v.id}">
      <td><input class="sku" value="${v.sku ?? ''}"></td>
      <td><input class="flavor" value="${v.flavor ?? ''}" placeholder="—"></td>
      <td><input class="size" value="${v.size ?? ''}" placeholder="—"></td>
      <td><input class="cost" type="number" step="0.01" value="${v.cost_price}"></td>
      <td><input class="price" type="number" step="0.01" value="${v.sale_price}"></td>
      <td class="margin" style="text-align:right;">${v.margin_on_sale_pct}%</td>
      <td class="markup" style="text-align:right;">${v.markup_on_cost_pct}%</td>
      <td style="text-align:center;"><input class="active" type="checkbox" ${v.active ? 'checked' : ''}></td>
      <td style="white-space:nowrap;">
        <button class="save">Salvar</button>
        <button class="del danger">×</button>
      </td>
    </tr>
  `).join('');
  wireRows();
}

function wireRows() {
  document.querySelectorAll('#variants tbody tr').forEach(tr => {
    const cost  = tr.querySelector('.cost');
    const price = tr.querySelector('.price');
    if (!cost || !price) return;
    const recalc = () => {
      const c = parseFloat(cost.value) || 0;
      const p = parseFloat(price.value) || 0;
      tr.querySelector('.margin').textContent =
        p > 0 ? (((p - c) / p) * 100).toFixed(2) + '%' : '0%';
      tr.querySelector('.markup').textContent =
        c > 0 ? (((p - c) / c) * 100).toFixed(2) + '%' : '0%';
    };
    cost.addEventListener('input', recalc);
    price.addEventListener('input', recalc);
    tr.querySelector('.save').onclick = () => saveRow(tr);
    tr.querySelector('.del').onclick = () => deleteRow(tr);
  });
}

async function saveRow(tr) {
  const id = tr.dataset.id;
  const payload = {
    sku:        tr.querySelector('.sku').value.trim() || null,
    flavor:     tr.querySelector('.flavor').value.trim() || null,
    size:       tr.querySelector('.size').value.trim() || null,
    cost_price: parseFloat(tr.querySelector('.cost').value) || 0,
    sale_price: parseFloat(tr.querySelector('.price').value) || 0,
    active:     tr.querySelector('.active').checked,
  };
  const { error } = await supabase
    .from('product_variants').update(payload).eq('id', id);
  if (error) alert('Erro ao salvar: ' + error.message);
  else loadVariants();
}

async function deleteRow(tr) {
  if (!confirm('Excluir esta variante?')) return;
  const { error } = await supabase
    .from('product_variants').delete().eq('id', tr.dataset.id);
  if (error) alert('Erro ao excluir: ' + error.message);
  else loadVariants();
}

document.getElementById('add-variant').onclick = async () => {
  const { error } = await supabase.from('product_variants').insert({
    product_id: productId,
    sale_price: 0, cost_price: 0
  });
  if (error) alert('Erro ao criar: ' + error.message);
  else loadVariants();
};

loadProduct();
loadVariants();
