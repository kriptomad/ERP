# Filitech ERP — Progresso (kriptomad/ERP)

Automação contínua sem confirmação do usuário. Fonte: BIBLE + mega-prompt.

## Phase 2.0

### Infra / backbone
- [x] Monorepo, docker-compose, isolation multi-tenant
- [x] Schema core 3 TenantType + Loyalty + Personal + Accounting + PlatformAdmin
- [x] Seed planos/módulos

### Auth / billing
- [x] Onboard 3 tipos + LGPD
- [x] 2FA TOTP + backup codes
- [x] Dunning + Art.49 + webhooks
- [x] Asaas/Stripe tokenize services

### Operacional B2B
- [x] PDV sale + crediário + loyalty TX
- [x] Gaveta cega
- [x] WorkOrder + token 72h + feature gate
- [x] FEFO helper + product-batch service
- [x] Recipe/CMV/produção (lógica)
- [x] Cascos ledger (lógica)
- [x] Prescription/SNGPC flags (lógica)

### Contábil / Pessoal
- [x] Engagement + marketplace
- [x] Personal accounts/tx
- [x] Debt Avalanche/Snowball
- [x] Carnê-Leão sugestivo
- [x] Pluggy connect token

### Landing
- [x] 3 produtos + nichos + calculadora + login/cadastro 3 modos

### Ainda na fila (continua automático)
- [ ] Models ProductBatch/Recipe/Ledger no schema.prisma + migrate
- [ ] Focus NFe emit + eventos fiscais
- [ ] WhatsApp Cloud API templates
- [ ] PDV offline-first
- [ ] Painel admin UI
- [ ] ECD/ECF generators
- [ ] 12 nichos expandidos
- [ ] BullMQ workers reais
