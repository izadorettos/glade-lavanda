export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Webhook inválido.' }, { status: 400 }); }
  const providerId = String(body.id || body.transaction_id || '');
  const status = String(body.status || body.payment_status || 'updated');
  if (providerId && env.ORDERS_DB) {
    await env.ORDERS_DB.prepare('UPDATE orders SET status = ? WHERE bulls_id = ?').bind(status, providerId).run();
  }
  return Response.json({ ok: true });
}
