# Plano de design: portfólio minimalista com retrato interativo

Referência analisada: https://www.brianan.ca/ (capturado em 2026-11-02, Playwright + Chromium, 1440×900 e 390×844).
Objetivo: reproduzir a **linguagem visual e as técnicas de interação** da referência com código, arte e conteúdo próprios do Felipe. Não copiamos o código, os dados do retrato, as fotos nem os textos dela.

---

## 1. O que a referência faz (observado)

### 1.1 Estrutura

- **Home de uma tela só.** Grid de 2 colunas (`.95fr 1.05fr`, gap 72px), centralizado verticalmente. À esquerda, o retrato. À direita, o texto.
- **Coluna de texto:** nome (h1), uma linha de formação com link, bio curta, lista "Work", lista "Projects", link "More projects →".
- **Rodapé:** só links sociais em texto pequeno (Email, LinkedIn, GitHub…).
- **Subpáginas** (`/projects`, `/photography`) numa coluna estreita (max 680px), com "Back" no topo e o mesmo estilo de lista.
- `/projects` também mostra um **mapa de contribuições do GitHub** (heatmap em tons de verde-oliva).

### 1.2 Tokens visuais

| Token | Valor | Uso |
|---|---|---|
| `--background` | `#f5f3ed` | fundo creme quente, tema único (não tem modo escuro) |
| `--foreground` | `#252521` | texto e cor dos pontos do retrato |
| `--muted` | `#6b6a61` | bio, itens de lista, rodapé |
| `--line` | `#deddd4` | bordas de cards |
| sublinhado de link | `#b6b3a7` 1px, 2px abaixo | estado de repouso |
| card de preview | `#faf9f5`, raio 12px, sombra `0 12px 40px #25252114` | |

**Tipografia:** Geist (variável, 100–900), suavizada com antialiasing.

| Elemento | Tamanho | Peso | Detalhe |
|---|---|---|---|
| h1 (nome) | 42px (36px no mobile) | 500 | `letter-spacing: -1.8px`, line-height 1.15 |
| títulos de seção | 14px | 500 | |
| itens de lista | 13px (12px ≤1000px) | 400 | line-height 1.8; marcador `•` cinza de 8px |
| bio | 13px | 400 | line-height 1.85, max 385px, cor `--muted` |
| rodapé / "more" | 11–12px | 400 | |

**Layout:** `.site-shell` com max-width 1100px e padding 48px (32px ≤1000px, 28px ≤700px). Em ≤700px o grid vira uma coluna e o retrato fica com no máximo 280px, centralizado, acima do texto.

### 1.3 Microinterações

1. **Sublinhado de link:** linha cinza de 1px fixa (`::before`) mais uma linha da cor do texto (`::after`) que cresce da esquerda com `scaleX(0→1)` em 200ms no hover/foco.
2. **"More projects →":** a seta desliza 3px no hover.
3. **Card de preview de link:** ao passar o mouse ou focar num item de Work, aparece um card fixo de 280px à direita da lista: screenshot do site (160px de altura, `object-position: top`), domínio, título e descrição. Fade + `translateY(6px→0)` em 180ms. Em telas ≤1000px o card centraliza acima ou abaixo da seção. Fecha com Esc.
4. **Retrato em pontos que se desfaz** (seção 2).
5. **"Universo de fotos":** quando os pontos se dispersam, 6 fotos saem do centro (`scale(.05)` → posição, ângulo e tamanho definidos por variáveis CSS), com atraso de 35ms entre cada uma, easing `cubic-bezier(.16,1,.3,1)` em 850ms. Depois flutuam em loop (`photo-float`, 7–10s, alternate). Uma pílula "View Photography" aparece embaixo.
6. **Acessibilidade:** `prefers-reduced-motion` zera todas as transições. O retrato tem `role="img"` e `aria-label`. As fotos só ganham `tabIndex` quando expandidas. Esc fecha e devolve o foco. Em telas sem hover, as dicas ficam sempre visíveis.

