// Função do servidor: fala com o Mercado Pago usando o Access Token (que nunca vai pro navegador).
// Variáveis no Netlify: MP_ACCESS_TOKEN (Access Token de produção, APP_USR-...) e TESTE_SENHA (senha da página).
import { randomUUID, timingSafeEqual } from 'node:crypto';

const MP = 'https://api.mercadopago.com';
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const erro = (msg, status = 400) => json(status, { error: msg });

function senhaOk(s) {
  const certa = Buffer.from(process.env.TESTE_SENHA || ''), veio = Buffer.from(String(s || ''));
  return certa.length > 0 && certa.length === veio.length && timingSafeEqual(certa, veio);
}
async function mp(caminho, { method = 'GET', body } = {}) {
  const res = await fetch(`${MP}${caminho}`, {
    method, headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json', ...(method === 'POST' ? { 'X-Idempotency-Key': randomUUID() } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('Mercado Pago: ' + (j.message || j.error || res.status) + (j.cause?.[0]?.description ? ' (' + j.cause[0].description + ')' : ''));
  return j;
}
const resumo = p => ({
  id: p.id, status: p.status, detalhe: p.status_detail, valor: p.transaction_amount, liquido: p.transaction_details?.net_received_amount ?? null,
  taxas: (p.fee_details || []).reduce((t, f) => t + Number(f.amount || 0), 0), meio: p.payment_method_id, tipo: p.payment_type_id,
  criado: p.date_created, aprovado: p.date_approved, liberacao: p.money_release_date, liberado: p.money_release_status,
  pix: p.point_of_interaction?.transaction_data ? { qr: p.point_of_interaction.transaction_data.qr_code, img: p.point_of_interaction.transaction_data.qr_code_base64 } : null,
  expira: p.date_of_expiration, reembolsado: (p.refunds || []).length > 0 || p.status === 'refunded',
});

export default async (req) => {
  if (req.method !== 'POST') return erro('Use POST', 405);
  if (!process.env.MP_ACCESS_TOKEN) return erro('Falta cadastrar MP_ACCESS_TOKEN no Netlify', 503);
  if (!process.env.TESTE_SENHA) return erro('Falta cadastrar TESTE_SENHA no Netlify', 503);
  let b; try { b = await req.json(); } catch { return erro('Dados inválidos'); }
  if (!senhaOk(b.senha)) return erro('Senha errada', 401);
  const valor = Math.round(Number(b.valor) * 100) / 100;
  const id = String(b.id || '');
  try {
    if (b.op === 'entrar') return json(200, { ok: true });
    if (b.op === 'pix') {
      if (!(valor >= 0.01 && valor <= 1000)) return erro('Valor de R$ 0,01 a R$ 1.000');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(b.email || ''))) return erro('Digite o e-mail de quem vai pagar');
      const p = await mp('/v1/payments', { method: 'POST', body: {
        transaction_amount: valor, payment_method_id: 'pix', description: 'Teste de pagamento',
        payer: { email: String(b.email).trim() }, date_of_expiration: new Date(Date.now() + 30 * 60e3).toISOString(),
      } });
      return json(200, resumo(p));
    }
    if (b.op === 'pro') {
      if (!(valor >= 0.01 && valor <= 1000)) return erro('Valor de R$ 0,01 a R$ 1.000');
      const site = (process.env.URL || new URL(req.url).origin).replace(/\/$/, '');
      const pref = await mp('/checkout/preferences', { method: 'POST', body: {
        items: [{ id: 'teste', title: 'Teste de pagamento', quantity: 1, currency_id: 'BRL', unit_price: valor }],
        back_urls: { success: `${site}/`, pending: `${site}/`, failure: `${site}/` }, auto_return: 'approved',
      } });
      return json(200, { url: pref.init_point });
    }
    if (b.op === 'status') {
      if (!/^\d+$/.test(id)) return erro('Pagamento inválido');
      return json(200, resumo(await mp(`/v1/payments/${id}`)));
    }
    if (b.op === 'reembolsar') {
      if (!/^\d+$/.test(id)) return erro('Pagamento inválido');
      await mp(`/v1/payments/${id}/refunds`, { method: 'POST', body: {} });
      return json(200, resumo(await mp(`/v1/payments/${id}`)));
    }
    return erro('Ação inválida');
  } catch (e) { return erro(e.message, 502); }
};
