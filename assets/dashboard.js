import { supabase } from './supabase.js';
import { requireAuth } from './auth.js';
import { renderShell } from './layout.js';

const session = await requireAuth();
if (!session) throw new Error('no session');
const root = renderShell({ active: 'dashboard', session });

root.innerHTML = `
  <div class="page-header">
    <div>
      <h1>Dashboard</h1>
      <div class="subtitle">Visão geral da operação</div>
    </div>
    <div class="pill-tabs" id="period-tabs">
      <button data-period="7">7 dias</button>
      <button data-period="30" class="active">30 dias</button>
      <button data-period="90">90 dias</button>
    </div>
  </div>

  <div class="kpi-grid" id="kpis">
    <div class="kpi"><div class="label">Faturamento</div><div class="value">R$ —</div><div class="sub">Carregando...</div></div>
    <div class="kpi success"><div class="label">Lucro líquido</div><div class="value">R$ —</div><div class="sub">Carregando...</div></div>
    <div class="kpi gold"><div class="label">Valor em estoque</div><div class="value">R$ —</div><div class="sub">Carregando...</div></div>
    <div class="kpi warning"><div class="label">Estoque baixo</div><div class="value">—</div><div class="sub">Carregando...</div></div>
  </div>

  <div class="card">
    <div class="card-header"><h2>Top produtos (últimos 30 dias)</h2><span class="hint">Ordenados por faturamento</span></div>
    <div class="table-wrap">
      <table class="data" id="top-products">
        <thead><tr><th>Produto</th><th class="num">Unid.</th><th class="num">Faturamento</th><th class="num">Lucro bruto</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </div>

  <div class="card">
    <div class="card-header"><h2>Alerta de estoque baixo</h2><span class="hint">Variantes com quantidade abaixo do mínimo</span></div>
    <div class="table-wrap">
      <table class="data" id="low-stock">
        <thead><tr><th>Produto</th><th>Variante</th><th class="num">Em estoque</th><th class="num">Mínimo</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </div>
`;

let currentPeriod = 30;

document.querySelectorAll('#period-tabs button').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('#period-tabs button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPeriod = parseInt(btn.dataset.period);
    loadSales();
  };
});

const fmtBRL = n => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = n => (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });

async function loadSales() {
  const since = new Date(Date.now() - currentPeriod * 86400000).toISOString();
  const { data: sales } = await supabase
    .from('sales').select('total, profit, status')
    .gte('sold_at', since).neq('status', 'cancelada');

  const revenue = (sales ?? []).reduce((s, x) => s + Number(x.total), 0);
  const profit  = (sales ?? []).reduce((s, x) => s + Number(x.profit), 0);
  const count = (sales ?? []).length;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  const kpis = document.querySelectorAll('#kpis .kpi');
  kpis[0].querySelector('.value').textContent = fmtBRL(revenue);
  kpis[0].querySelector('.sub').textContent = `${count} venda(s) nos últimos ${currentPeriod} dias`;
  kpis[1].querySelector('.value').textContent = fmtBRL(profit);
  kpis[1].querySelector('.sub').textContent = `Margem líquida ${margin.toFixed(1)}%`;
}

async function loadStock() {
  const { data } = await supabase.from('v_stock_summary').select('*').single();
  const kpis = document.querySelectorAll('#kpis .kpi');
  if (!data) return;
  kpis[2].querySelector('.value').textContent = fmtBRL(data.total_value_at_cost);
 kpis[2].querySelector('.sub').textContent = `${fmtNum(data.total_units)} un · a preço de venda: ${fmtBRL(data.total_value_at_sale)}`;
  kpis[3].querySelector('.value').textContent = fmtNum(data.low_stock_count);
  kpis[3].querySelector('.sub').textContent = data.low_stock_count > 0 ? 'Repor com urgência' : 'Tudo dentro do mínimo';
}

async function loadTop() {
  const { data } = await supabase.from('v_top_products_30d').select('*');
  const tbody = document.querySelector('#top-products tbody');
  if (!data?.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty">Nenhuma venda registrada ainda. Comece pelo módulo de Vendas.</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(p => `
    <tr><td>${esc(p.product_name)}</td><td class="num">${fmtNum(p.units_sold)}</td>
    <td class="num price-cell">${fmtBRL(p.revenue)}</td><td class="num margin-cell">${fmtBRL(p.gross_profit)}</td></tr>
  `).join('');
}

async function loadLow() {
  const { data } = await supabase
    .from('product_variants')
    .select('sku, flavor, size, stock_quantity, min_stock_alert, products(name)')
    .eq('active', true).gt('min_stock_alert', 0);
  const filtered = (data ?? []).filter(v => Number(v.stock_quantity) <= Number(v.min_stock_alert));
  const tbody = document.querySelector('#low-stock tbody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty">Nenhuma variante em alerta. Configure o "Mínimo" em cada variante.</td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map(v => `
    <tr><td>${esc(v.products.name)}</td>
    <td>${esc([v.flavor, v.size].filter(Boolean).join(' · ') || v.sku || '—')}</td>
    <td class="num" style="color: var(--danger); font-weight: 600;">${fmtNum(v.stock_quantity)}</td>
    <td class="num">${fmtNum(v.min_stock_alert)}</td></tr>
  `).join('');
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

loadSales(); loadStock(); loadTop(); loadLow();
