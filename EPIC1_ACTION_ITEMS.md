# 🎯 EPIC 1 - ACTION ITEMS PARA COMPLETAR

**Status:** ⚠️ **60% Completo - 3 Actions Críticas Bloqueando Fechamento**

---

## 📋 RESUMO

| Item | Prioridade | Tempo | Status |
|------|-----------|-------|--------|
| Implementar `collect_flower` handler WebSocket | 🔴 CRÍTICO | 30 min | ❌ TODO |
| Implementar `deposit_pollen` handler WebSocket | 🔴 CRÍTICO | 30 min | ❌ TODO |
| Adicionar tipos de ação ao cliente | 🔴 CRÍTICO | 15 min | ❌ TODO |
| Integrar envio de ação nos renderers | 🔴 CRÍTICO | 30 min | ❌ TODO |
| Teste manual end-to-end | 🟡 IMPORTANTE | 1h | ⚠️ BLOQUEADO |

**Total:** 2.5 horas | **Criticidade:** BLOQUEADOR PARA FECHAR

---

## 🔴 ACTION 1: Implementar collect_flower Handler

**Arquivo:** `server/internal/httpserver/ws_connection.go`

**Localização:** Linhas 94-124 (switch case para tipos de ação)

**Código a Adicionar:**

```go
case "collect_flower":
    flowerId, ok := raw["flowerId"].(string)
    if !ok {
        ws.sendInteractionResult(ctx, "collect_flower", false, 0, "invalid flowerId")
        return
    }
    
    if flowerId == "" {
        ws.sendInteractionResult(ctx, "collect_flower", false, 0, "flowerId required")
        return
    }
    
    // Chamar serviço de coleta
    success, amount, reason := ws.gs.CollectFlowerPollen(ctx, flowerId)
    
    // Enviar feedback ao cliente
    ws.sendInteractionResult(ctx, "collect_flower", success, amount, reason)
    
    // Se bem-sucedido, enviar status atualizado
    if success {
        ws.sendPlayerStatus(ctx)
    }
```

**Checklist:**
- [ ] Adicionar case no switch
- [ ] Validar flowerId
- [ ] Chamar CollectFlowerPollen
- [ ] Enviar interactionResult feedback
- [ ] Enviar playerStatus se bem-sucedido
- [ ] Testar: curl com collect_flower action
- [ ] Verificar logs

**Evidência de Sucesso:**
```
WebSocket → collect_flower action
→ Backend executa coleta
→ Envia interaction_result { success: true, amount: 5 }
→ Envia player_status { pollenCarried: 5, ... }
→ Cliente atualiza HUD
```

---

## 🔴 ACTION 2: Implementar deposit_pollen Handler

**Arquivo:** `server/internal/httpserver/ws_connection.go`

**Localização:** Logo após collect_flower case

**Código a Adicionar:**

```go
case "deposit_pollen":
    hiveId, ok := raw["hiveId"].(string)
    if !ok {
        ws.sendInteractionResult(ctx, "deposit_pollen", false, 0, "invalid hiveId")
        return
    }
    
    if hiveId == "" {
        ws.sendInteractionResult(ctx, "deposit_pollen", false, 0, "hiveId required")
        return
    }
    
    // Chamar serviço de depósito
    success, amount, reason := ws.gs.DepositPollenToHoney(ctx, hiveId)
    
    // Enviar feedback ao cliente
    ws.sendInteractionResult(ctx, "deposit_pollen", success, amount, reason)
    
    // Se bem-sucedido, enviar status atualizado
    if success {
        ws.sendPlayerStatus(ctx)
    }
```

**Checklist:**
- [ ] Adicionar case no switch
- [ ] Validar hiveId
- [ ] Chamar DepositPollenToHoney
- [ ] Enviar interactionResult feedback
- [ ] Enviar playerStatus se bem-sucedido
- [ ] Testar: curl com deposit_pollen action
- [ ] Verificar conversão 10 pollen = 1 honey