---

## 2. Como funciona o retrato interativo

**Correção importante:** não é ASCII. É **meio-tom (halftone) com pontos**: círculos num grid regular, em que o tamanho e a opacidade de cada ponto codificam o tom. Dá para fazer uma variante ASCII de verdade com o mesmo motor (seção 2.5).

### 2.1 Dados (gerados offline, uma vez)

- Lista de **4.078 pontos** no formato `[coluna, linha, nível]`, embutida no bundle como JSON.
- Grid de cerca de 100×100 células (colunas 19–82, linhas 4–94). Cada célula vale 5 unidades num espaço de 500×500.
- `nível` vai de 0 a 31 (32 tons; a referência usa 1–29). Células claras demais são descartadas, e por isso o retrato não tem fundo.
- Os pontos são **agrupados por nível**: 32 grupos, cada um com raio e alfa próprios:
  - `t = nível / 31`
  - `raio = 0.65 + 1.65·t`
  - `alfa = 0.2 + 0.8·t`
- Cada ponto ganha dois parâmetros **pseudoaleatórios determinísticos** (sem `Math.random`, então o desenho é igual em toda carga):
  - `distância = 90 + (17·col + 31·lin) mod 60`: quanto o ponto voa
  - `curva = (7·col + 13·lin) mod 32 − 16`: desvio lateral do voo
- Posição em repouso: `x = 5·col + 2.5`, `y = 5·lin + 2.5`.

### 2.2 Renderização

- Um `<canvas>` quadrado de 160% do palco, deslocado −30%, para os pontos poderem voar para fora sem serem cortados. O espaço lógico é 800×800 e o retrato fica com offset de 150.
- **Nitidez em telas retina:** um `ResizeObserver` ajusta `canvas.width` para `largura CSS × min(devicePixelRatio, 2)` e aplica `setTransform(escala, …)`.
- **Desempenho:** um `beginPath()` + `fill()` **por nível** (32 chamadas de fill por quadro, não 4.078). Cada ponto é `moveTo + arc` no mesmo path, e o `globalAlpha` é definido por grupo.
- **Fallback sem JavaScript:** o HTML do servidor já traz um `<svg viewBox="0 0 800 800">` com 32 `<path>` (um por nível, com `opacity`), e o canvas o substitui depois de montado. Assim o retrato aparece antes da hidratação e nos crawlers.

### 2.3 Animação de dispersão

Estado: `u` (progresso de 0 a 1), `alvo` (0 ou 1), `foco` (ponto de origem da explosão, que segue o mouse), `mouse`.

A cada quadro (`requestAnimationFrame`):

1. `dt = min(agora − anterior, 40ms)`
2. O foco persegue o mouse: `foco += (mouse − foco) · min(1, dt/100)`
3. `u` anda em direção ao alvo com velocidade linear `dt/850` (cerca de 850ms para dispersar por completo)
4. Easing:
   - `e = smoothstep(u) = u²(3 − 2u)`
   - `fade = (1 − u)^1.4`
   - `arco = sin(e·π)`: a curva lateral é máxima no meio do voo
5. Para cada ponto, com `(dx, dy)` sendo a direção unitária do foco até o ponto:
   - `x' = 150 + x + dx·distância·e − dy·arco·curva`
   - `y' = 150 + y + dy·distância·e + dx·arco·curva`
   - O raio encolhe 25% (`raio·(1 − 0.25e)`) e o alfa é multiplicado por `fade`.
6. O loop **para sozinho** quando `u` chega ao alvo, sem rAF ocioso.

Gatilhos: `pointerenter` só com mouse (no toque fica estático), o foco do link do retrato, e `pointerleave` / Esc para voltar. Com `prefers-reduced-motion`, `u` salta direto para o alvo.

### 2.4 Como gerar os dados a partir de uma foto

