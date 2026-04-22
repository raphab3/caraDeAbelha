# Tasks - Epic 07: Cidade-Colmeia Compartilhada e Comercio Basico

Status: planned
Epic ID: EPIC-CDAM-07

## Task list

- [ ] `TASK-CDAM-07-01` Definir `zone:hive_city` como zona segura, sempre liberada e compartilhada, incluindo regras de respawn e reconexao.
- [ ] `TASK-CDAM-07-02` Adicionar NPCs vendedores fisicos com `vendorId`, `catalogId`, `zoneId` e posicao autoritativa no mundo.
- [ ] `TASK-CDAM-07-03` Modelar o catalogo inicial de comercio com pelo menos um consumivel e um upgrade permanente simples comprados com mel.
- [ ] `TASK-CDAM-07-04` Implementar a acao `purchase_vendor_item` no servidor com validacao de saldo, entrega do resultado e protecao contra compra duplicada.
- [ ] `TASK-CDAM-07-05` Expor para o client o catalogo minimo dos vendedores e o estado necessario para refletir saldo, compra e upgrades aplicados.
- [ ] `TASK-CDAM-07-06` Implementar a experiencia de interacao com vendedores no hub, incluindo CTA, feedback de compra e falha por mel insuficiente.
- [ ] `TASK-CDAM-07-07` Aplicar as regras de zona segura da cidade para negar coleta e outras acoes de progressao territorial dentro do hub.
- [ ] `TASK-CDAM-07-08` Validar com testes o fluxo de spawn na cidade, compra valida, compra invalida, persistencia apos reconexao e coexistencia de jogadores no hub.

## Definition of done

- a cidade-colmeia funciona como hub compartilhado e seguro
- o jogador retorna para a cidade em respawn e reconexao
- o mel passa a ter uso comercial basico e autoritativo no hub