**Evidência de Sucesso:**
```
WebSocket → deposit_pollen action
→ Backend executa depósito (50 pollen → 5 honey)
→ Envia interaction_result { success: true, amount: 5 }
→ Envia player_status { pollenCarried: 0, honey: 5, ... }
→ Cliente atualiza HUD
```

---

## 🔴 ACTION 3: Adicionar Tipos de Ação ao Cliente

**Arquivo:** `client/src/types/game.ts`

**Localização:** Próximo a `UnlockZoneAction` (linha ~160)

**Código a Adicionar:**

```typescript
export interface CollectFlowerAction {
  type: "collect_flower";
  flowerId: string;
}

export interface DepositAction {
  type: "deposit_pollen";
  hiveId: string;
}
```

**Modificar Union Type:**

```typescript
// ANTES:
export type ClientMessage = 
  | MoveAction 
  | MoveToAction 
  | RespawnAction 
  | UnlockZoneAction;

// DEPOIS:
export type ClientMessage = 
  | MoveAction 
  | MoveToAction 
  | RespawnAction 
  | UnlockZoneAction
  | CollectFlowerAction
  | DepositAction;
```

**Checklist:**
- [ ] Adicionar `CollectFlowerAction` interface
- [ ] Adicionar `DepositAction` interface
- [ ] Atualizar `ClientMessage` union type
- [ ] Executar `npm run build` - deve passar sem erros
- [ ] Verificar que TypeScript reconhece tipos novos

**Evidência de Sucesso:**
```
npm run build → ✅ OK (sem erros TypeScript)
```

---

## 🔴 ACTION 4: Integrar Envio de Ação em Renderers

### Parte A: FlowerRenderer

**Arquivo:** `client/src/components/GameViewport/FlowerRenderer.tsx`

**Localização:** Função `onFlowerClick` (linha ~39)

**Código Atual:**
```typescript
const onFlowerClick = (flowerId: string) => {
  console.log("Flower clicked:", flowerId);
};
```

**Código Novo:**
```typescript
const onFlowerClick = (flowerId: string) => {
  gameSessionController.sendAction({
    type: "collect_flower",
    flowerId
  });
};
```

**Checklist:**
- [ ] Importar `gameSessionController` se necessário
- [ ] Chamar `sendAction()` com tipo `collect_flower`
- [ ] Passar `flowerId` corretamente
- [ ] Testar em browser: clicar em flor → network tab deve mostrar WebSocket message

### Parte B: HiveRenderer

**Arquivo:** `client/src/components/GameViewport/HiveRenderer.tsx`

**Localização:** Função `onHiveClick` (linha ~39)

**Código Atual:**
```typescript
const onHiveClick = (hiveId: string) => {
  console.log("Hive clicked:", hiveId);
};
```

**Código Novo:**
```typescript
const onHiveClick = (hiveId: string) => {
  gameSessionController.sendAction({
    type: "deposit_pollen",
    hiveId
  });
};
```

**Checklist:**
- [ ] Importar `gameSessionController` se necessário
- [ ] Chamar `sendAction()` com tipo `deposit_pollen`
- [ ] Passar `hiveId` corretamente
- [ ] Testar em browser: clicar em colmeia → network tab deve mostrar WebSocket message

**Evidência de Sucesso (Ambos):**
```
Devtools → Network → WS
→ {"type":"collect_flower","flowerId":"..."}
→ {"type":"deposit_pollen","hiveId":"..."}
```

---

## 🟡 ACTION 5: Manual Testing End-to-End

**Quando:** Após completar Actions 1-4

**Duração:** 1 hora

**Ambiente:** Staging ou Local

### Desktop Test Script

1. **Setup:**
   - Abrir http://localhost:8080 (ou staging URL)
   - Abrir DevTools → Network → WS
   - Verificar HUD visível

2. **Test: Coleta de Pollen**
   - [ ] Observar inicial: HUD mostra "Pollen: 0/50"
   - [ ] Clicar em flor verde próxima
   - [ ] Verificar: Network mostra `collect_flower` action
   - [ ] Verificar: Backend responde com `interaction_result { success: true, amount: 5 }`
   - [ ] Verificar: HUD atualiza para "Pollen: 5/50"
   - [ ] Verificar: Feedback visual (toast ou notificação)
   - [ ] Repetir 5x até mochila cheia

