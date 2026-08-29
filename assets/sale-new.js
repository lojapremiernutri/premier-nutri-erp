import { supabase } from './supabase.js';
import { requireAuth } from './auth.js';
import { renderShell } from './layout.js';

const session = await requireAuth();
if (!session) throw new Error('no session');
const root = renderShell({ active: 'sales', session });

let customers = [], variants = [], paymentMethods = [];
const state = {
  customer_id: '', payment_method_id: '', installments: 1,
  discount: 0, delivery_fee: 0, notes: '', items: [],
};

async function init() {
  const [c, v, pm] = await Promise.all([
    supabase.from('customers').select('id, name, phone').order('name'),
    supabase.from('product_variants').select('id, sku, flavor, size, sale_price, cost_price, stock_quantity, products(name)').eq('active', true).order('created_at'),
    supabase.from('payment_methods').select('*').eq('active', true).order('display_order'),
  ]);
  customers = c.data ?? [];
  variants = (v.data ?? []).sort((a, b) => (a.products?.name || '').localeCompare(b.products?.name || ''));
  paymentMethods = pm.data ?? [];
  if (paymentMethods.length) state.payment_method_id = paymentMethods[0].id;
  renderPage();
}

const fmtBRL = n => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function variantLabel(v) {
  const parts = [v.products?.name || 'Produto'];
  if (v.flavor) parts.push(v.flavor);
  if (v.size) parts.push(v.size);
  return parts.join(' · ') + ` — estoque: ${v.stock_quantity}`;
}
function selectedMethod() { return paymentMethods.find(p => p.id === state.payment_method_id); }
function feePct() {
  const m = selectedMethod();
  if (!m) return 0;
  if (m.type === 'credito') return Number(m.installments_config?.[state.installments] || 0);
  return Number(m.fee_percentage || 0);
}
function computeTotals() {
  const subtotal = state.items.reduce((s, it) => s + (it.quantity * it.unit_price - it.discount), 0);
  const totalCost = state.items.reduce((s, it) => s + (it.quantity * it._cost), 0);
  const total = Math.max(0, subtotal - state.discount + state.delivery_fee);
  const cardFee = total * feePct() / 100;
  const profit = total - totalCost - cardFee;
  return { subtotal, totalCost, total, cardFee, profit };
}

function renderPage() {
  root.innerHTML = `
    <div class="page-header">
      <div><h1>Nova venda</h1><div class="subtitle">Registre um pedido do WhatsApp</div></div>
      <a href="sales.html" style="text-decoration:none; padding:8px 14px; border-radius:6px; border:1px solid var(--border); color:var(--text);">← Voltar</a>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 340px; gap: 16px; align-items: start;">
      <div>
        <div class="card">
          <div class="card-header"><h2>Cliente</h2></div>
          <label>Cliente (opcional)</label>
          <div style="display:flex; gap:8px;">
            <select id="customer-select" style="flex:1;">
              <option value="">— Cliente esporádico —</option>
              ${customers.map(c => `<option value="${c.id}" ${c.id === state.customer_id ? 'selected' : ''}>${esc(c.name)}${c.phone ? ' · ' + esc(c.phone) : ''}</option>`).join('')}
            </select>
            <button id="toggle-nc" class="secondary">+ Novo</button>
          </div>
          <div id="nc-form" style="display:none; margin-top:10px; padding:12px; background:var(--bg-2); border-radius:6px;">
            <div style="display:grid; grid-template-columns:1fr 1fr auto; gap:8px; align-items:end;">
              <div><label>Nome</label><input id="nc-name" type="text"></div>
              <div><label>Telefone</label><input id="nc-phone" type="text"></div>
              <button id="nc-save">Salvar</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h2>Itens</h2><button id="add-item">+ Adicionar item</button></div>
          <div class="table-wrap">
            <table class="data" id="items-table">
              <thead><tr>
                <th style="min-width:260px;">Produto / Variante</th>
                <th class="num" style="width:80px;">Qtd</th>
                <th class="num" style="width:100px;">Preço</th>
                <th class="num" style="width:100px;">Desc.</th>
                <th class="num" style="width:110px;">Subtotal</th>
                <th style="width:40px;"></th>
              </tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h2>Pagamento e ajustes</h2></div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div><label>Método de pagamento</label>
              <select id="payment-method">
                ${paymentMethods.map(p => `<option value="${p.id}" ${p.id === state.payment_method_id ? 'selected' : ''}>${esc(p.name)}${p.fee_percentage > 0 ? ` (${p.fee_percentage}%)` : ''}</option>`).join('')}
              </select>
            </div>
            <div id="installments-wrap" style="display:none;"><label>Parcelas</label><select id="installments"></select></div>
            <div><label>Desconto geral (R$)</label><input id="discount" type="number" step="0.01" value="${state.discount}"></div>
            <div><label>Taxa de entrega (R$)</label><input id="delivery-fee" type="number" step="0.01" value="${state.delivery_fee}"></div>
          </div>
          <label style="margin-top:12px;">Observações</label>
          <textarea id="notes" rows="2">${esc(state.notes)}</textarea>
        </div>
      </div>

      <div>
        <div class="card" style="position:sticky; top:20px;">
          <div class="card-header"><h2>Resumo</h2></div>
          <div id="summary"></div>
          <button id="submit" style="width:100%; margin-top:16px; padding:12px;">Registrar venda</button>
          <div id="submit-msg" class="error" style="display:none;"></div>
        </div>
      </div>
    </div>
  `;
  wire();
  renderItems();
  renderInstallments();
  renderSummary();
}

