# Workflow n8n — Cobrança Avulsa

Venda de qualquer coisa fora de eventos (livro, material, taxa...). O admin cria
a cobrança em **/admin/cobrancas/nova**, o n8n gera o link no Asaas e envia pelo
WhatsApp. Quando o Asaas confirmar, o n8n manda só a mensagem de confirmação
(**sem QR codes** — não há tickets).

> Pré-requisitos:
> 1. Rodar a migration `0009_cobrancas_avulsas.sql` no Supabase.
> 2. Definir `N8N_COBRANCA_AVULSA_URL` no Vercel apontando pro webhook 1 abaixo.
>
> 🚀 **Atalho:** importe `docs/n8n/workflow-cobranca-avulsa.json` no n8n — ele já
> vem com todos os nodes abaixo montados, usando as credenciais WAHA/Supabase e o
> padrão "Check Sem 9 / Com 9" do workflow de eventos. Este guia fica como
> referência do que cada node faz.

---

## 🏗️ Arquitetura

São **2 webhooks** num workflow novo + **1 ajuste** no workflow de eventos:

| Webhook | Path | Quem chama | O que faz |
|---|---|---|---|
| 1️⃣ Criar cobrança | `/webhook/cobrancaavulsa` | nosso site (`criarCobrancaAvulsa`) | Cria cobrança no Asaas, envia link no WhatsApp, retorna `paymentUrl` |
| 2️⃣ Notificação Asaas | `/webhook/cobrancaavulsapagamentos` | Asaas | Envia confirmação no WhatsApp + marca como pago |

⚠️ O Asaas manda **todas** as notificações pra **todos** os webhooks cadastrados.
Por isso usamos o prefixo **`avulsa_`** no `externalReference`:
- O workflow de cobrança avulsa **só processa** referências que começam com `avulsa_`.
- O workflow de eventos precisa **pular** essas referências (ajuste no fim deste guia).

---

## 🔵 WEBHOOK 1 — Criar cobrança

### Payload recebido (do nosso site)

```json
{
  "cobrancaId": "uuid-da-cobranca",
  "externalReference": "avulsa_uuid-da-cobranca",
  "descricao": "Livro de matemática — 3º ano",
  "amount": 45.0,
  "valorTotal": 49.32,
  "paymentMethod": "credit",
  "installments": 3,
  "studentName": "Maria Silva",
  "studentGrade": "3º Ano",
  "studentClass": "A",
  "parentName": "Ana Silva",
  "cpf": "123.456.789-00",
  "phone": "(84) 99999-9999",
  "registradoPor": "admin@escolaamadeus.com",
  "timestamp": "2026-06-10T..."
}
```

### Resposta esperada (devolve pro nosso site)

```json
{ "paymentUrl": "https://www.asaas.com/c/...", "asaasPaymentId": "pay_...", "asaasCustomerId": "cus_..." }
```

### Nodes

#### 1. Webhook: Criar Cobrança Avulsa

| Parâmetro | Valor |
|---|---|
| HTTP Method | `POST` |
| Path | `cobrancaavulsa` |
| Respond | `Using 'Respond to Webhook' Node` |

#### 2. Code: Sanitizar

```js
const data = $input.first().json.body;

// Mesmo formatPhone do workflow de eventos (formato WAHA)
const formatPhone = (raw) => {
  let d = (raw || '').toString().replace(/\D/g, '');
  if (d.startsWith('55') && d.length > 11) d = d.substring(2);
  let ddd, num;
  if (d.length <= 9) { ddd = '84'; num = d; }
  else { ddd = d.substring(0, 2); num = d.substring(2); }
  if (num.length === 9 && num.startsWith('9')) num = num.substring(1);
  return { tel: `55${ddd}${num}`, chatId: `55${ddd}${num}@c.us` };
};

const { tel, chatId } = formatPhone(data.phone);

return [{ json: {
  ...data,
  cpf_clean: (data.cpf || '').replace(/\D/g, ''),
  phone_clean: tel,
  phone_waha: chatId,
}}];
```

#### 3. HTTP: Asaas - Criar/Buscar Cliente

| Parâmetro | Valor |
|---|---|
| Method | `POST` |
| URL | `https://www.asaas.com/api/v3/customers` |
| Headers | `Content-Type: application/json`, `access_token: SUA_API_KEY_ASAAS` |

