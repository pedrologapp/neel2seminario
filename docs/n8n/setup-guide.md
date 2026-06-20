# Workflow n8n — Eventos Amadeus (novo sistema)

Este documento descreve **como montar o novo workflow do n8n** que integra com o sistema novo (`eventos.escolaamadeus.com`). É a versão simplificada do workflow antigo (41 nodes → ~17 nodes), usando o schema novo (`inscricoes` + `tickets`).

> Pré-requisito: rodar a migration `0004_tickets.sql` no Supabase.

---

## 🏗️ Arquitetura do novo workflow

São **2 webhooks** num mesmo workflow:

| Webhook | Path | Quem chama | O que faz |
|---|---|---|---|
| 1️⃣ Inscrição | `/webhook/eventosamadeus` | nosso site (`submitInscricao`) | Cria cobrança no Asaas, retorna `paymentUrl` |
| 2️⃣ Notificação Asaas | `/webhook/eventospagamentos` | Asaas (webhook config) | Gera tickets + envia QR + envia confirmação |

---

## 🔵 WORKFLOW 1 — Receber Inscrição

### Payload recebido (do nosso site)

```json
{
  "inscricaoId": "uuid-da-inscricao",
  "eventoId": "uuid",
  "eventoSlug": "festa-junina-2026",
  "event": "Festa Junina 2026",
  "studentName": "Maria Silva",
  "studentGrade": "3º Ano",
  "studentClass": "A",
  "parentName": "Ana Silva",
  "cpf": "12345678900",
  "email": "ana@example.com",
  "phone": "(84) 99999-9999",
  "paymentMethod": "pix",
  "installments": 1,
  "amount": 80.00,
  "senhasMae": 1,
  "senhasExtras": 0,
  "ticketQuantity": 1,
  "itens": [{ "tipo_id": "...", "nome": "Senha", "qtd": 1, "preco_unitario": 80 }],
  "timestamp": "2026-06-20T..."
}
```

### Resposta esperada (devolve pro nosso site)

```json
{ "paymentUrl": "https://www.asaas.com/c/...", "asaasPaymentId": "pay_..." }
```

### Nodes

#### 1. Webhook: Receber Inscrição

| Parâmetro | Valor |
|---|---|
| Type | `n8n-nodes-base.webhook` |
| HTTP Method | `POST` |
| Path | `eventosamadeus` |
| Respond | `Using 'Respond to Webhook' Node` |

#### 2. Code: Sanitizar e validar

Cole no campo "JavaScript Code":

```js
const data = $input.first().json.body;

// Sanitiza telefone pro formato WAHA (55DDDNNNNNNNN@c.us, sem o 9 extra)
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

// externalReference é o que o Asaas devolve nas notificações — vamos
// embutir o inscricaoId pra correlação no Workflow 2
return [{ json: {
  ...data,
  phone_clean: tel,
  phone_waha: chatId,
  externalReference: data.inscricaoId,
}}];
```

#### 3. HTTP: Asaas - Criar/Buscar Cliente

| Parâmetro | Valor |
|---|---|
| Method | `POST` |
| URL | `https://www.asaas.com/api/v3/customers` |
| Headers | `Content-Type: application/json`, `access_token: SUA_API_KEY_ASAAS` |
| Body (JSON) | (ver abaixo) |

```json
{
  "name": "={{ $json.parentName }}",
  "cpfCnpj": "={{ $json.cpf.replace(/\\D/g, '') }}",
  "email": "={{ $json.email }}",
  "mobilePhone": "={{ $json.phone_clean }}",
  "externalReference": "={{ $json.inscricaoId }}"
}
```

> 💡 **Cliente duplicado**: o Asaas retorna o cliente existente se já tiver CPF cadastrado. Não precisa lógica extra.

#### 4. Switch: PIX ou Cartão?

| Parâmetro | Valor |
|---|---|
| Mode | `Rules` |
| Output 0 (PIX) | `{{ $json.paymentMethod }}` equals `pix` |
| Output 1 (Cartão) | `{{ $json.paymentMethod }}` equals `credit` |

#### 5A. HTTP: Asaas Cobrança PIX

