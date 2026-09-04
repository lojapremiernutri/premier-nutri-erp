import { doLogout } from './auth.js';

const NAV = [
  { label: 'Principal', items: [
    { key: 'dashboard', href: 'index.html', label: 'Dashboard', icon: ic('M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10') },
  ]},
  { label: 'Operações', items: [
    { key: 'products',  href: 'products.html',  label: 'Produtos', icon: ic('M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96L12 12.01l8.73-5.05 M12 22.08V12') },
    { key: 'stock',     href: 'stock.html',     label: 'Estoque',  icon: ic('M20 7l-8-4-8 4v10l8 4 8-4V7z M4 7l8 4 8-4 M12 11v10') },
    { key: 'sales',     href: 'sales.html',     label: 'Vendas',   icon: ic('M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z M3 6h18 M16 10a4 4 0 0 1-8 0') },
    { key: 'receivables', href: 'receivables.html', label: 'Recebíveis', icon: ic('M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4 M4 6v12c0 1.1.9 2 2 2h14v-4 M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z') },   
    { key: 'customers', href: 'customers.html', label: 'Clientes', icon: ic('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75') },
  ]},
  { label: 'Configurações', items: [
    { key: 'settings', href: 'settings.html', label: 'Ajustes', icon: ic('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z') },
  ]},
];

function ic(d) {
  const paths = d.split(' M').map((p, i) => i === 0 ? p : 'M' + p);
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths.map(p => `<path d="${p}"/>`).join('')}</svg>`;
}

export function renderShell({ active, session }) {
  document.body.innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <div class="brand">Premier Nutri<small>ERP interno</small></div>
        ${NAV.map(group => `
          <div class="nav-group">
            <div class="label">${group.label}</div>
            ${group.items.map(item => `
              <a class="nav-item ${item.key === active ? 'active' : ''}" href="${item.href}">
                <span class="icon">${item.icon}</span>
                <span>${item.label}</span>
              </a>
            `).join('')}
          </div>
        `).join('')}
        <div class="user-info">
          <div class="email">${session.user.email}</div>
          <button id="btn-logout" class="secondary small">Sair</button>
        </div>
      </aside>
      <main class="main" id="page-content"></main>
    </div>
  `;
  document.getElementById('btn-logout').onclick = doLogout;
  return document.getElementById('page-content');
}