```json
{
  "name": "={{ $json.parentName }}",
  "cpfCnpj": "={{ $json.cpf_clean }}",
  "mobilePhone": "={{ $json.phone_clean }}",
  "externalReference": "={{ $json.externalReference }}"
}
```

#### 4. Code: Montar Cobrança + HTTP: Asaas - Criar Cobrança

Um node Code monta o body conforme o `paymentMethod` vindo do site:

- `undefined` (link aberto) → `billingType: UNDEFINED` — fatura onde o
  responsável escolhe PIX ou cartão à vista; cobra `valorTotal` (= valor base).
- `pix` → `billingType: PIX`, cobra `valorTotal` (= valor base).
- `credit` → `billingType: CREDIT_CARD` com `installmentCount`/`installmentValue`
  (até 12x). `valorTotal` já vem com os juros repassados quando o admin escolheu
  "Com juros" no simulador; com "Sem juros" é o valor base (escola absorve).

O HTTP node envia `={{ JSON.stringify($json.asaas_body) }}`. Veja o código
exato no JSON importável.

| Parâmetro | Valor |
|---|---|
| Method | `POST` |
| URL | `https://www.asaas.com/api/v3/payments` |
| Headers | (mesmos do node 3) |

```json
{
  "customer": "={{ $json.id }}",
  "billingType": "UNDEFINED",
  "value": "={{ $('Code: Sanitizar').item.json.amount }}",
  "dueDate": "={{ new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) }}",
  "externalReference": "={{ $('Code: Sanitizar').item.json.externalReference }}",
  "description": "={{ $('Code: Sanitizar').item.json.descricao }} - {{ $('Code: Sanitizar').item.json.studentName }}"
}
```

> 💡 `dueDate` = 3 dias. Ajuste se quiser dar mais prazo.

#### 5. Code: Montar mensagem do link

```js
const d = $('Code: Sanitizar').item.json;
const asaas = $input.first().json;
const link = asaas.invoiceUrl || asaas.bankSlipUrl || '';

const valor = Number(d.amount).toLocaleString('pt-BR', {
  style: 'currency', currency: 'BRL',
});

const texto = `🧾 *Escola Amadeus*

Olá, ${d.parentName}!
Segue a cobrança referente a:

*${d.descricao}*
Aluno(a): ${d.studentName} (${d.studentGrade} · Turma ${d.studentClass})
Valor: *${valor}*

💳 Pague por PIX ou cartão no link:
${link}

Qualquer dúvida, fale com a secretaria. 💙`;

return [{ json: {
  chatId: d.phone_waha,
  texto,
  paymentUrl: link,
  asaasPaymentId: asaas.id,
  asaasCustomerId: asaas.customer,
}}];
```

#### 6. WAHA: Enviar link no WhatsApp

| Parâmetro | Valor |
|---|---|
| Resource | `Chatting` |
| Operation | `Send Text` |
| Session | `amadeus` |
| Chat ID | `={{ $json.chatId }}` |
| Text | `={{ $json.texto }}` |

#### 7. Respond to Webhook

| Parâmetro | Valor |
|---|---|
| Respond With | `JSON` |
| Response Body | (abaixo) |

```json
{
  "success": true,
  "paymentUrl": "={{ $('Code: Montar mensagem do link').item.json.paymentUrl }}",
  "asaasPaymentId": "={{ $('Code: Montar mensagem do link').item.json.asaasPaymentId }}",
  "asaasCustomerId": "={{ $('Code: Montar mensagem do link').item.json.asaasCustomerId }}"
}
```

---

## 🟢 WEBHOOK 2 — Notificação Asaas (confirmação)

Cadastre no Asaas (Configurações → Webhooks) um **segundo** webhook apontando pra
`/webhook/cobrancaavulsapagamentos`, com os mesmos eventos de pagamento do atual.

### Nodes

#### 1. Webhook: Notificação Cobrança Avulsa

| Parâmetro | Valor |
|---|---|
| HTTP Method | `POST` |
| Path | `cobrancaavulsapagamentos` |

#### 2. Code: Validar notificação avulsa