| Parâmetro | Valor |
|---|---|
| URL | `https://www.asaas.com/api/v3/payments` |
| Headers | (mesmos do node 3) |
| Body | (ver abaixo) |

```json
{
  "customer": "={{ $json.id }}",
  "billingType": "PIX",
  "value": "={{ $('Code').item.json.amount }}",
  "dueDate": "={{ new Date(Date.now() + 86400000).toISOString().slice(0, 10) }}",
  "externalReference": "={{ $('Code').item.json.inscricaoId }}",
  "description": "={{ $('Code').item.json.event }} - {{ $('Code').item.json.studentName }}"
}
```

> ⚠️ `$json.id` é o `customerId` retornado pelo node 3. Ajuste o nome do node `Code` se renomeou.

#### 5B. HTTP: Asaas Cobrança Cartão

Mesma coisa que 5A, mas com:

```json
{
  "customer": "={{ $json.id }}",
  "billingType": "CREDIT_CARD",
  "value": "={{ $('Code').item.json.amount }}",
  "dueDate": "={{ new Date(Date.now() + 86400000).toISOString().slice(0, 10) }}",
  "installmentCount": "={{ $('Code').item.json.installments }}",
  "installmentValue": "={{ ($('Code').item.json.amount / $('Code').item.json.installments).toFixed(2) }}",
  "externalReference": "={{ $('Code').item.json.inscricaoId }}",
  "description": "={{ $('Code').item.json.event }} - {{ $('Code').item.json.studentName }}"
}
```

#### 6. Merge

Combina as 2 branches (PIX e Cartão) numa só.

| Parâmetro | Valor |
|---|---|
| Mode | `Combine` |
| Combine By | `Append` |

#### 7. Code: Montar resposta

```js
const asaas = $input.first().json;
const inv = asaas.invoiceUrl || asaas.bankSlipUrl || '';
return [{ json: {
  paymentUrl: inv,
  asaasPaymentId: asaas.id,
  billingType: asaas.billingType,
}}];
```

#### 8. Respond to Webhook

| Parâmetro | Valor |
|---|---|
| Respond With | `JSON` |
| Response Body | `={{ $json }}` |

---

## 🟢 WORKFLOW 2 — Notificação Asaas

### Payload recebido (do Asaas)

```json
{
  "event": "PAYMENT_RECEIVED",
  "payment": {
    "id": "pay_...",
    "status": "RECEIVED",
    "billingType": "PIX",
    "value": 80.00,
    "customer": "cus_...",
    "externalReference": "uuid-da-inscricao",
    "installmentCount": 1,
    "installmentNumber": 1
  }
}
```

### Nodes

#### 1. Webhook1: Notificação Asaas

| Parâmetro | Valor |
|---|---|
| HTTP Method | `POST` |
| Path | `eventospagamentos` |

#### 2. Code: Validar notificação

```js
const data = $input.first().json.body;

const isValidPayment =
  ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(data?.event) &&
  ['RECEIVED', 'CONFIRMED'].includes(data?.payment?.status) &&
  data?.payment?.value > 0;

// Pra cartão parcelado, só processa a 1ª parcela
let shouldProcess = true;
if (data?.payment?.billingType === 'CREDIT_CARD') {
  const n = data?.payment?.installmentNumber || 1;
  shouldProcess = n === 1;
}

const inscricaoId = data?.payment?.externalReference;
if (!isValidPayment || !shouldProcess || !inscricaoId) {
  return [{ json: { skip: true, motivo: !isValidPayment ? 'evento inválido' : !shouldProcess ? 'parcela > 1' : 'sem inscricaoId' } }];
}

return [{ json: {
  inscricaoId,
  asaasPaymentId: data.payment.id,
  amount: data.payment.value,
  billingType: data.payment.billingType,
}}];
```

#### 3. If: Continuar?

| Parâmetro | Valor |
|---|---|
| Condition | `{{ $json.skip }}` **NOT EQUAL** `true` |

Se skip=true → vai pra Respond_Skip (terminal). Senão → continua.

#### 4. Supabase: Buscar Inscrição

| Parâmetro | Valor |
|---|---|
| Operation | `Get Many` (ou `Get`) |
| Table | `inscricoes` |
| Filter | `id = {{ $json.inscricaoId }}` |
| Limit | `1` |
| Return Fields | `id, evento_id, responsavel_nome, telefone, email, itens, aluno_id, valor_total` |

