# Pipeline de Stages Autorais - Epic 07

Status: active
Epic ID: EPIC-CDAM-07

## Objetivo

Definir como novos stages autorais devem ser produzidos, validados e ligados ao runtime atual sem voltar a depender do gerador inicial como fonte principal do mundo.

## Estado atual da pipeline

A pipeline ja esta operacional para a primeira fatia do mundo.

- o stage principal atual mora em `server/maps/map.json`
- o parser autoritativo fica em `server/internal/httpserver/world_map.go`
- o snapshot do stage e montado em `server/internal/httpserver/ws_world.go`
- a renderizacao de props ricos e landmarks acontece em `client/src/components/GameViewport/StagePropRenderer.tsx`
- a trilha ambiente por stage ja e consumida no client via `client/src/hooks/useStageBgm.ts`

## Contrato do arquivo de stage

O arquivo continua sendo JSON, mas o formato principal agora e um container com metadados de stage.

Campos suportados hoje:

- `stageId`: identificador estavel do stage
- `displayName`: nome legivel do stage
- `audio.bgm`: trilha ambiente principal do stage
- `edgeBehavior`: comportamento da borda autoritativa
- `tiles`: base de terreno ainda usada pelo runtime atual
- `props`: composicao rica via prefabs catalogados
- `zones`: zonas de progressao e leitura espacial
- `transitions`: transicoes entre zonas ou corredores de saida
- `landmarks`: pontos de orientacao visual e de worldbuilding

Exemplo minimo:

```json
{
  "stageId": "stage:starter-basin",
  "displayName": "Bacia do Primeiro Voo",
  "audio": {
    "bgm": "assets/rpg-adventure.mp3"
  },
  "edgeBehavior": {
    "type": "outlands_return_corridor",
    "playableBounds": { "x1": -45, "x2": 45, "z1": -45, "z2": 45 },
    "outlandsBounds": { "x1": -120, "x2": 120, "z1": -120, "z2": 120 }
  },
  "tiles": [],
  "props": [],
  "zones": [],
  "transitions": [],
  "landmarks": []
}
```

## Catalogo de prefabs

O catalogo autoritativo atual vive em `worldPrefabCatalog` dentro de `server/internal/httpserver/world_map.go`.

Cada prefab define:

- `ID`
- `AssetPath`
- `Category`
- `DefaultScale`
- `ColliderType`

Categorias atualmente cobertas:

- `terrain`
- `nature`
- `setdressing`
- `landmark`
- `border`

Regras atuais:

- todo `prefabId` precisa existir no catalogo do servidor
- `scale <= 0` cai para o `DefaultScale`
- `id` vazio e gerado automaticamente a partir do `prefabId` e da posicao quantizada
- o `client` nao decide catalogo; ele apenas renderiza `assetPath`, `category`, transform e landmark data vindos do snapshot

## Fluxo de producao de um novo stage

1. Duplicar a estrutura do stage atual ou criar um novo container seguindo o contrato acima.
2. Definir `stageId`, `displayName` e `audio.bgm`.
3. Desenhar `playableBounds` e `outlandsBounds` de acordo com o comportamento de borda desejado.
4. Construir o relevo base em `tiles` mantendo a jogabilidade do runtime atual.
5. Adicionar `props` em camadas: terreno grande, vegetacao, set dressing e borda.
6. Posicionar `landmarks` com nomes claros para orientar leitura espacial.
7. Revisar `zones` e `transitions` para que o stage continue compatível com progressao e futuras expansoes.
8. Validar no servidor que o parser aceita o stage e que o snapshot o expoe corretamente.
9. Validar no client que props, landmarks e audio entram sem quebrar a cena nem empurrar estado rapido para React state.

## Regras para composicao de props

- usar `tiles` para forma jogavel base e elevacao simples que o runtime atual entende bem
- usar `props` para vender leitura de mundo: falhas, pinheiros, flores, rochas, cercas, placas e marcos de borda
- evitar espalhar props como ruido uniforme; agrupar por funcao de cena
- preferir landmarks que ajudem navegacao antes de texto explicativo na HUD
- toda composicao nova deve continuar coerente com `zones` e com a fantasia do corredor de retorno

## Regras para borda

O modo ativo hoje e `outlands_return_corridor`.

Comportamento esperado:

- o jogador pode sair do `playableBounds` e circular no `outlandsBounds`
- o runtime ainda clampa ao limite externo do outlands
- quando o jogador volta do vazio para o mundo util, a volta e comprimida pelo remapeamento autoritativo de posicao
- o vazio nao deve virar fonte central de recompensa ou coleta relevante

## Snapshot e renderizacao

O servidor expõe no `worldStateMessage`:

- `stageId`
- `stageName`
- `audioBgm`
- `props`
- `landmarks`

O client consome isso em:

- `client/src/hooks/useGameSession.ts`
- `client/src/components/GameViewport/InstancedWorldField.tsx`
- `client/src/components/GameViewport/StagePropRenderer.tsx`
- `client/src/hooks/useStageBgm.ts`

Regra importante:

- metadados lentos de stage podem entrar no estado React da sessao
- estado rapido de movimento, coleta e animacao continua fora de loops de sincronizacao desnecessarios

## Checklist de validacao para um novo stage

Servidor:

- parser aceita o arquivo sem quebrar compatibilidade
- `prefabId` invalido falha cedo
- `stageId`, `audio`, `edgeBehavior`, `props` e `landmarks` saem no snapshot
- retorno comprimido continua funcional

Client:

- build passa
- props aparecem no viewport sem desalinhamento de escala e yaw
- landmarks ficam legiveis e uteis para navegacao
- audio do stage toca e pode ser mutado
- minimapa, coleta e movimento continuam ativos

## Proximo fechamento do epic

A pipeline ja esta documentada e operacional. O passo que ainda falta para encerrar o Epic 07 e a validacao final cruzada do novo stage em `TASK-CDAM-07-07`, cobrindo:

- coleta
- zonas
- movimento
- minimapa
- multiplayer

Depois disso, o epic pode ser encerrado ou receber apenas uma passada final de densidade/verticalidade se a impressao do stage ainda estiver aquem da Definition of Done.
