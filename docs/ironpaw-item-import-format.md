# Formato de importação de itens Ironpaw

Este documento descreve o JSON aceito pelo **Gerenciador de Conteúdo** do Lorekit. Ele foi escrito para servir de contrato para uma IA gerar vários itens genéricos de uma vez.

## Envelope do arquivo

O arquivo deve ser UTF-8, ter extensão `.json` e seguir este formato:

```json
{
  "format": "lorekit-ironpaw-items",
  "version": 1,
  "system": "ironpaw",
  "package": {
    "id": "pacote-exemplo-2026",
    "name": "Itens genéricos de exploração"
  },
  "items": [],
  "assets": []
}
```

`format`, `version` e `system` são obrigatórios. `package.id` e `package.name` identificam o conjunto compartilhado; quando o arquivo é produzido manualmente, use um identificador estável e legível. `items` é a lista de itens e `assets` é reservado para imagens incorporadas.

## Item

Cada objeto em `items` possui estes campos:

| Campo | Obrigatório | Tipo | Descrição |
|---|---:|---|---|
| `portableId` | sim | string | Identificador estável do item no compartilhamento. Deve ser único no arquivo. Use, por exemplo, `ironpaw.generic.corda-v1`. |
| `revision` | não | inteiro positivo | Revisão do conteúdo. Se omitido ou inválido, o Lorekit usa `1`. |
| `name` | sim | string | Nome exibido no catálogo e no inventário. |
| `description` | sim | string | Descrição conhecida pelo personagem. Pode ser vazia. |
| `concept` | não | string ou `null` | Conceito ou referência de design. |
| `definition` | sim | objeto | Regras e características do item, descritas abaixo. |

### Definição comum

```json
{
  "version": 1,
  "category": "common",
  "icon": "fa-solid fa-box",
  "color": "#60a5fa",
  "backgroundColor": "#172554",
  "tags": ["exploração", "viagem"],
  "rarity": "common",
  "stackable": true,
  "stackLimit": 10,
  "equipmentSlots": [],
  "unique": false,
  "uniqueBenefits": [],
  "uniqueCosts": [],
  "narrativeEffect": ""
}
```

Campos comuns:

- `version` deve ser `1`.
- `category` aceita `common`, `tool`, `consumable`, `weapon`, `protection` ou `wearable`.
- `icon` é uma classe Font Awesome, por exemplo `fa-solid fa-box`, `fa-solid fa-sword` ou `fa-solid fa-flask`.
- `color` é opcional e controla a cor do ícone/acento do item. Use `null` para a cor padrão ou hexadecimal de seis dígitos no formato `#RRGGBB`. A interface oferece a paleta do sistema e um seletor personalizado.
- `backgroundColor` é opcional e controla o fundo visual do item na prévia, mochila e espaços equipados. Use `null` para o fundo padrão ou hexadecimal `#RRGGBB`.
- `tags` é uma lista de textos curtos.
- `rarity` aceita `common`, `uncommon`, `rare`, `unique` ou `null`.
- `stackable` indica se unidades podem ser agrupadas; `stackLimit` deve ser inteiro positivo.
- `equipmentSlots` aceita qualquer combinação de `helmet`, `armor`, `pants`, `boots`, `gloves`, `accessory1`, `accessory2`, `accessory3`, `underwear`, `primary`, `secondary` e `reserve` (arco/arma reserva). `underwear` representa a roupa íntima inferior; os três slots `accessory` são independentes.
- `uniqueBenefits` e `uniqueCosts` são listas narrativas. Se `unique` for `true` e houver mais de dois benefícios, informe ao menos um custo, limitação ou consequência.
- `narrativeEffect` registra efeitos descritivos. Ele não altera atributos automaticamente.

### Campos por categoria

Armas (`category: "weapon"`):

```json
"weapon": {
  "properties": ["light", "reach"],
  "damageTypes": ["cutting"],
  "specialProperty": "Pode ser usada para aparar em uma cena apropriada.",
  "severity": "moderada",
  "hands": 1
}
```

`properties` aceita `light`, `heavy`, `reach`, `recoil` e `technical`. `damageTypes` aceita `cutting`, `piercing` e `blunt`. `hands` deve ser `1` ou `2`.

Proteções (`category: "protection"`):

```json
"protection": {
  "tier": "medium",
  "effects": "Protege o torso, mas reduz mobilidade em espaços apertados."
}
```

`tier` aceita `light` (+1 PR), `medium` (+2 PR) ou `heavy` (+3 PR). A contribuição é aplicada ao PR máximo quando o item está equipado no espaço `armor`.

Consumíveis (`category: "consumable"`):

```json
"consumable": {
  "subtype": "recovery",
  "effect": "Recupera uma pequena quantidade de CV conforme a cena.",
  "actionCost": 1
}
```

`subtype` aceita `recovery`, `offensive` ou `utility`. O uso consome uma ação e uma unidade; aplicação de CV, PR ou condições continua sendo manual nesta versão. `actionCost` é mantido como `1`.

Ferramentas podem preencher `toolPurpose`; itens vestíveis podem usar `equipmentSlots` e `narrativeEffect` sem exigir uma seção adicional.

## Exemplo com vários itens

O trecho abaixo pode ser usado como ponto de partida para gerar um pacote completo:

