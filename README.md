# Kit Glade Coleção Lavanda — Loja

Loja de produto único com integração de pagamento PIX via **BullsCash**.

## Rodar localmente

```bash
node server.js
# Acesse http://localhost:4173
```

**Requisito**: Node.js 22+

## Hospedagem (Railway.app)

1. Faça deploy deste repositório no [Railway](https://railway.app)
2. Defina a variável de ambiente `PORT` (Railway injeta automaticamente)
3. Pronto — o servidor inicia com `node server.js`

## Estrutura

| Arquivo | Descrição |
|---|---|
| `server.js` | Servidor HTTP + integração BullsCash + SQLite |
| `index.html` | Página de vendas |
| `checkout.html` | Página de checkout |
| `orders.db` | Banco SQLite (criado automaticamente) |
| `assets/` | Imagens e logos |

## Pagamentos

- **PIX**: gera cobrança real via API BullsCash e exibe o código copia-e-cola
- **Cartão**: salva os dados localmente e exibe mensagem de erro ao cliente

## Banco de dados

Consulte os pedidos com:
```bash
node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('./orders.db');console.table(db.prepare('SELECT * FROM orders ORDER BY id DESC').all())"
```
