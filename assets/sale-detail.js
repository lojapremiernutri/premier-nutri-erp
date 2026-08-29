import { supabase } from './supabase.js';
import { requireAuth } from './auth.js';
import { renderShell } from './layout.js';

const session = await requireAuth();
if (!session) throw new Error('no session');
const root = renderShell({ active: 'sales', session });

const saleId = new URLSearchParams(location.search).get('id');
if (!saleId) location.href = 'sales.html';

const fmtBRL = n => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function load() {
  const { data: s, error } = await supabase.from('sales').select(`
    *, customers(name, phone), payment_methods(name, type),
    sale_items(*, product_variants(sku, flavor, size, products(name))),
    receivables(*)
  `).eq('id', saleId).single();
  if (error) { alert('Erro: ' + error.message); return; }
  render(s);
}

function render(s) {
  const items = s.sale_items ?? [];
  const receivables = (s.receivables ?? []).sort((a,b) => a.installment_number - b.installment_number);
  const paidCount = receivables.filter(r => r.status === 'recebido').length;
  const isCancelled = s.status === 'cancelada';
  const statusChip = isCancelled ? '<span class="chip inactive">cancelada</span>' : `<span class="chip active">${s.status}</span>`;

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1 style="display:flex; align-items:center; gap:12px;">Venda #${s.sale_number} ${statusChip}</h1>
        <div class="subtitle">${new Date(s.sold_at).toLocaleString('pt-BR')} · ${esc(s.customers?.name ?? 'Cliente esporádico')}</div>
      </div>
      <div class="actions">
        <a href="sales.html" style="text-decoration:none; padding:8px 14px; border-radius:6px; border:1px solid var(--border); color:var(--text);">← Voltar</a>
        ${!isCancelled ? '<button id="cancel-btn" class="secondary" style="border:1px solid var(--danger); color:var(--danger);">Cancelar venda</button>' : ''}
      </div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 340px; gap:16px; align-items:start;">
      <div>
        <div class="card">
          <div class="card-header"><h2>Itens</h2></div>
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Produto</th><th class="num">Qtd</th><th class="num">Preço</th><th class="num">Desc.</th><th class="num">Custo un.</th><th class="num">Subtotal</th><th class="num">Lucro</th></tr></thead>
              <tbody>
                ${items.map(it => {
                  const v = it.product_variants;
                  const name = [v.products?.name, v.flavor, v.size].filter(Boolean).join(' · ');
                  const profit = Number(it.total) - Number(it.total_cost);
                  return `<tr>
                    <td>${esc(name)}</td>
                    <td class="num">${it.quantity}</td>
                    <td class="num">${fmtBRL(it.unit_price)}</td>
                    <td class="num">${fmtBRL(it.discount)}</td>
                    <td class="num hint">${fmtBRL(it.unit_cost)}</td>
                    <td class="num price-cell">${fmtBRL(it.total)}</td>
                    <td class="num" style="color:${profit >= 0 ? 'var(--success)' : 'var(--danger)'}; font-weight:500;">${fmtBRL(profit)}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h2>Recebíveis</h2><span class="hint">${paidCount}/${receivables.length} recebido(s)</span></div>
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Parcela</th><th>Vencimento</th><th class="num">Valor bruto</th><th class="num">Taxa</th><th class="num">Líquido</th><th>Status</th></tr></thead>
              <tbody>
                ${receivables.length === 0 ? '<tr><td colspan="6" class="empty">Nenhum recebível.</td></tr>' :
                  receivables.map(r => `
                  <tr>
                    <td>${r.installment_number}</td>
                    <td>${new Date(r.due_date).toLocaleDateString('pt-BR')}</td>
                    <td class="num">${fmtBRL(r.gross_amount)}</td>
                    <td class="num hint">${fmtBRL(r.fee_amount)}</td>
                    <td class="num price-cell">${fmtBRL(r.net_amount)}</td>
                    <td>${r.status === 'recebido' ? '<span class="chip active">recebido</span>' : '<span class="chip inactive">pendente</span>'}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>

        ${s.notes ? `<div class="card"><div class="card-header"><h2>Observações</h2></div><div>${esc(s.notes)}</div></div>` : ''}
      </div>

      <div>
        <div class="card">
          <div class="card-header"><h2>Resumo</h2></div>
          <div class="sum-row"><span>Cliente</span><span>${esc(s.customers?.name ?? '—')}</span></div>
          <div class="sum-row"><span>Telefone</span><span>${esc(s.customers?.phone ?? '—')}</span></div>
          <div class="sum-row"><span>Pagamento</span><span>${esc(s.payment_methods?.name ?? '—')}${s.installments > 1 ? ` · ${s.installments}x` : ''}</span></div>
          <hr style="border:none; border-top:1px solid var(--border); margin:10px 0;">
          <div class="sum-row"><span>Subtotal</span><span>${fmtBRL(s.subtotal)}</span></div>
          <div class="sum-row"><span>Desconto</span><span>−${fmtBRL(s.discount)}</span></div>
          <div class="sum-row"><span>Entrega</span><span>${fmtBRL(s.delivery_fee)}</span></div>
          ${Number(s.card_fee) > 0 ? `<div class="sum-row hint"><span>Taxa cartão</span><span>${fmtBRL(s.card_fee)}</span></div>` : ''}
          <hr style="border:none; border-top:1px solid var(--border); margin:10px 0;">
          <div class="sum-row" style="font-size:16px; font-weight:600;"><span>Total</span><span style="color:var(--gold);">${fmtBRL(s.total)}</span></div>
          <div class="sum-row hint"><span>Custo total</span><span>${fmtBRL(s.total_cost)}</span></div>
          <div class="sum-row" style="font-weight:600; color:${Number(s.profit) >= 0 ? 'var(--success)' : 'var(--danger)'};"><span>Lucro</span><span>${fmtBRL(s.profit)}</span></div>
        </div>
      </div>
    </div>
  `;

  const btn = document.getElementById('cancel-btn');
  if (btn) btn.onclick = cancel;
}

async function cancel() {
  if (!confirm('Cancelar esta venda? O estoque será devolvido e os recebíveis pendentes serão removidos. Essa ação não pode ser desfeita.')) return;
  const { error } = await supabase.rpc('cancel_sale', { p_sale_id: saleId });
  if (error) { alert('Erro: ' + error.message); return; }
  load();
}

load();
