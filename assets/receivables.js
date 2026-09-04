import { supabase } from './supabase.js';
import { requireAuth } from './auth.js';
import { renderShell } from './layout.js';

const session = await requireAuth();
if (!session) throw new Error('no session');
const root = renderShell({ active: 'receivables', session });

const fmtBRL = n => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let tab = 'by-customer';

root.innerHTML = `
  <div class="page-header">
    <div><h1>Recebíveis</h1><div class="subtitle">Fiado, cartão e o que está em aberto</div></div>
  </div>
  <div class="kpi-grid" id="kpis">
    <div class="kpi warning"><div class="label">Total a receber</div><div class="value" id="k-total">R$ —</div><div class="sub">tudo pendente</div></div>
    <div class="kpi danger-kpi"><div class="label">Vencido</div><div class="value" id="k-overdue">R$ —</div><div class="sub" id="k-overdue-sub">—</div></div>
    <div class="kpi"><div class="label">Vence em 7 dias</div><div class="value" id="k-soon">R$ —</div><div class="sub">próximos vencimentos</div></div>
    <div class="kpi success"><div class="label">Recebido este mês</div><div class="value" id="k-received">R$ —</div><div class="sub">já caiu no caixa</div></div>
  </div>

  <div class="card">
    <div class="card-header">
      <div class="pill-tabs" id="tabs">
        <button data-t="by-customer" class="active">Por cliente</button>
        <button data-t="all">Todos os lançamentos</button>
      </div>
    </div>
    <div id="content"></div>
  </div>
`;

document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('#tabs button').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  tab = b.dataset.t;
  renderContent();
});

async function loadKpis() {
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const { data: pending } = await supabase.from('receivables').select('net_amount, due_date').eq('status', 'pendente');
  const { data: received } = await supabase.from('receivables').select('net_amount, received_at').eq('status', 'recebido').gte('received_at', monthStart);

  const total = (pending ?? []).reduce((s, r) => s + Number(r.net_amount), 0);
  const overdue = (pending ?? []).filter(r => r.due_date < today);
  const overdueSum = overdue.reduce((s, r) => s + Number(r.net_amount), 0);
  const soon = (pending ?? []).filter(r => r.due_date >= today && r.due_date <= in7).reduce((s, r) => s + Number(r.net_amount), 0);
  const receivedSum = (received ?? []).reduce((s, r) => s + Number(r.net_amount), 0);

  document.getElementById('k-total').textContent = fmtBRL(total);
  document.getElementById('k-overdue').textContent = fmtBRL(overdueSum);
  document.getElementById('k-overdue-sub').textContent = `${overdue.length} lançamento(s) vencido(s)`;
  document.getElementById('k-soon').textContent = fmtBRL(soon);
  document.getElementById('k-received').textContent = fmtBRL(receivedSum);
}

async function renderContent() {
  const el = document.getElementById('content');
  el.innerHTML = '<div class="empty">Carregando...</div>';
  if (tab === 'by-customer') await renderByCustomer(el);
  else await renderAll(el);
}

