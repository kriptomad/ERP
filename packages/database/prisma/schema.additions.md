# Schema additions pending next migrate

Models a incorporar no schema.prisma (Cap. 4 / 5 / 22):

- ProductBatch (tenantId, productId, batchCode, quantity, expiresAt, blocked)
- Recipe + RecipeItem (BOM padaria)
- ProductionBatch (yield, losses)
- ReturnableContainerLedger (clientId, productId, quantityHeld)
- PrescriptionRecord (clientId, productId, retainedAt, sngpcStatus)
- PersonalDebt, PersonalBudget, PersonalBill, OpenFinanceConsent, NetWorthSnapshot
- AccountingTask, OfficialTaxDocument

Serviços abaixo já implementam a lógica; persistência completa na migrate seguinte.