> Pra trazer dados do aluno e evento, melhor usar **Code** depois com 2 queries em paralelo, ou criar uma **view** no Supabase. Pra começar, faça 3 queries Supabase em sequência.

#### 5. Supabase: Buscar Evento

| Parâmetro | Valor |
|---|---|
| Operation | `Get` |
| Table | `eventos` |
| Filter | `id = {{ $('Supabase: Buscar Inscrição').item.json.evento_id }}` |
| Return Fields | `nome, data_evento, hora_evento, local, slug` |

#### 6. Supabase: Buscar Aluno

| Parâmetro | Valor |
|---|---|
| Operation | `Get` |
| Table | `alunos` |
| Filter | `id = {{ $('Supabase: Buscar Inscrição').item.json.aluno_id }}` |

#### 7. Code: Gerar tickets

```js
const inscricao = $('Supabase: Buscar Inscrição').item.json;
const evento = $('Supabase: Buscar Evento').item.json;
const aluno = $('Supabase: Buscar Aluno').item.json;

// Formata telefone WAHA
const formatPhone = (raw) => {
  let d = (raw || '').toString().replace(/\D/g, '');
  if (d.startsWith('55') && d.length > 11) d = d.substring(2);
  let ddd, num;
  if (d.length <= 9) { ddd = '84'; num = d; }
  else { ddd = d.substring(0, 2); num = d.substring(2); }
  if (num.length === 9 && num.startsWith('9')) num = num.substring(1);
  return `55${ddd}${num}@c.us`;
};

const phoneWaha = formatPhone(inscricao.telefone);

// Geração de token único
const eventoShort = evento.slug.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
const gerarToken = () => {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `AMZ-${eventoShort}-${ts}-${rnd}`;
};

// Loop pelos itens da inscrição, gera 1 ticket por senha
const tickets = [];
let ordemGlobal = 0;
for (const item of inscricao.itens) {
  for (let i = 0; i < item.qtd; i++) {
    ordemGlobal += 1;
    const token = gerarToken();
    tickets.push({
      inscricao_id: inscricao.id,
      evento_id: inscricao.evento_id,
      tipo_ingresso_id: item.tipo_id,
      nome_tipo: item.nome,
      preco_unitario: item.preco_unitario,
      ordem: ordemGlobal,
      token,
      // QR Code via API externa (não precisa de node especial)
      qr_url: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(token)}&size=500x500&margin=10`,
      aluno_nome: aluno?.nome_completo || null,
      // pro WAHA enviar:
      phone_waha: phoneWaha,
      // pra mensagem de texto consolidada:
      _evento_nome: evento.nome,
      _aluno_serie: aluno?.serie || '',
    });
  }
}

return tickets.map(t => ({ json: t }));
```

> 💡 **Importante**: este node retorna N items (1 por ticket). Os próximos nodes (WAHA, Insert) processam cada item separadamente.

#### 8. Supabase: Insert Tickets

| Parâmetro | Valor |
|---|---|
| Operation | `Create` |
| Table | `tickets` |
| Records to Send | Cada execução = 1 ticket |
| Fields | `inscricao_id, evento_id, tipo_ingresso_id, nome_tipo, preco_unitario, ordem, token, qr_url, aluno_nome` |

> Mapeia cada `fieldId` ao `$json.<campo>` correspondente.

#### 9. HTTP: Marcar pagamento como pago

| Parâmetro | Valor |
|---|---|
| Method | `POST` |
| URL | `https://eventos.escolaamadeus.com/api/inscricoes/confirmar` |
| Headers | `Content-Type: application/json`, `X-Webhook-Secret: 1d3321952567...` |
| Settings | **Execute Once** = ✅ (não fica chamando uma vez por ticket) |

```json
{
  "inscricaoId": "={{ $('Code: Gerar tickets').first().json.inscricao_id }}",
  "status": "pago",
  "asaasPaymentId": "={{ $('Code: Validar notificação').item.json.asaasPaymentId }}"
}
```

#### 10. WAHA: Enviar QR (1 por ticket)