function renderItems() {
  const tbody = document.querySelector('#items-table tbody');
  if (!state.items.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">Nenhum item. Clique em "+ Adicionar item".</td></tr>`;
    return;
  }
  tbody.innerHTML = state.items.map((it, idx) => {
    const subtotal = it.quantity * it.unit_price - it.discount;
    return `
      <tr data-idx="${idx}">
        <td>
          <select class="i-variant">
            <option value="">Selecione a variante...</option>
            ${variants.map(v => `<option value="${v.id}" ${v.id === it.variant_id ? 'selected' : ''}>${esc(variantLabel(v))}</option>`).join('')}
          </select>
        </td>
        <td class="num"><input class="i-qty" type="number" step="1" min="1" value="${it.quantity}"></td>
        <td class="num"><input class="i-price" type="number" step="0.01" value="${it.unit_price}"></td>
        <td class="num"><input class="i-disc" type="number" step="0.01" value="${it.discount}"></td>
        <td class="num price-cell subtotal">${subtotal.toFixed(2).replace('.', ',')}</td>
        <td><button class="i-del danger small">×</button></td>
      </tr>`;
  }).join('');
  document.querySelectorAll('#items-table tbody tr').forEach(tr => {
    const idx = parseInt(tr.dataset.idx);
    tr.querySelector('.i-variant').onchange = e => {
      state.items[idx].variant_id = e.target.value;
      const v = variants.find(x => x.id === e.target.value);
      if (v) {
        state.items[idx].unit_price = Number(v.sale_price);
        state.items[idx]._cost = Number(v.cost_price);
      }
      renderItems(); renderSummary();
    };
    tr.querySelector('.i-qty').oninput = e => { state.items[idx].quantity = parseFloat(e.target.value) || 0; updateSubtotal(tr, idx); };
    tr.querySelector('.i-price').oninput = e => { state.items[idx].unit_price = parseFloat(e.target.value) || 0; updateSubtotal(tr, idx); };
    tr.querySelector('.i-disc').oninput = e => { state.items[idx].discount = parseFloat(e.target.value) || 0; updateSubtotal(tr, idx); };
    tr.querySelector('.i-del').onclick = () => { state.items.splice(idx, 1); renderItems(); renderSummary(); };
  });
}
function updateSubtotal(tr, idx) {
  const it = state.items[idx];
  tr.querySelector('.subtotal').textContent = (it.quantity * it.unit_price - it.discount).toFixed(2).replace('.', ',');
  renderSummary();
}

function renderInstallments() {
  const m = selectedMethod();
  const wrap = document.getElementById('installments-wrap');
  if (m?.type !== 'credito' || !m.installments_config) { wrap.style.display = 'none'; state.installments = 1; return; }
  wrap.style.display = '';
  const opts = Object.keys(m.installments_config).sort((a, b) => Number(a) - Number(b));
  const sel = document.getElementById('installments');
  sel.innerHTML = opts.map(n => `<option value="${n}" ${Number(n) === state.installments ? 'selected' : ''}>${n}x (taxa ${m.installments_config[n]}%)</option>`).join('');
  sel.onchange = e => { state.installments = parseInt(e.target.value); renderSummary(); };
}