Script offline de build (`scripts/portrait.mjs`, Node + `sharp`), rodado uma vez:

1. Foto do Felipe, de frente, com fundo removido (PNG com alfa).
2. Recortar o rosto num quadrado e redimensionar para 100×100 (uma amostra por célula).
3. Converter para tons de cinza e ajustar contraste e gama (curva levemente S para separar cabelo, pele e sombras).
4. `tom = 1 − luminância` (escuro vira ponto grande). Quantizar em 32 níveis.
5. Descartar células transparentes ou com nível abaixo de cerca de 1 (fundo e brilhos).
6. Gravar `src/data/portrait.json` com `[col, lin, nível]` e gerar o SVG de fallback.

Para chegar ao visual "cartoon" da referência: suavizar a foto (blur leve ou filtro de pôster) antes da amostragem e reforçar contornos (detecção de borda somada ao tom) para olhos, sobrancelhas e boca.

### 2.5 Variante ASCII (opcional)

O mesmo grid e a mesma animação, trocando o círculo por um caractere de uma rampa de densidade (`" .:-=+*#%@"`): `ctx.font = "<n>px JetBrains Mono"`, `fillText(rampa[nível], x', y')` agrupado por nível. A dispersão funciona igual. Fica mais "terminal" e menos "gravura".

---

## 3. Adaptação para o Felipe

### 3.1 Mapa de conteúdo

**Home (uma tela)**
- `Felipe Matheus` (h1)
- Linha: `Software Engineering at UnB`, com UnB como link
- Bio (curta, `--muted`):
  - *"I build, architect and ship software, with AI in the loop and users at the center."*
  - mais uma frase sobre Macronutri ou a Residência
- **Work**, cada item com card de preview:
  - Co-founder & CTO at **Macronutri**
  - AI Resident at **LabLivre × Instituto Eldorado**
  - Data Science & Analytics Intern at **CNI**
  - UX Designer & Research Assistant at **ITRAC (UnB)**
- **Projects:** links internos para os case studies, com card de preview mostrando o diagrama de cada um
  - Macronutri
  - Dossiê
  - Music Recommender
- `More →` leva a `/about`
- Rodapé: Email · LinkedIn · GitHub

**Subpáginas** (coluna de 680px, "Back" no topo):
- `/work/macronutri/`, `/work/dossie/`, `/work/music-recommender/`: os case studies atuais (Problem → Approach → Role → Outcome → Stack → Links), refeitos no estilo minimalista. Os diagramas SVG continuam, redesenhados em traço fino na paleta creme.
- `/about`:
  - experiência detalhada
  - decision log
  - pesquisa e ensino
  - skills
  - formação
  - mapa de contribuições do GitHub (opcional; ver a seção 5)

### 3.2 O que entra no lugar do "universo de fotos"

A referência mostra fotografia pessoal. O brief do Felipe não tem fotos, então a proposta é: ao dispersar, **3 a 6 cartões dos projetos** (diagramas renderizados como imagem, mais um screenshot do Macronutri com dados fictícios quando houver) saem do retrato com as mesmas variáveis CSS (`--x`, `--y`, `--angle`, `--size`, `--delay`) e a mesma flutuação. A pílula diz "View projects".

### 3.3 Tokens

Manter a paleta creme (§1.2) como **tema claro padrão**. Se o modo escuro continuar (estava no brief original), criar um par equivalente quente:

| Token | Claro | Escuro |
|---|---|---|
| `--background` | `#f5f3ed` | `#1b1a17` |
| `--foreground` | `#252521` | `#ecebe4` |
| `--muted` | `#6b6a61` | `#a3a196` |
| `--line` | `#deddd4` | `#34332e` |

No escuro, os pontos do retrato usam `--foreground`, e o canvas lê a cor do CSS a cada redesenho.