async function renderByCustomer(el) {
  const { data, error } = await supabase.from('v_customer_debts').select('*');
  if (error) { el.innerHTML = `<div class="error">Erro: ${error.message}</div>`; return; }
  if (!data.length) { el.innerHTML = `<div class="empty">Ninguém devendo no momento. 🎉</div>`; return; }
  const today = new Date().toISOString().slice(0, 10);
  el.innerHTML = `
    <div class="table-wrap">
      <table class="data">
        <thead><tr>
          <th>Cliente</th><th class="num">Lançamentos</th><th class="num">Total devido</th>
          <th>Vencimento + antigo</th><th></th>
        </tr></thead>
        <tbody>
          ${data.map(c => `
            <tr>
              <td>${esc(c.customer_name)}${c.customer_phone ? `<div class="hint">${esc(c.customer_phone)}</div>` : ''}</td>
              <td class="num">${c.open_count}</td>
              <td class="num price-cell" style="font-weight:600;">${fmtBRL(c.total_owed)}</td>
              <td>${fmtDate(c.oldest_due)} ${c.oldest_due < today ? '<span class="chip inactive" style="color:var(--danger);">vencido</span>' : ''}</td>
              <td style="white-space:nowrap;">
                <button class="small statement" data-id="${c.customer_id}" data-name="${esc(c.customer_name)}" data-phone="${esc(c.customer_phone ?? '')}">Informativo</button>
                <button class="small secondary settle" data-id="${c.customer_id}" data-name="${esc(c.customer_name)}">Quitar tudo</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  el.querySelectorAll('.statement').forEach(b => b.onclick = () => openStatement(b.dataset.id, b.dataset.name, b.dataset.phone));
  el.querySelectorAll('.settle').forEach(b => b.onclick = () => settleAll(b.dataset.id, b.dataset.name));
}

