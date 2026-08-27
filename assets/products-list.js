import { supabase } from './supabase.js';
import { requireAuth, doLogout } from './auth.js';

const session = await requireAuth();
if (!session) throw new Error('no session');

document.getElementById('user-email').textContent = session.user.email;
document.getElementById('btn-logout').onclick = doLogout;

async function load() {
  const { data, error } = await supabase
    .from('products')
    .select(`
      id, name, brand, price, active,
      product_variants(id, sale_price, cost_price, active)
    `)
    .order('name');

  const container = document.getElementById('products');
  if (error) {
    container.innerHTML = `<div class="error">Erro: ${error.message}</div>`;
    return;
  }

  container.innerHTML = data.map(p => {
    const activeVariants = (p.product_variants || []).filter(v => v.active);
    const minPrice = activeVariants.length
      ? Math.min(...activeVariants.map(v => v.sale_price))
      : p.price ?? 0;
    return `
      <a class="product-card" href="product.html?id=${p.id}" style="text-decoration:none;color:inherit;display:block;">
        <h3>${escapeHtml(p.name)}</h3>
        <div class="hint">${escapeHtml(p.brand ?? '—')}</div>
        <div class="price" style="margin-top: 8px;">
          A partir de R$ ${minPrice.toFixed(2)}
        </div>
        <div class="hint" style="margin-top: 4px;">
          ${activeVariants.length} variante(s) ativa(s)
        </div>
      </a>
    `;
  }).join('') || '<p class="hint">Nenhum produto ainda.</p>';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

load();