```js
const data = $input.first().json.body;

const isValidPayment =
  ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(data?.event) &&
  ['RECEIVED', 'CONFIRMED'].includes(data?.payment?.status) &&
  data?.payment?.value > 0;

const ref = data?.payment?.externalReference || '';

// Só processa cobranças avulsas (prefixo avulsa_)
if (!isValidPayment || !ref.startsWith('avulsa_')) {
  return [{ json: { skip: true } }];
}

return [{ json: {
  cobrancaId: ref.replace('avulsa_', ''),
  asaasPaymentId: data.payment.id,
  amount: data.payment.value,
}}];
```

#### 3. If: Continuar?

| Parâmetro | Valor |
|---|---|
| Condition | `{{ $json.skip }}` **NOT EQUAL** `true` |

Se skip=true → Respond `{ "ok": true, "skipped": true }` (terminal).

#### 4. Supabase: Buscar Cobrança

| Parâmetro | Valor |
|---|---|
| Operation | `Get Many` |
| Table | `cobrancas_avulsas` |
| Filter | `id = {{ $json.cobrancaId }}` |
| Limit | `1` |
| Return Fields | `id, descricao, valor, responsavel_nome, telefone, aluno_id` |

#### 5. HTTP: Marcar como pago

| Parâmetro | Valor |
|---|---|
| Method | `POST` |
| URL | `https://eventos.escolaamadeus.com/api/cobrancas/confirmar` |
| Headers | `Content-Type: application/json`, `X-Webhook-Secret: <WEBHOOK_CONFIRM_SECRET>` |

```json
{
  "cobrancaId": "={{ $('Code: Validar notificação avulsa').item.json.cobrancaId }}",
  "status": "pago",
  "asaasPaymentId": "={{ $('Code: Validar notificação avulsa').item.json.asaasPaymentId }}"
}
```

#### 6. Code: Montar confirmação

```js
const cobranca = $('Supabase: Buscar Cobrança').item.json;

const formatPhone = (raw) => {
  let d = (raw || '').toString().replace(/\D/g, '');
  if (d.startsWith('55') && d.length > 11) d = d.substring(2);
  let ddd, num;
  if (d.length <= 9) { ddd = '84'; num = d; }
  else { ddd = d.substring(0, 2); num = d.substring(2); }
  if (num.length === 9 && num.startsWith('9')) num = num.substring(1);
  return `55${ddd}${num}@c.us`;
};

const valor = Number(cobranca.valor).toLocaleString('pt-BR', {
  style: 'currency', currency: 'BRL',
});

const texto = `✅ *Pagamento confirmado!*

*${cobranca.descricao}*
Valor: ${valor}

Obrigado, ${cobranca.responsavel_nome}! 💙

— Escola Amadeus`;

return [{ json: {
  chatId: formatPhone(cobranca.telefone),
  texto,
}}];
```

#### 7. WAHA: Enviar confirmação

| Parâmetro | Valor |
|---|---|
| Resource | `Chatting` |
| Operation | `Send Text` |
| Session | `amadeus` |
| Chat ID | `={{ $json.chatId }}` |
| Text | `={{ $json.texto }}` |

#### 8. Respond to Webhook

```json
{ "ok": true }
```

---

## ✅ Workflow de eventos: NENHUM ajuste necessário

O node **"Notif: Validar"** do workflow de eventos atual (path
`eventospagamentos2026`) já só processa `externalReference` que seja **UUID
puro** (regex). Como a cobrança avulsa usa `avulsa_<uuid>`, ela cai no skip com
motivo "pagamento de outro sistema" — exatamente o comportamento desejado.

---

## ✅ Checklist

- [ ] Rodar `0009_cobrancas_avulsas.sql` e `0010_cobranca_avulsa_parcelamento.sql` no Supabase
- [ ] Importar `workflow-cobranca-avulsa.json` no n8n e **ativar**
- [ ] Cadastrar o 2º webhook no Asaas → `/webhook/cobrancaavulsapagamentos`
- [ ] Definir `N8N_COBRANCA_AVULSA_URL` no Vercel → `/webhook/cobrancaavulsa`
- [ ] Testar: criar cobrança de R$ 1 em /admin/cobrancas/nova
- [ ] Verificar link no WhatsApp, pagar, conferir confirmação + status "Pago" no admin