3. **Test: Mochila Cheia**
   - [ ] Com "Pollen: 50/50", clicar em flor
   - [ ] Verificar: Backend responde com `interaction_result { success: false, reason: "Inventory full" }`
   - [ ] Verificar: HUD não muda
   - [ ] Verificar: Feedback visual de erro

4. **Test: Depósito de Pollen**
   - [ ] Com "Pollen: 50/50", entrar em colmeia (laranja)
   - [ ] Clicar em colmeia
   - [ ] Verificar: Network mostra `deposit_pollen` action
   - [ ] Verificar: Backend responde com `interaction_result { success: true, amount: 5 }`
   - [ ] Verificar: HUD atualiza para "Pollen: 0/50, Honey: 5"
   - [ ] Verificar: Feedback visual de sucesso

5. **Test: Sem Pollen**
   - [ ] Com "Pollen: 0", clicar em colmeia
   - [ ] Verificar: Backend responde com `success: false`
   - [ ] Verificar: HUD não muda

### Mobile Test Script

1. **Setup:**
   - Abrir em dispositivo mobile real OU simulate no DevTools (F12 → Device Toolbar)
   - Viewport 375x667 (iPhone)

2. **Test: Mesmos cenários que Desktop**
   - [ ] HUD responsivo
   - [ ] Touch events funcionam (não apenas click)
   - [ ] Feedback visual legível

### Teste de Sincronização

1. **Setup:**
   - Abrir 2 navegadores com jogo (ou 2 abas)
   - Browser A: Jogar normalmente

2. **Test:**
   - [ ] Browser A: Coletar pollen
   - [ ] Verificar: Browser A atualiza HUD
   - [ ] Verificar: Browser B também recebe update (se implementado broadcast)

---

## 📊 ORDEM DE EXECUÇÃO RECOMENDADA

```
1. Implementar collect_flower handler (30 min)
   ↓
2. Implementar deposit_pollen handler (30 min)
   ↓
3. Testar handlers com curl ou Postman (15 min)
   ↓
4. Adicionar tipos de ação no cliente (15 min)
   ↓
5. npm run build (5 min)
   ↓
6. Integrar envio nos renderers (30 min)
   ↓
7. Teste manual Desktop (30 min)
   ↓
8. Teste manual Mobile (30 min)
   ↓
9. Commit + Deploy v0.2.0 (15 min)
```

**Total: 3-4 horas**

---

## ✅ CRITÉRIO DE SUCESSO

Epic 1 pode fechar quando:

- ✅ `go test ./internal/gameplay/loopbase -v` → PASS (já atendido)
- ✅ `npm run build` → OK (já atendido)
- ✅ Clicar em flor → pollen atualiza no HUD
- ✅ Entrar em colmeia → honey atualiza no HUD
- ✅ Sem pollen → feedback de erro em colmeia
- ✅ Mochila cheia → feedback de erro ao coletar
- ✅ Teste em Desktop + Mobile

---

## 🚀 PÓS-COMPLETAR

Após fechar todos os action items:

1. Criar PR com todos os commits
2. Code review pelos 2 reviewers
3. Deploy para staging
4. QA full testing
5. Deploy para produção
6. Atualizar status no Jira: Epic 1 → DONE
7. Criar issues para melhorias futuras:
   - Animations ao coletar
   - Soundfx
   - Particle effects
   - Analytics

---

## 📝 Referências

- Teste completo: `VALIDATION_REPORT_EPIC1.md`
- Sumário: `EPIC1_VALIDATION_SUMMARY.txt`
- Backend tests: `server/internal/gameplay/loopbase/*_test.go`
- Protocol spec: `server/internal/httpserver/ws_messages.go`
- Client types: `client/src/types/game.ts`

---

**Próximo Update:** Quando todos os action items estiverem completos