```json
{
  "format": "lorekit-ironpaw-items",
  "version": 1,
  "system": "ironpaw",
  "package": { "id": "ironpaw-basicos-v1", "name": "Básicos de exploração" },
  "items": [
    {
      "portableId": "ironpaw.generic.corda-v1",
      "revision": 1,
      "name": "Corda de cânhamo",
      "description": "Corda resistente para escalada e amarrações.",
      "concept": "Kit de viagem",
      "definition": {
        "version": 1, "category": "common", "icon": "fa-solid fa-link", "color": "#fb923c", "backgroundColor": "#451a03",
        "tags": ["viagem", "escalada"], "rarity": "common", "stackable": true, "stackLimit": 3,
        "equipmentSlots": [], "unique": false, "uniqueBenefits": [], "uniqueCosts": [],
        "narrativeEffect": "Concede vantagem narrativa quando uma corda é plausivelmente útil."
      }
    },
    {
      "portableId": "ironpaw.generic.espada-ferro-v1",
      "revision": 1,
      "name": "Espada de ferro",
      "description": "Lâmina simples de uma mão.",
      "definition": {
        "version": 1, "category": "weapon", "icon": "fa-solid fa-sword", "color": "#d4d4d8", "backgroundColor": "#27272a",
        "tags": ["arma", "corpo-a-corpo"], "rarity": "common", "stackable": false, "stackLimit": 1,
        "equipmentSlots": ["primary", "secondary"], "unique": false, "uniqueBenefits": [], "uniqueCosts": [],
        "weapon": { "properties": ["light"], "damageTypes": ["cutting"], "specialProperty": "", "severity": "", "hands": 1 }
      }
    },
    {
      "portableId": "ironpaw.generic.couraca-couro-v1",
      "revision": 1,
      "name": "Couraça de couro",
      "description": "Proteção leve para o torso.",
      "definition": {
        "version": 1, "category": "protection", "icon": "fa-solid fa-shield-halved", "color": "#a3e635", "backgroundColor": "#1a2e05",
        "tags": ["armadura"], "rarity": "common", "stackable": false, "stackLimit": 1,
        "equipmentSlots": ["armor"], "unique": false, "uniqueBenefits": [], "uniqueCosts": [],
        "protection": { "tier": "light", "effects": "Não impõe penalidade narrativa por si só." }
      }
    },
    {
      "portableId": "ironpaw.generic.pocao-cura-v1",
      "revision": 1,
      "name": "Poção de recuperação",
      "description": "Frasco que auxilia a recuperação após uma cena difícil.",
      "definition": {
        "version": 1, "category": "consumable", "icon": "fa-solid fa-flask", "color": "#fb7185", "backgroundColor": "#500724",
        "tags": ["cura", "poção"], "rarity": "uncommon", "stackable": true, "stackLimit": 5,
        "equipmentSlots": [], "unique": false, "uniqueBenefits": [], "uniqueCosts": [],
        "consumable": { "subtype": "recovery", "effect": "Recuperação manual de CV conforme a ficção.", "actionCost": 1 }
      }
    },
    {
      "portableId": "ironpaw.generic.lanterna-v1",
      "revision": 1,
      "name": "Lanterna coberta",
      "description": "Fonte de luz controlável para exploração.",
      "definition": {
        "version": 1, "category": "tool", "icon": "fa-solid fa-lightbulb", "color": "#facc15", "backgroundColor": "#422006",
        "tags": ["luz", "exploração"], "rarity": "common", "stackable": false, "stackLimit": 1,
        "equipmentSlots": ["reserve"], "unique": false, "uniqueBenefits": [], "uniqueCosts": [],
        "toolPurpose": "Iluminar uma área sem revelar imediatamente a posição do grupo."
      }
    }
  ],
  "assets": []
}
```

## Imagens e `assets`

Um recurso de imagem, quando necessário, tem esta forma:

```json
{
  "sha256": "64-caracteres-hexadecimais-do-arquivo",
  "mimeType": "image/png",
  "base64": "...",
  "width": 128,
  "height": 128
}
```

São aceitos PNG, JPEG e WebP. O hash deve ser SHA-256 em hexadecimal, sem duplicatas; o conteúdo deve ser base64 puro, sem prefixo `data:`, URL ou caminho de arquivo. Cada imagem pode ter até 2 MiB, o conjunto até 10 MiB e cada dimensão até 4096 px. A validação já existe, mas a aplicação de pacotes que contêm imagens aguarda o staging/recovery de assets; para importar agora, mantenha `assets: []`.

## Validação, conflitos e geração automática

- O pacote aceita até 500 itens e 20 MiB de JSON.
- `portableId` duplicado, versão diferente de `1`, categoria inválida ou definição incompatível rejeitam o pacote inteiro antes de qualquer alteração.
- Na prévia, itens iguais aparecem como **equivalentes**, itens novos como **novos** e o mesmo `portableId` com conteúdo diferente como **conflito**.
- Para conflitos, escolha **Atualizar conflitos** (`update`), **Manter locais** (`keep`) ou **Importar como cópia** (`copy`). A prévia é revalidada antes de salvar; se o catálogo mudou, valide o arquivo novamente.
- Para uma IA gerar muitos itens, crie um `portableId` determinístico por item, mantenha `revision: 1`, use `null` em opcionais ausentes, respeite os enums acima e mantenha efeitos narrativos separados de bônus automáticos. Retorne somente JSON válido dentro do envelope.