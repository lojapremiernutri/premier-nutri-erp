import { supabase } from './supabase.js';
import { requireAuth } from './auth.js';
import { renderShell } from './layout.js';

const session = await requireAuth();
if (!session) throw new Error('no session');
const root = renderShell({ active: 'sales', session });

let period = 30;
let statusFilter = 'all';

root.innerHTML = `
  <div class="page-header">
    <div><h1>Vendas</h1><div class="subtitle">Lançamento e histórico de pedidos</div></div>
    <div class="actions">
      <div class="pill-tabs" id="period-tabs">
        <button data-p="7">7d</button><button data-p="30" class="active">30d</button><button data-p="90">90d</button><button data-p="365">1a</button>
      </div>
      <a href="sale-new.html" style="text-decoration:none;"><button>+ Nova venda</button></a>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi"><div class="label">Vendas</div><div class="value" id="k-count">—</div><div class="sub" id="k-count-sub">no período</div></div>
    <div class="kpi gold"><div class="label">Faturamento</div><div class="value" id="k-revenue">R$ —</div><div class="sub" id="k-avg">Ticket médio —</div></div>
    <div class="kpi success"><div class="label">Lucro líquido</div><div class="value" id="k-profit">R$ —</div><div class="sub" id="k-margin">Margem —</div></div>
    <div class="kpi warning"><div class="label">Taxas de cartão</div><div class="value" id="k-fee">R$ —</div><div class="sub">deduzidas do lucro</div></div>
  </div>

  <div class="card">
    <div class="card-header">
      <div class="pill-tabs" id="status-tabs">
        <button data-s="all" class="active">Todas</button>
        <button data-s="confirmada">Confirmadas</button>
        <button data-s="entregue">Entregues</button>
        <button data-s="cancelada">Canceladas</button>
      </div>
    </div>
    <div class="table-wrap">
      <table class="data" id="sales-table">
        <thead><tr>
          <th>#</th><th>Data</th><th>Cliente</th><th class="num">Itens</th>
          <th class="num">Total</th><th class="num">Lucro</th><th>Status</th><th></th>
        </tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </div>
`;

document.querySelectorAll('#period-tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('#period-tabs button').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  period = parseInt(b.dataset.p);
  load();
});
document.querySelectorAll('#status-tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('#status-tabs button').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  statusFilter = b.dataset.s;
  load();
});

const fmtBRL = n => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = n => (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const fmtDate = s => new Date(s).toLocaleDateString('pt-BR');

async function load() {
  const since = new Date(Date.now() - period * 86400000).toISOString();
  let q = supabase.from('sales').select(`
    id, sale_number, sold_at, status, total, total_cost, card_fee, profit,
    customers(name), sale_items(id)
  `).gte('sold_at', since).order('sold_at', { ascending: false });
  if (statusFilter !== 'all') q = q.eq('status', statusFilter);
  const { data, error } = await q;
  if (error) { alert('Erro: ' + error.message); return; }
  renderKpis(data);
  renderTable(data);
}

function renderKpis(sales) {
  const active = sales.filter(s => s.status !== 'cancelada');
  const revenue = active.reduce((s, x) => s + Number(x.total), 0);
  const profit  = active.reduce((s, x) => s + Number(x.profit), 0);
  const fee     = active.reduce((s, x) => s + Number(x.card_fee), 0);
  const count = active.length;
  const avg = count > 0 ? revenue / count : 0;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  document.getElementById('k-count').textContent = fmtNum(count);
  document.getElementById('k-count-sub').textContent = `${sales.length - count} cancelada(s) no período`;
  document.getElementById('k-revenue').textContent = fmtBRL(revenue);
  document.getElementById('k-avg').textContent = `Ticket médio ${fmtBRL(avg)}`;
  document.getElementById('k-profit').textContent = fmtBRL(profit);
  document.getElementById('k-margin').textContent = `Margem ${margin.toFixed(1)}%`;
  document.getElementById('k-fee').textContent = fmtBRL(fee);
}

function renderTable(sales) {
  const tbody = document.querySelector('#sales-table tbody');
  if (!sales.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty">Nenhuma venda no período. Clique em "+ Nova venda" pra começar.</td></tr>`;
    return;
  }
  tbody.innerHTML = sales.map(s => `
    <tr>
      <td>#${s.sale_number}</td>
      <td>${fmtDate(s.sold_at)}</td>
      <td>${s.customers?.name ? esc(s.customers.name) : '<span class="hint">—</span>'}</td>
      <td class="num">${s.sale_items?.length ?? 0}</td>
      <td class="num price-cell">${fmtBRL(s.total)}</td>
      <td class="num" style="font-weight:500; color:${Number(s.profit) < 0 ? 'var(--danger)' : 'var(--success)'}">${fmtBRL(s.profit)}</td>
      <td>${statusChip(s.status)}</td>
      <td><a href="sale-detail.html?id=${s.id}" style="text-decoration:none; padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border); color: var(--text); font-size: 12px;">Ver</a></td>
    </tr>
  `).join('');
}

function statusChip(s) {
  if (s === 'cancelada') return '<span class="chip inactive">cancelada</span>';
  return '<span class="chip active">' + s + '</span>';
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
load();