function renderSummary() {
  const t = computeTotals();
  const m = selectedMethod();
  const feeLabel = m?.type === 'credito' ? `Taxa cartão (${state.installments}x · ${feePct()}%)` : `Taxa (${feePct()}%)`;
  document.getElementById('summary').innerHTML = `
    <div class="sum-row"><span>Subtotal</span><span>${fmtBRL(t.subtotal)}</span></div>
    <div class="sum-row"><span>Desconto geral</span><span>−${fmtBRL(state.discount)}</span></div>
    <div class="sum-row"><span>Taxa de entrega</span><span>${fmtBRL(state.delivery_fee)}</span></div>
    ${feePct() > 0 ? `<div class="sum-row hint"><span>${feeLabel}</span><span>${fmtBRL(t.cardFee)}</span></div>` : ''}
    <hr style="border:none; border-top:1px solid var(--border); margin:10px 0;">
    <div class="sum-row" style="font-size:16px; font-weight:600;"><span>Total</span><span style="color:var(--gold);">${fmtBRL(t.total)}</span></div>
    <div class="sum-row hint"><span>Custo total</span><span>${fmtBRL(t.totalCost)}</span></div>
    <div class="sum-row" style="font-weight:600; color:${t.profit >= 0 ? 'var(--success)' : 'var(--danger)'};"><span>Lucro estimado</span><span>${fmtBRL(t.profit)}</span></div>
  `;
}

function wire() {
  document.getElementById('customer-select').onchange = e => state.customer_id = e.target.value || null;
  document.getElementById('toggle-nc').onclick = () => {
    const f = document.getElementById('nc-form');
    f.style.display = f.style.display === 'none' ? '' : 'none';
  };
  document.getElementById('nc-save').onclick = async () => {
    const name = document.getElementById('nc-name').value.trim();
    const phone = document.getElementById('nc-phone').value.trim();
    if (!name) { alert('Nome é obrigatório'); return; }
    const { data, error } = await supabase.from('customers').insert({ name, phone: phone || null }).select().single();
    if (error) { alert('Erro: ' + error.message); return; }
    customers.push(data);
    state.customer_id = data.id;
    renderPage();
  };
  document.getElementById('add-item').onclick = () => {
    state.items.push({ variant_id: '', quantity: 1, unit_price: 0, discount: 0, _cost: 0 });
    renderItems(); renderSummary();
  };
  document.getElementById('payment-method').onchange = e => {
    state.payment_method_id = e.target.value; state.installments = 1;
    renderInstallments(); renderSummary();
  };
  document.getElementById('discount').oninput = e => { state.discount = parseFloat(e.target.value) || 0; renderSummary(); };
  document.getElementById('delivery-fee').oninput = e => { state.delivery_fee = parseFloat(e.target.value) || 0; renderSummary(); };
  document.getElementById('notes').oninput = e => state.notes = e.target.value;
  document.getElementById('submit').onclick = submit;
}

async function submit() {
  const msg = document.getElementById('submit-msg');
  msg.style.display = 'none';
  if (!state.items.length || state.items.some(it => !it.variant_id || it.quantity <= 0)) {
    msg.textContent = 'Adicione pelo menos um item com variante selecionada e quantidade > 0.';
    msg.style.display = 'block'; return;
  }
  const btn = document.getElementById('submit');
  btn.disabled = true; btn.textContent = 'Registrando...';
  const { data, error } = await supabase.rpc('create_sale', {
    p_customer_id: state.customer_id || null,
    p_address_id: null,
    p_payment_method_id: state.payment_method_id,
    p_installments: state.installments,
    p_discount: state.discount,
    p_delivery_fee: state.delivery_fee,
    p_notes: state.notes || null,
    p_items: state.items.map(it => ({
      variant_id: it.variant_id,
      quantity: it.quantity,
      unit_price: it.unit_price,
      discount: it.discount,
    })),
  });
  if (error) {
    msg.textContent = 'Erro: ' + error.message; msg.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Registrar venda'; return;
  }
  location.href = `sale-detail.html?id=${data}`;
}

init();