Fonte: **Geist** (licença OFL, via `@fontsource-variable/geist`, hospedada no próprio site). JetBrains Mono só se a variante ASCII for escolhida.

### 3.4 Componentes (Astro, sem React)

| Componente | Responsabilidade |
|---|---|
| `Portrait.astro` | SVG de fallback (renderizado no build a partir de `portrait.json`), `<canvas>` e o script do motor (cerca de 120 linhas de TypeScript puro); cartões flutuantes; pílula de dica |
| `LinkPreview.astro` | link inline + card fixo (imagem, domínio, título, descrição); posicionamento à direita da lista ou centralizado no mobile; Esc, foco e hover |
| `InlineLink.astro` | sublinhado de duas camadas |
| `ContributionGraph.astro` | heatmap gerado no build pela API GraphQL do GitHub (token só no CI), em verde-oliva |
| `Layout.astro` | `.site-shell` com max 1100px, rodapé social, metatags e OG (refazer o OG na paleta creme) |

### 3.5 Responsivo

- **>1000px:** 2 colunas, card de preview à direita.
- **701–1000px:** padding de 32px, listas em 12px, card centralizado.
- **≤700px:** 1 coluna, retrato com no máximo 280px no topo, h1 de 36px, dica "View projects" sempre visível (`hover: none`). Sem dispersão por toque, ou opcionalmente um toque no retrato alterna a dispersão.

### 3.6 Desempenho e acessibilidade

- O JSON do retrato tem cerca de 4k pontos (por volta de 40 KB, ou 10 KB com gzip). O canvas desenha 32 fills por quadro e o loop para quando a animação termina.
- SVG de fallback no HTML, para não haver conteúdo pulando na tela. Não repetir o erro da referência, que manda o path duas vezes (HTML + payload RSC, 589 KB); no Astro estático ele sai uma vez só.
- Contraste: `#6b6a61` sobre `#f5f3ed` dá cerca de 4,9:1 (passa AA para texto normal). O sublinhado `#b6b3a7` é decorativo.
- `prefers-reduced-motion`, foco visível, Esc, `aria-hidden` e `tabIndex` dinâmicos nos cartões, como na referência.

---

## 4. Ordem de implementação

1. Tokens, Geist e `Layout` (shell, rodapé, tema claro creme).
2. Home em uma tela com listas, `InlineLink` e "More →", ainda sem retrato.
3. `LinkPreview` com imagens de preview: screenshots dos sites públicos (CNI, LabLivre, UnB) e os diagramas dos projetos.
4. Script `scripts/portrait.mjs` e `portrait.json` (precisa da foto).
5. `Portrait.astro`: fallback SVG, canvas e motor de dispersão.
6. Cartões flutuantes de projeto e pílula.
7. Case studies e `/about` no estilo de coluna estreita; diagramas na paleta nova.
8. (Opcional) mapa de contribuições do GitHub e modo escuro.
9. Verificação: screenshots desktop/mobile, axe, `prefers-reduced-motion`, Lighthouse.

---

## 5. Decisões em aberto (do Felipe)

1. **Foto para o retrato.** Sem ela não há retrato (o brief diz que a foto vem depois). Até lá: deixar o espaço vazio, ou fazer um retrato provisório em pontos com outro motivo (o monograma "FM", ou o diagrama do Macronutri).
2. **Pontos (como a referência) ou ASCII de verdade** (§2.5).
3. **Tema:** só claro creme, como a referência, ou manter o modo escuro com o toggle do brief original.
4. **O que flutua na dispersão:** cartões de projetos (proposta) ou outra coisa.
5. **Densidade da home:** a referência é quase vazia. O conteúdo do brief (decision log, skills, pesquisa) iria para `/about` e para os case studies. Confirmar se isso basta para recrutadores.
6. **Mapa de contribuições do GitHub:** incluir? Precisa de um token do GitHub como secret no Actions, e mostra a atividade, inclusive a privada se essa opção estiver ligada no perfil.
