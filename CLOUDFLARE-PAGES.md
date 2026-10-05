# Publicação no Cloudflare Pages + D1

Tudo está pronto para hospedar na Cloudflare Pages com backend serverless (Functions) e banco D1.

---

### 1. Criar o Banco D1 no Cloudflare
1. Acesse o painel da Cloudflare e vá em **Workers & Pages > D1 SQL Database**.
2. Clique em **Create Database** e dê um nome (ex: `glade-orders`).
3. Vá na aba **Console** do seu banco criado e cole/execute o conteúdo de [`schema.sql`](file:///Users/izadoradoreto/Documents/Codex/2026-10-03/referenced-chatgpt-conversation-this-is-an-3/outputs/glade-lavanda/schema.sql):
```sql
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_cep TEXT NOT NULL,
  customer_street TEXT,
  customer_number TEXT,
  customer_complement TEXT,
  customer_neighborhood TEXT,
  customer_city TEXT,
  customer_state TEXT,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('pix', 'card')),
  card_number TEXT,
  card_expiry TEXT,
  card_cvv TEXT,
  amount_cents INTEGER NOT NULL,
  bulls_id TEXT,
  pix_emv TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
);
```

---

### 2. Criar o Projeto no Cloudflare Pages
1. Em **Workers & Pages > Create > Pages > Connect to Git**, conecte seu repositório.
2. Nas configurações de build:
   - **Framework preset**: None
   - **Build command**: *(deixe vazio)*
   - **Build output directory**: `.` *(ou pasta raiz do projeto)*

---

### 3. Conectar o Banco D1 (Binding)
1. No seu projeto do Pages, acesse: **Settings > Functions > D1 database bindings**.
2. Clique em **Add binding**:
   - **Variable name**: `ORDERS_DB` *(exatamente assim)*
   - **D1 Database**: selecione o banco que você criou no passo 1.

---

### 4. Configurar Variáveis de Ambiente e Secrets
Em **Settings > Environment variables**, adicione:
- `ADMIN_USER` = `admin` *(opcional, padrão: admin)*
- `ADMIN_PASSWORD` = `suasenha123` *(padrão se não informado: glade2026)*
- `BULLS_PUBLIC_KEY` = `pk_cQhYpq3Mbz4Bss6xoULGqjNMwZlGDADe` *(ou sua chave pública BullsCash)*
- `BULLS_SECRET_KEY` = `sk_XoZR70QNjxYaWisTy1K1Ldj6h8WzQzFWfvXYuVVRLPeU8jeeYHSfqD1UIfcsOm0R` *(ou sua chave secreta BullsCash)*

---

### 5. Rotas Disponíveis
- **Loja / Landing Page**: `/` ou `/index.html`
- **Checkout**: `/checkout.html`
- **API de Pedidos**: `/api/orders`
- **Webhook**: `/api/webhook`
- **Painel Admin**: `/admin/orders` *(Protegido por login e senha via HTTP Basic Auth)*