async function renderAll(el) {
  const { data, error } = await supabase.from('receivables')
    .select(`*, sales!inner(sale_number, status, customer_id, customers(name), payment_methods(name))`)
    .eq('status', 'pendente')
    .order('due_date');
  if (error) { el.innerHTML = `<div class="error">Erro: ${error.message}</div>`; return; }
  const rows = (data ?? []).filter(r => r.sales?.status !== 'cancelada');
  if (!rows.length) { el.innerHTML = `<div class="empty">Nenhum lançamento pendente.</div>`; return; }
  const today = new Date().toISOString().slice(0, 10);
  el.innerHTML = `
    <div class="table-wrap">
      <table class="data">
        <thead><tr>
          <th>Venda</th><th>Cliente</th><th>Pagamento</th><th>Vencimento</th>
          <th class="num">Valor</th><th></th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td>#${r.sales.sale_number}${r.installment_number > 1 || r.sales.payment_methods?.name?.includes('Crédito') ? ` <span class="hint">(${r.installment_number}ª)</span>` : ''}</td>
              <td>${esc(r.sales.customers?.name ?? 'Esporádico')}</td>
              <td>${esc(r.sales.payment_methods?.name ?? '—')}</td>
              <td>${fmtDate(r.due_date)} ${r.due_date < today ? '<span class="chip inactive" style="color:var(--danger);">vencido</span>' : ''}</td>
              <td class="num price-cell">${fmtBRL(r.net_amount)}</td>
              <td><button class="small pay" data-id="${r.id}">Marcar pago</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  el.querySelectorAll('.pay').forEach(b => b.onclick = async () => {
    b.disabled = true; b.textContent = '...';
    const { error } = await supabase.rpc('mark_receivable_paid', { p_receivable_id: b.dataset.id });
    if (error) { alert('Erro: ' + error.message); b.disabled = false; b.textContent = 'Marcar pago'; return; }
    await loadKpis(); renderContent();
  });
}

async function settleAll(customerId, name) {
  if (!confirm(`Marcar TODAS as pendências de ${name} como recebidas? Use isso quando o cliente pagar tudo.`)) return;
  const { error } = await supabase.rpc('settle_customer_debt', { p_customer_id: customerId });
  if (error) { alert('Erro: ' + error.message); return; }
  await loadKpis(); renderContent();
}

// ------- INFORMATIVO (modal) -------
async function openStatement(customerId, name, phone) {
  const { data, error } = await supabase.from('receivables')
    .select(`*, sales!inner(sale_number, sold_at, status, customer_id,
             sale_items(quantity, unit_price, product_variants(flavor, size, products(name))))`)
    .eq('status', 'pendente')
    .order('due_date');
  if (error) { alert('Erro: ' + error.message); return; }
  const rows = (data ?? []).filter(r => r.sales?.customer_id === customerId && r.sales?.status !== 'cancelada');
  const total = rows.reduce((s, r) => s + Number(r.net_amount), 0);

  // Monta texto pro WhatsApp
  const lines = [];
  lines.push(`*Premier Nutri — Extrato de compras*`);
  lines.push(`Cliente: ${name}`);
  lines.push(`Data: ${new Date().toLocaleDateString('pt-BR')}`);
  lines.push(``);
  rows.forEach(r => {
    const s = r.sales;
    const date = new Date(s.sold_at).toLocaleDateString('pt-BR');
    lines.push(`🧾 Pedido #${s.sale_number} — ${date}`);
    (s.sale_items ?? []).forEach(it => {
      const v = it.product_variants;
      const pname = [v.products?.name, v.flavor, v.size].filter(Boolean).join(' ');
      lines.push(`   ${it.quantity}x ${pname} — ${fmtBRL(it.unit_price)}`);
    });
    lines.push(`   Subtotal do pedido: ${fmtBRL(r.gross_amount)}`);
    lines.push(``);
  });
  lines.push(`*TOTAL EM ABERTO: ${fmtBRL(total)}*`);
  lines.push(``);
  lines.push(`Pode pagar via Pix. Qualquer dúvida, só chamar! 🙏`);
  const waText = lines.join('\n');

  // HTML visual do modal
  const htmlRows = rows.map(r => {
    const s = r.sales;
    const items = (s.sale_items ?? []).map(it => {
      const v = it.product_variants;
      const pname = [v.products?.name, v.flavor, v.size].filter(Boolean).join(' ');
      return `<div style="display:flex; justify-content:space-between; font-size:13px; padding:2px 0;">
        <span>${it.quantity}x ${esc(pname)}</span><span>${fmtBRL(it.unit_price)}</span></div>`;
    }).join('');
    return `
      <div style="border:1px solid var(--border); border-radius:8px; padding:12px; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; font-weight:600; margin-bottom:6px;">
          <span>Pedido #${s.sale_number}</span>
          <span class="hint">${new Date(s.sold_at).toLocaleDateString('pt-BR')}</span>
        </div>
        ${items}
        <div style="display:flex; justify-content:space-between; border-top:1px solid var(--border); margin-top:6px; padding-top:6px; font-weight:600;">
          <span>Subtotal</span><span class="price-cell">${fmtBRL(r.gross_amount)}</span>
        </div>
      </div>`;
  }).join('');

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:1000; padding:20px;';
  overlay.innerHTML = `
    <div class="card" style="max-width:520px; width:100%; max-height:85vh; overflow-y:auto; margin:0;">
      <div class="card-header">
        <h2>Informativo — ${esc(name)}</h2>
        <button class="secondary small close-x">✕</button>
      </div>
      <div>${htmlRows || '<div class="empty">Sem pendências.</div>'}</div>
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:18px; font-weight:700; margin:12px 0; padding:12px; background:var(--bg-2); border-radius:8px;">
        <span>Total em aberto</span><span style="color:var(--gold);">${fmtBRL(total)}</span>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        ${phone ? `<button class="wa-btn" style="flex:1; background:#25D366; color:#052e16;">Enviar no WhatsApp</button>` : ''}
        <button class="secondary copy-btn" style="flex:1;">Copiar texto</button>
      </div>
      <div class="hint copy-ok" style="display:none; margin-top:8px; color:var(--success);">Copiado!</div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('.close-x').onclick = () => overlay.remove();
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  const waBtn = overlay.querySelector('.wa-btn');
  if (waBtn) waBtn.onclick = () => {
    const cleanPhone = phone.replace(/\D/g, '');
    const withCountry = cleanPhone.length <= 11 ? '55' + cleanPhone : cleanPhone;
    window.open(`https://wa.me/${withCountry}?text=${encodeURIComponent(waText)}`, '_blank');
  };
  overlay.querySelector('.copy-btn').onclick = async () => {
    await navigator.clipboard.writeText(waText);
    overlay.querySelector('.copy-ok').style.display = 'block';
  };
}

loadKpis();
renderContent();
