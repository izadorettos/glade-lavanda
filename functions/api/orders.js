const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Dados inválidos.' }, 400); }
  if (['cardNumber', 'cardExpiry', 'cardCvv', 'cvv'].some(key => key in body)) {
    return json({ error: 'Dados sensíveis do cartão não são aceitos.' }, 400);
  }
  const customerName = String(body.customerName || '').trim();
  const customerEmail = String(body.customerEmail || '').trim();
  const customerCep = String(body.customerCep || '').replace(/\D/g, '');
  const paymentMethod = String(body.paymentMethod || '');
  const cardLast4 = body.cardLast4 ? String(body.cardLast4).replace(/\D/g, '').slice(-4) : null;
  if (!customerName || !/^\S+@\S+\.\S+$/.test(customerEmail) || customerCep.length !== 8 || !['pix', 'card'].includes(paymentMethod)) {
    return json({ error: 'Confira os dados do pedido.' }, 422);
  }
  if (!env.ORDERS_DB) return json({ error: 'Banco de pedidos ainda não foi conectado.' }, 503);
  const result = await env.ORDERS_DB.prepare(
    'INSERT INTO orders (created_at, customer_name, customer_email, customer_cep, payment_method, card_last4, amount_cents) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(new Date().toISOString(), customerName, customerEmail, customerCep, paymentMethod, cardLast4, 6990).run();
  return json({ orderId: result.meta.last_row_id }, 201);
}