| Parâmetro | Valor |
|---|---|
| Resource | `Chatting` |
| Operation | `Send Image` |
| Session | `amadeus` (ou o nome da sua sessão) |
| Chat ID | `={{ $json.phone_waha }}` |
| File URL | `={{ $json.qr_url }}` |
| Caption | `={{ "🎟️ Senha " + $json.ordem + " - " + $json.nome_tipo + "\\nCódigo: " + $json.token }}` |

> Este node executa N vezes (1 por ticket). O WAHA envia 1 mensagem por execução.

#### 11. HTTP: Marcar QR enviado

| Parâmetro | Valor |
|---|---|
| Method | `POST` |
| URL | `https://eventos.escolaamadeus.com/api/inscricoes/etapa` |
| Headers | `Content-Type: application/json`, `X-Webhook-Secret: 1d3321952567...` |
| Settings | **Execute Once** ✅ |

```json
{
  "inscricaoId": "={{ $('Code: Gerar tickets').first().json.inscricao_id }}",
  "etapa": "qrcode",
  "sucesso": true
}
```

#### 12. Code: Montar mensagem de confirmação

```js
const tickets = $('Code: Gerar tickets').all().map(i => i.json);
const t = tickets[0]; // dados gerais (todos têm os mesmos campos _evento_nome, phone_waha)

const total = tickets.length;
const lista = tickets
  .map(x => `• Senha ${x.ordem}: ${x.nome_tipo} (${x.token})`)
  .join('\n');

const texto = `🎉 *${t._evento_nome}*
Pagamento confirmado!

*Total de senhas:* ${total}
${lista}

Apresente os QR Codes na entrada do evento.
Obrigado por participar! 💙

— Escola Amadeus`;

return [{ json: {
  chatId: t.phone_waha,
  texto,
}}];
```

#### 13. WAHA: Enviar mensagem de confirmação

| Parâmetro | Valor |
|---|---|
| Resource | `Chatting` |
| Operation | `Send Text` |
| Session | `amadeus` |
| Chat ID | `={{ $json.chatId }}` |
| Text | `={{ $json.texto }}` |

#### 14. HTTP: Marcar confirmação enviada

| Parâmetro | Valor |
|---|---|
| Method | `POST` |
| URL | `https://eventos.escolaamadeus.com/api/inscricoes/etapa` |
| Headers | (mesmos) |

```json
{
  "inscricaoId": "={{ $('Code: Gerar tickets').first().json.inscricao_id }}",
  "etapa": "confirmacao",
  "sucesso": true
}
```

#### 15. Respond to Webhook

```json
{ "ok": true }
```

---

## ⚠️ Tratamento de erros (opcional)

Em cada node que pode falhar (WAHA, HTTP Asaas), ative:

**Settings → On Error → Continue (using error output)**

E adiciona, no caminho de erro, um HTTP Request pro nosso endpoint:

```json
{
  "inscricaoId": "...",
  "etapa": "qrcode",
  "sucesso": false,
  "erro": "={{ $json.error?.message || 'Falha no envio' }}"
}
```

---

## 🔐 Credenciais a configurar no n8n

1. **Asaas**: `access_token` header. Adicione como Credencial do tipo "Header Auth" ou cole direto no header de cada HTTP node.
2. **Supabase**: Project URL + Service Role Key. Crie uma Credential "Supabase API" e selecione nos nodes Supabase.
3. **WAHA**: já deve estar configurada se você usava antes.

---

## ✅ Checklist de migração

- [ ] Rodar `0004_tickets.sql` no Supabase
- [ ] Criar nova workflow no n8n
- [ ] Configurar 15 nodes seguindo este guia
- [ ] Configurar Asaas pra apontar webhook de notificações pra `/webhook/eventospagamentos`
- [ ] Atualizar `N8N_WEBHOOK_URL` no Vercel pro novo path (se mudou)
- [ ] Testar com uma inscrição real (PIX, valor baixo)
- [ ] Verificar que tickets foram criados em `tickets`
- [ ] Verificar que `inscricoes.status_pagamento = pago`
- [ ] Verificar que QR + texto chegaram no WhatsApp
- [ ] Verificar checks ✅ na coluna "Envios" do admin
