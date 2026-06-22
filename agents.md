# agents.md — Regras e Padrões Oficiais do MentorIA

> Este documento é a **fonte de verdade** para qualquer pessoa (humana ou agente de IA) que contribua com o projeto. Toda implementação, refatoração, code review ou geração de código deve respeitar o que está aqui. Se algo neste arquivo conflita com uma sugestão de fora, **este arquivo vence**.

---

## 1. Visão Geral do Projeto

**MentorIA** é uma plataforma educacional de tecnologia conduzida por um Mentor de IA. O usuário descreve um tema que deseja aprender e o Mentor gera uma **trilha de aprendizado** estruturada como um conjunto de **tickets estilo Jira**, simulando um projeto real de mercado conduzido por um Staff Software Engineer.

A voz do produto é a do **Mentor**: textos da interface e mensagens ao usuário se referem ao "Mentor" (não à "IA"). Internamente, a camada técnica continua sendo um `AIProvider` abstrato — "IA" permanece nos comentários de código, nomes de classes e nesta documentação de arquitetura.

A proposta pedagógica é **aprender construindo**: cada ticket carrega contexto técnico profundo, decisões de design, conceitos fundamentais e entregáveis incrementais.

---

## 2. Objetivos Técnicos e de Produto

### Produto
- Permitir cadastro, autenticação e gerenciamento completo de conta.
- Permitir criar, listar, abrir, editar, regenerar e excluir trilhas de aprendizado.
- Garantir uma experiência minimalista, focada em leitura e progressão.
- Entregar trilhas com qualidade pedagógica consistente, sempre seguindo a metodologia obrigatória.

### Técnico
- Arquitetura modular, testável e sustentável.
- Forte separação entre frontend e backend.
- Camadas bem definidas no backend (API / Service / Repository).
- Abstração de IA para permitir trocar provedor sem reescrita.
- Persistência inicialmente em SQLite, **preparada para PostgreSQL** sem refatoração estrutural.
- TDD obrigatório.
- GitFlow obrigatório.

---

## 3. Stack Oficial

| Camada | Tecnologia | Versão alvo |
|---|---|---|
| Frontend | React + TypeScript + Vite | React 18+, TS 5+ |
| Roteamento | React Router | 6+ |
| Estilo | CSS Modules + Design Tokens (CSS variables) | — |
| Testes frontend | Vitest + React Testing Library + jsdom | últimos estáveis |
| Backend | Python + FastAPI | Python 3.11+, FastAPI 0.110+ |
| Validação | Pydantic | v2 |
| ORM | SQLAlchemy 2.x (estilo declarativo) | 2.0+ |
| Migrations | Alembic | 1.13+ |
| Banco inicial | SQLite | 3 |
| Banco futuro | PostgreSQL | 15+ |
| Auth | JWT (HS256) + bcrypt (passlib) | — |
| Testes backend | pytest + httpx | — |
| IA | **Abacus AI** (provider abstraído) | API REST |

Mudanças de stack só são aceitas via PR específico de RFC documentado neste arquivo.

---

## 4. Padrões Arquiteturais

### Backend — Arquitetura em Camadas
```
Request → API Router (FastAPI) → Service → Repository → Model (SQLAlchemy) → DB
                                  │
                                  └── AIProvider (Abacus)
```

- **API Router**: validação de entrada/saída via Pydantic, autenticação, mapeamento HTTP. **Sem regra de negócio.**
- **Service**: orquestra regra de negócio. Não conhece HTTP. Não conhece SQL.
- **Repository**: única camada que conhece o ORM. Recebe/retorna entidades de domínio (modelos SQLAlchemy).
- **AIProvider**: interface (`AIProvider` abstrato) com implementação `AbacusAIProvider`. Permite trocar de fornecedor sem alterar service.

### Frontend — Arquitetura por Domínio
```
pages/ → componentes específicos da rota
components/ui/ → primitivos reutilizáveis (Button, Input, Card...)
components/layout/ → estrutura de página
hooks/ → lógica reutilizável
api/ → cliente HTTP e funções por recurso
contexts/ → estado global mínimo (auth)
```

- A camada `api/` é a **única** que conhece detalhes do backend.
- `hooks/` consomem `api/` e expõem estado pronto para o componente.
- Componentes em `pages/` orquestram, não fazem fetch direto exceto via hooks.

---

## 5. Convenções de Nomenclatura

### Backend (Python)
- Arquivos e módulos: `snake_case.py`
- Classes: `PascalCase`
- Funções e variáveis: `snake_case`
- Constantes: `UPPER_SNAKE_CASE`
- Schemas Pydantic: sufixo claro — `UserCreate`, `UserRead`, `UserUpdate`
- Modelos SQLAlchemy: substantivo singular — `User`, `LearningTrail`
- Repositórios: `XRepository` (`UserRepository`)
- Services: `XService` (`AuthService`)
- Testes: `test_<unidade>_<comportamento>.py`

### Frontend (TypeScript)
- Componentes: `PascalCase.tsx` em pasta `PascalCase/`
- Hooks: `useX.ts`
- Tipos: `PascalCase`
- Funções e variáveis: `camelCase`
- Constantes globais: `UPPER_SNAKE_CASE`
- Arquivos de teste: `X.test.tsx` colocados ao lado do arquivo testado

---

## 6. Organização de Pastas

### Backend
```
backend/
├── app/
│   ├── api/v1/              # Routers HTTP
│   ├── core/                # Config, segurança, logging
│   ├── db/                  # Sessão, base declarativa, init
│   ├── exceptions/          # Erros de domínio + handlers
│   ├── models/              # SQLAlchemy
│   ├── repositories/        # Acesso a dados
│   ├── schemas/             # Pydantic
│   ├── services/            # Regra de negócio
│   │   └── ai/              # Provider de IA (Abacus)
│   └── main.py
├── tests/
│   ├── unit/
│   └── integration/
├── alembic/                 # Pronto para migrations futuras
├── pyproject.toml
├── pytest.ini
└── .env.example
```

### Frontend
```
frontend/
├── src/
│   ├── api/
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   └── learning/
│   ├── contexts/
│   ├── hooks/
│   ├── pages/
│   ├── styles/
│   ├── types/
│   ├── utils/
│   ├── App.tsx
│   ├── main.tsx
│   └── router.tsx
├── tests/setup.ts
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 7. Padrões de Componentes React

- Cada componente vive em sua própria pasta com `index.ts`, `Component.tsx`, `Component.module.css` e `Component.test.tsx`.
- Componentes são **funções**, nunca classes.
- Props **sempre tipadas** via `interface ComponentNameProps`.
- Componentes de UI primitivos são **sem estado** e recebem tudo via props.
- Composição por `children` é preferida a props de render.
- Não há "deus-componente": se passar de ~150 linhas, quebrar.
- Acessibilidade tratada na raiz (labels, roles, foco visível).

Exemplo de assinatura:
```tsx
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  isLoading?: boolean;
}
```

---

## 8. Padrões de Hooks

- Um hook = uma responsabilidade.
- Sempre iniciar com `use`.
- Retornar objeto nomeado para hooks com múltiplos valores: `{ data, isLoading, error, refetch }`.
- Hooks de dados expõem **estado normalizado**: `data`, `isLoading`, `error`.
- Hooks não escondem efeitos colaterais não documentados.

---

## 9. Estratégia de Gerenciamento de Estado

- **Estado de UI local**: `useState` no componente.
- **Estado de autenticação**: `AuthContext` (Context API).
- **Estado de servidor**: hooks dedicados (`useLearningTrails`, `useLearningTrail`) que encapsulam fetch + cache leve em memória.
- Sem Redux. Sem Zustand. Se a aplicação crescer, migrar para TanStack Query (decisão futura, registrada via RFC).

---

## 10. Padrões de Consumo de API

- Único `apiClient` (wrapper sobre `fetch`) com:
  - base URL via env;
  - injeção de `Authorization` quando há token;
  - parse de erro padronizado em `ApiError`.
- Cada recurso tem seu módulo: `api/auth.ts`, `api/users.ts`, `api/learningTrails.ts`.
- Funções retornam **dados tipados**, nunca `Response` cru.
- Erros HTTP viram `ApiError` com `status`, `message`, `details`.

---

## 11. Padrões de UI

- Layout principal: container central, max-width ~960px para conteúdo de leitura, ~1200px para listagens.
- Espaçamento via tokens (`--space-1` a `--space-12`).
- Tipografia escalonada (`--font-size-sm`, `-base`, `-lg`, `-xl`, `-2xl`, `-3xl`, `-4xl`, `-5xl`).
- Pesos: `h1` em 700–800 com `--letter-tighter` (impacto via tamanho + tracking, não via peso); demais títulos em 600–700.
- Botões: 4 variantes — `primary` (sólido branco invertido, Vercel-style),
  `secondary` (borda hairline sobre preto), `ghost` (transparente), `danger`
  (vermelho discreto). Raio `--radius-md` (8px) para retangulares e
  `--radius-full` para pílulas pontuais (avatars, badges). Sempre com
  `:focus-visible` perceptível. **Sem `translateY` no `:active` ou `:hover`**
  — o hover muda borda/background, não posição.
- Inputs sempre com `label` associado.
- Cards: borda 1px hairline (`--color-border`), `--radius-lg` (12px), fundo
  `--color-bg-elevated`/`--gradient-card`, sombra `--shadow-sm` em repouso.
  Hover muda **borda e background** para a variante `-strong`, **nunca** a
  posição vertical. Glow colorido (`--shadow-primary-glow`) reservado a
  destaques pontuais.
- Animações discretas (≤ 320ms) via `--transition-fast`,
  `--transition-base`, `--transition-slow`.
- **Hardcoded de cores (`#xxxxxx`, `rgba(...)` literais) é proibido em CSS
  de página/componente** — use sempre tokens. Exceção limitada: blocos de
  código com sintaxe destacada (cores fixas independentes de tema).
- **Tema único — dark.** `<html data-theme="dark">` é hardcoded em
  `index.html` e `color-scheme: dark` evita flash. **Não há tema claro,
  toggle, `ThemeContext` nem `useTheme`.** Tentativas de reintroduzir tema
  claro exigem RFC dedicado.
- Avatar do usuário aparece no header como **âncora pra `/account`** em
  todas as páginas autenticadas. Foto opcional, armazenada no backend
  como data URL base64 (limite ~450 KB).
- **Listas com fluxo de execução** (ex.: tickets de uma trilha) usam
  **ligadura visual** entre os cards: cada item da lista (`<li>`) tem um
  node circular numerado (28px, `--radius-full`) conectado por uma linha
  vertical hairline (2px) que percorre a coluna esquerda. Itens já
  executados pintam o node em `--color-primary` (com `CheckIcon` no lugar
  do número) e elevam o connector que chega até eles para `--color-primary`.
  O último item ganha glow sutil para sinalizar "release final". Isso
  comunica progressão linear sem precisar de timeline elaborada.

---

## 12. Princípios de Acessibilidade

- HTML semântico sempre (`button`, `nav`, `main`, `section`, `header`).
- Contraste mínimo AA (4.5:1 para texto normal).
- `:focus-visible` estilizado e perceptível.
- Inputs com `label`, ou `aria-label` quando o rótulo é visual mas não textual.
- Mensagens de erro associadas via `aria-describedby`.
- Skip-to-content em layouts longos.
- Sem dependência exclusiva de cor para transmitir estado.

---

## 13. Identidade Visual

Identidade **dark-only, minimalista, alto contraste** — inspirada no
[Next.js Showcase](https://nextjs.org/showcase) / Vercel. Preto puro como
fundo, escala de cinzas frios, texto branco. Teal mantido como acento
discreto da marca, não como cor principal.

### Princípios

- Não existe tema claro. `<html data-theme="dark">` é hardcoded no
  servidor; `color-scheme: dark` no CSS evita flash de cor neutra do browser.
- Hierarquia visual via **contraste e bordas hairline**, não via cor.
- Acento primário em ações CTA é **branco invertido** (Vercel-style), não
  cor de marca. O teal aparece em badges/links/foco quando precisamos
  sinalizar identidade.

### Tokens principais

| Token | Valor | Uso |
|---|---|---|
| `--color-bg` | `#000000` | Fundo principal |
| `--color-bg-elevated` | `#0a0a0a` | Cards, header sólido |
| `--color-surface` | `#0e0e0e` | Hover de cards e nav |
| `--color-surface-strong` | `#161616` | Skeletons, chips neutros |
| `--color-text` | `#ededed` | Texto principal |
| `--color-text-muted` | `#a1a1aa` | Texto secundário |
| `--color-text-subtle` | `#6e6e76` | Metadata, eyebrows |
| `--color-border` | `#1f1f23` | Bordas hairline |
| `--color-border-strong` | `#2a2a2f` | Hover, foco |
| `--color-primary` | `#14d1be` | Acento de marca (teal discreto) |
| `--color-primary-soft` | `rgba(20,209,190,0.12)` | Badges de marca |
| `--color-accent` | `#ededed` | Acento neutro = branco |

### Tokens estruturais

| Token | Valor | Uso |
|---|---|---|
| `--gradient-primary` | `#fafafa → #ededed` | Botões primary (sólido branco) |
| `--gradient-hero` | preto vertical sutil | Heroes |
| `--gradient-card` | preto vertical sutil | Cards de destaque |
| `--gradient-glow` | radial branco a 6% no topo | Profundidade global |
| `--shadow-sm`/`-md`/`-lg`/`-xl` | sombras pretas profundas | Modais, dropdowns |
| `--shadow-primary-glow` | glow teal **muito sutil** | Reservado a destaques pontuais |
| `--radius-md` | `8px` | Botões ghost/secondary, inputs |
| `--radius-lg` | `12px` | Cards |
| `--radius-full` | `999px` | Pílulas, avatars, botões primários |
| `--font-sans` | `'Inter', 'Geist', system-ui` | UI |
| `--font-mono` | `'JetBrains Mono', 'Geist Mono', ui-monospace` | Código |

### Regras

- **Nunca** literais de cor em CSS de componente/página (exceto blocos
  de código com sintaxe destacada).
- Hover de cards e botões muda **borda + background**, nunca posição.
  Evite `transform: translateY` no hover — é ruído nesse visual.
- Sombras pretas; glow colorido (`--shadow-primary-glow`) reservado a
  callouts especiais.
- Glassmorphism limitado ao header (blur sobre preto translucido).
- Tipografia ousada nos títulos via tamanho + `--letter-tighter`, não via
  peso 800.

---

## 14. Responsividade

- Mobile-first.
- Breakpoints:
  - `--bp-sm`: 480px
  - `--bp-md`: 768px
  - `--bp-lg`: 1024px
  - `--bp-xl`: 1280px
- Toda página testada em viewport 360px e 1280px.
- Navegação colapsa para botão de menu abaixo de `md`.

---

## 15. Formulários e Validação

- Validação dupla: cliente (UX) **e** servidor (autoridade).
- Cliente: validação síncrona inline + bloqueio de submit.
- Servidor: Pydantic + regras de negócio nos services.
- Mensagens de erro humanas, em português, próximas ao campo.
- Botão de submit desabilitado enquanto request está em voo.

---

## 16. Tratamento de Erros

### Backend
- Erros de domínio são classes próprias em `app/exceptions/` (`AuthError`, `ConflictError`, `NotFoundError`, `AIProviderError`).
- Handlers globais traduzem para respostas HTTP padronizadas:
  ```json
  { "error": { "code": "USER_NOT_FOUND", "message": "Usuário não encontrado" } }
  ```
- Nunca vazar stacktrace ao cliente em produção.

### Frontend
- `ApiError` é capturada em hooks e exposta como `error`.
- UI renderiza componente `ErrorState` consistente.
- Erros de rede e erros HTTP têm mensagens distintas.

---

## 17. Loading, Empty State e Feedback Visual

Toda tela que carrega dados deve resolver os três estados:
1. **Loading** — `Spinner` ou skeleton.
2. **Empty** — `EmptyState` com mensagem clara e CTA.
3. **Erro** — `ErrorState` com botão de retry.

Sucesso de ações é comunicado por toast discreto ou transição imediata.

---

## 18. Logging

### Backend
- `logging` da stdlib com configuração centralizada em `app/core/logging.py`.
- Formato: timestamp, nível, módulo, mensagem.
- Sem `print`. Sem segredos em log.
- Nível padrão: `INFO`. `DEBUG` apenas em dev.

### Frontend
- `console.error` apenas em fluxos de erro real.
- Nada de `console.log` em produção (lint regra).

---

## 19. Estratégia de Testes

### Pirâmide
- Base larga de testes **unitários** (services, utilitários, hooks).
- Camada intermediária de testes de **integração** (API end-to-end no backend, fluxos de componente no frontend).
- Topo pequeno de testes **E2E** (opcional na primeira versão).

### Cobertura mínima
- Backend: **80% global**, **90% em `services/` e `repositories/`**.
- Frontend: **75% global**, **90% em hooks e utilitários puros**.

---

## 20. Estratégia de TDD

Toda feature segue o ciclo:
1. Escrever o teste que falha (Red).
2. Implementar o mínimo para passar (Green).
3. Refatorar mantendo verde (Refactor).

Regras:
- Nenhum PR sem testes correspondentes.
- Testes ficam próximos ao código que testam.
- Mock só atravessa fronteiras externas (HTTP, IA, sistema de arquivos).

---

## 21. Padrões de Testes — Frontend

- Vitest como runner.
- React Testing Library — consultar por papel (`getByRole`), nunca por classe CSS.
- MSW (Mock Service Worker) ou stubs de `apiClient` para isolar rede.
- Cada componente expõe pelo menos:
  - render base;
  - interação principal;
  - estado de erro/loading quando aplicável.

---

## 22. Padrões de Testes — Backend

- pytest com fixtures em `conftest.py`.
- Banco de testes em **SQLite in-memory** isolado por teste.
- `TestClient` (httpx) para integração.
- AIProvider real **nunca** é chamado em teste — sempre uma `FakeAIProvider`.
- Casos cobertos: happy path, validação, autorização, conflito, ausência.

---

## 23. Cobertura Mínima

| Camada | Mínimo |
|---|---|
| `app/services/` | 90% |
| `app/repositories/` | 90% |
| `app/api/` | 80% |
| Global backend | 80% |
| Hooks frontend | 90% |
| Global frontend | 75% |

PRs que reduzirem cobertura serão rejeitados.

---

## 24. Convenções de Commits

Padrão **Conventional Commits**:
```
<tipo>(<escopo opcional>): <descrição curta no imperativo>

<corpo opcional explicando o porquê>

<rodapé opcional: BREAKING CHANGE, refs, etc.>
```

Tipos aceitos:
- `feat` — nova funcionalidade
- `fix` — correção de bug
- `refactor` — refatoração sem mudança de comportamento
- `test` — adição ou ajuste de testes
- `docs` — documentação
- `chore` — tarefa de manutenção
- `style` — formatação
- `perf` — performance

Exemplos:
```
feat(auth): permitir alteração de senha pelo usuário
fix(trails): corrigir parsing de resposta do Abacus quando vazia
test(users): cobrir cenário de email duplicado
```

---

## 25. Fluxo de Branches — Trunk-Based em `develop`

> **Atualizado.** O projeto não usa mais branches de feature. Toda mudança
> nova (feat, fix, docs, refactor, test, chore) é commitada **direto na
> `develop`**, com testes verdes e cobertura mantida. `main` continua sendo
> protagonizada por `release/*` e `hotfix/*`.

| Branch | Propósito |
|---|---|
| `main` | Código em produção. Recebe apenas merges de `release/*` ou `hotfix/*`. |
| `develop` | **Branch de trabalho diário.** Todo commit novo entra aqui. |
| `release/<versão>` | Estabilização de release. Sai de `develop`, vai para `main` e volta para `develop`. |
| `hotfix/<slug>` | Correção urgente em produção. Sai de `main`, vai para `main` e `develop`. |

Regras:
- Antes de qualquer commit em `develop`: `git pull --rebase origin develop`.
- Cada commit é pequeno, focado e segue Conventional Commits (§24).
- Cada commit precisa estar com a suite verde — quebrar `develop` é incidente.
- Tags semânticas em `main` (`v0.1.0`, `v0.2.0`...).
- Branches `feature/*` **não são mais criadas**. Se aparecerem (importadas, automações etc.), devem ser removidas após o merge.

Fluxo típico:
```powershell
git checkout develop
git pull --rebase origin develop
# editar, testar
git add .
git commit -m "feat(escopo): mensagem clara"
git push origin develop
```

---

## 26. Pull Requests

PRs deixam de ser obrigatórios para o fluxo de `develop`. Continuam **obrigatórios** apenas para:
- `release/* → main`
- `hotfix/* → main` (e também merge de volta para `develop`)

Quando um PR é necessário, ele deve conter:
1. Descrição do **problema** que resolve.
2. Descrição da **solução** adotada.
3. Lista de testes adicionados ou ajustados.
4. Notas de **breaking change**, se houver.
5. Checklist:
   - [ ] Testes passando localmente
   - [ ] Cobertura mantida ou ampliada
   - [ ] Lint sem erros
   - [ ] `agents.md` consultado e respeitado
   - [ ] Documentação atualizada se necessário

Critérios de qualidade em `develop` (sem PR como gate):
- A suite (`pytest` no backend, `npm run test:run` no frontend) precisa estar verde **antes** do push.
- Cobertura mínima descrita em §23 precisa ser mantida.
- Auditoria de dependências (`pip-audit`, `npm audit`) deve estar zerada.
- Mudanças destrutivas ou de contrato continuam exigindo nota explícita no corpo do commit.

---

## 27. Definition of Done

Uma feature está pronta quando:
- Código implementado conforme padrões deste documento.
- Testes unitários e de integração escritos e verdes.
- Cobertura mínima respeitada.
- Sem erros de lint/tipagem.
- Documentação atualizada se introduziu novo endpoint, schema ou tela.
- Verificada manualmente em desktop e mobile (frontend).
- Revisada e aprovada via PR.

---

## 28. Critérios Mínimos para Aceitar uma Feature

- Atende ao escopo descrito no ticket.
- Não introduz regressão (suite verde).
- Não quebra retrocompatibilidade da API pública.
- Loga em nível adequado.
- Tem comportamento previsível para entrada inválida.
- Tem tratamento explícito de erro.

---

## 29. Documentação de Código

- Funções públicas de service e repository têm **docstring curta** explicando o porquê (não o que).
- Tipos complexos têm um exemplo no docstring.
- Endpoints documentados via Pydantic + FastAPI (Swagger automático).
- Comentário inline só quando o "porquê" não for óbvio do código.

---

## 30. Regras para Criação de Novos Elementos

### Nova tela (frontend)
1. Criar componente em `pages/<Nome>/`.
2. Registrar em `router.tsx`.
3. Definir loading, empty e error states.
4. Adicionar testes do fluxo principal.

### Novo endpoint (backend)
1. Definir schema(s) Pydantic em `app/schemas/`.
2. Definir/atualizar repository se afetar persistência.
3. Implementar service.
4. Criar rota no router apropriado (`app/api/v1/`).
5. Adicionar testes unitários de service e integração de rota.

### Novo schema
- Sempre separar `XCreate`, `XUpdate`, `XRead`.
- Nunca expor `password_hash` ou campos internos via `XRead`.

### Novo teste
- Nome descritivo: `test_<sujeito>_<acao>_<resultado_esperado>`.
- Um conceito por teste.

---

## 31. Migração de SQLite para PostgreSQL

Decisões para evitar acoplamento:
- Usar SQLAlchemy 2.x — mesma API para ambos.
- Tipos `String`, `Integer`, `DateTime`, `Boolean` apenas. Evitar tipos específicos de SQLite.
- Datas sempre em UTC, gravadas como `DateTime(timezone=True)` (Postgres) — fallback transparente em SQLite.
- IDs como `Integer` autoincrement por padrão; trocar para `UUID` é evolução posterior, não decisão atual.
- `DATABASE_URL` lido de env; nada hardcoded.
- Alembic configurado desde o início; quando trocar para Postgres, basta nova migration + ajuste de URL.
- Em testes, banco em memória SQLite para velocidade — integração em CI futura pode rodar contra Postgres real.

Checklist antes de migrar:
- [ ] Suite verde com SQLite
- [ ] Suite verde rodando contra Postgres local
- [ ] Migrations Alembic geradas e aplicadas
- [ ] Variáveis de ambiente ajustadas
- [ ] Backup do SQLite antigo

---

## 32. Integração com IA (Abacus / OpenAI — provider-agnóstico)

- O sistema é **agnóstico quanto ao provedor de IA**. Tudo é acessado via a
  interface `AIProvider`. Há duas implementações HTTP reais —
  `AbacusAIProvider` e `OpenAIAIProvider` — além do `FakeAIProvider` de teste.
- **Mesmo contrato.** Abacus (RouteLLM) e OpenAI falam exatamente o mesmo
  contrato Chat Completions (`POST {base}/v1/chat/completions`, header
  `Authorization: Bearer <key>`, resposta em `choices[0].message.content`).
  Por isso `OpenAIAIProvider` **herda** de `AbacusAIProvider`, sobrescrevendo
  apenas a base URL padrão (`https://api.openai.com`), o `provider_label` e as
  mensagens de erro (timeout/créditos) que citam termos específicos. Toda a
  lógica de payload, parsing e tratamento de erro é compartilhada.
- **Duas formas de configurar a chave:**
  - **Global (por ambiente):** `AI_PROVIDER` (`abacus` | `openai` | `fake`)
    define o provider de fallback. É usado quando o usuário não trouxe a
    própria chave.
  - **Por usuário (BYOK):** cada usuário pode trazer a própria credencial via
    `/api/v1/ai-credentials`, escolhendo `abacus` ou `openai`. Quando presente,
    ela tem prioridade sobre o provider global. Detalhes na §41.
- A montagem é feita pela factory `app/services/ai/factory.py`:
  - `get_ai_provider()` — provider GLOBAL (cacheado), lido das settings.
  - `build_provider_for_credential(provider, api_key, model, base_url)` — monta
    o provider de um usuário a partir da credencial **decifrada**. NUNCA
    cacheado (lida com segredo por requisição).
- A injeção em `app/api/deps.py` (`get_ai_provider_dep`) resolve, por
  requisição: credencial do usuário → provider BYOK; senão → provider global.
  Nos testes, o `conftest` sobrescreve esse callable com o `FakeAIProvider`.
- Usa o endpoint **RouteLLM** da Abacus em `POST {ABACUS_API_URL}/v1/chat/completions`, compatível com o contrato OpenAI Chat Completions.
- Configuração por variáveis de ambiente:
  - `ABACUS_API_URL` (padrão `https://routellm.abacus.ai`)
  - `ABACUS_API_KEY` (header `Authorization: Bearer <key>`)
  - `ABACUS_MODEL` (ex.: `gpt-5`, `claude-sonnet-4`, etc.) — modelo das
    chamadas pesadas (geração de trilha por tema e por projeto).
  - `ABACUS_QUESTIONS_MODEL` (ex.: `gemini-3.5-flash`) — modelo dedicado
    às perguntas de diagnóstico inicial. Curtas, baratas, mais rápidas.
    Quando vazio, faz fallback transparente em `ABACUS_MODEL`.
  - `ABACUS_CONCEPT_MODEL` (padrão `claude-sonnet-4-6`) — modelo das
    explicações de conceito. A explicação é um payload estruturado e
    limitado (bem menor que uma trilha), então a classe Sonnet entrega a
    mesma qualidade pedagógica com latência bem menor que o `ABACUS_MODEL`
    top-tier. Fallback transparente em `ABACUS_MODEL` quando vazio. Como a
    explicação é cacheada (§38), o ganho de velocidade é sentido no primeiro
    clique de cada conceito.
  - `ABACUS_CATEGORIZER_MODEL` (padrão `claude-haiku-4-5-20251001`) —
    modelo barato usado para abstrair os concepts dos tickets em poucas
    skills genéricas no momento da criação/regeneração da trilha. Fallback
    transparente em `ABACUS_MODEL` quando vazio.
  - `ABACUS_TIMEOUT_SECONDS` (padrão 300 — 5 min; trilhas longas com modelos top-tier podem se aproximar disso)
- A interface `AIProvider` expõe seis métodos obrigatórios. Os quatro
  primeiros cobrem o **modo TOPIC** (aluno dita um tema, IA propõe o projeto):
  - `generate_next_topic_question(topic, *, skills, previous_answers)` —
    gera a **próxima** pergunta de diagnóstico levando em conta o histórico
    de respostas. Retorna `None` quando a IA decide que já tem contexto
    suficiente. Usa `questions_model`. Teto rígido de 5 perguntas aplicado
    no service.
  - `generate_learning_trail(topic, *, skills, assessment)` — gera a trilha
    personalizada pelas skills do aluno e pelas respostas do diagnóstico.
    Usa `model`.
  - `explain_concept(concept, *, context, skills)` — gera uma explicação
    aprofundada de um conceito específico, calibrada pelo nível do aluno.
    Usa `concept_model` (Sonnet por padrão; fallback em `model`).
  - `categorize_concepts(concepts)` — colapsa uma lista de concepts
    específicos ("JWT", "OAuth2", "Repository", "Migrations") em poucas
    categorias genéricas ("autenticação", "banco de dados"). Chamado pelo
    `LearningTrailService` no `create_for_user`/`regenerate_for_user` para
    popular `TrailContent.skill_categories`. Usa `categorizer_model`.
  Os dois métodos extras cobrem o **modo PROJECT** (aluno dita o escopo do
  projeto + as tecnologias que quer aprender — detalhes em §40):
  - `generate_next_project_question(project_scope, *, technologies, skills, previous_answers)`
    — mesma semântica do `generate_next_topic_question`, porém a entrevista
    é calibrada pelo escopo + pela stack declarada (não por um tema solto).
    Usa `questions_model`.
  - `generate_project_trail(project_scope, *, technologies, skills, assessment)`
    — gera a trilha em torno do projeto descrito. A stack declarada é
    espinha dorsal, **mas a IA tem liberdade de incluir conceitos fora dela
    quando o projeto exigir** (auth, testes, infra mínima). Usa `model`.
- Prompts ficam em `app/services/ai/prompts.py` — versionados, revisados via PR. Princípios não-negociáveis:
  - **Sem conteúdo genérico.** O modelo é instruído a sempre escolher um cenário concreto.
  - **Personalização explícita por skill E pelo diagnóstico.** Cada ticket
    precisa expor `personalization_notes` referenciando o nível atual do
    aluno e/ou a resposta do diagnóstico que justificou a decisão.
  - **Pré-requisitos cobertos.** Quando o diagnóstico revela que o aluno
    não conhece a stack solicitada, a trilha **precisa** incluir tickets
    fundacionais antes dos avançados — é ilógico mandar alguém "projetar
    API REST com FastAPI" sem antes garantir que ele consegue subir uma
    rota básica.
  - **Concepts curtos e citáveis**, porque eles viram skills do aluno na conclusão.
  - **Cobertura conceito ↔ tarefa (não negociável).** Tudo que as `tasks`
    de um ticket pedem precisa ter o `concept` que ensina aquilo, no mesmo
    ticket ou num anterior — o aluno só tem material de estudo para o que
    está em `concepts` (cada concept abre uma página de explicação). Nenhuma
    task pode exigir algo que o aluno nunca viu nos conceitos; inversamente,
    não se listam `concepts` decorativos que nenhuma task exercita. A regra
    está nos dois `*_SYSTEM_PROMPT` ("COBERTURA CONCEITO ↔ TAREFA") e
    reforçada nos `*_USER_PROMPT_TEMPLATE`.
  - **`concepts` em ordem pedagógica.** Dentro de cada ticket, a lista
    `concepts` segue a ordem em que o aluno deve estudar: do pré-requisito
    para o avançado, do mais simples para o mais complexo. O backend NÃO
    reordena — a UI mostra os chips na ordem que a IA devolveu, então o
    primeiro chip tem que ser o ponto de entrada natural do ticket e o
    último o conceito mais sofisticado.
  - **Encerramento obrigatório.** O ÚLTIMO ticket da trilha é a release
    final: entrega o projeto descrito em `project_summary` de ponta a
    ponta. Nada de terminar em "refatoração", "observabilidade" ou
    "próximos passos". O título carrega palavra de fechamento (release,
    entrega, capstone, demo, ponta a ponta, v1.0). Os
    `acceptance_criteria` do último ticket validam o deliverable inteiro.
  - **`final_deliverable` é parte do contrato.** Toda trilha expõe, no
    nível raiz do `TrailContent`, o artefato concreto que o aluno terá
    rodando ao fechar o último ticket (URL, comando, demo, repositório
    taggeado). Sem isso, a trilha não fecha.
  - **Eficiência / concisão (latência).** A geração é autoregressiva: o
    tempo é dominado pelos tokens de SAÍDA. Os dois `*_SYSTEM_PROMPT` de
    trilha carregam um bloco "EFICIÊNCIA" que acelera cortando DESPERDÍCIO
    (floreio, adjetivos vazios, frases de transição, repetição entre
    campos) mas **preserva a substância técnica** — especificidade,
    decisões de arquitetura, nomes concretos e granularidade fina dos
    tickets. Calibragem de meio-termo: `objective` 1–2 frases,
    `personalization_notes` 2–3 frases, `project_summary` 2–3 parágrafos
    densos, 4–7 `tasks` e 3–5 `acceptance_criteria` por ticket, todos
    específicos/verificáveis, + JSON compacto. Acelera SEM trocar de modelo
    e sem rasurar a trilha — a profundidade de cada conceito segue nas
    páginas de conceito (§38). Os `*_USER_PROMPT_TEMPLATE` reforçam a regra
    de DENSIDADE.
  - **Diversidade / anti-clichê (não negociável).** O mesmo tema NÃO pode
    sempre gerar o mesmo projeto. `_variation_directive()` em `prompts.py`
    injeta, a CADA chamada de `build_user_prompt`/`build_project_user_prompt`,
    um bloco "DIVERSIDADE E ORIGINALIDADE" sorteado: uma `seed` aleatória +
    um domínio de negócio (`_SCENARIO_DOMAINS`) + um recorte de produto
    (`_PRODUCT_ANGLES`), além da ordem de "imagine 3 cenários e descarte o
    óbvio". No modo TEMA o domínio é sorteado (a menos que o tema já o fixe,
    quando se varia o sub-nicho); no modo PROJECT o domínio é travado pelo
    escopo (`lock_domain=True`) e a variação recai sobre
    arquitetura/modelagem/ordem/exemplos. Como a diretiva é sorteada por
    chamada, o `regenerate` também muda de projeto. O `AbacusAIProvider`
    complementa com `temperature=_GENERATION_TEMPERATURE` (0.85) nas duas
    gerações pesadas de trilha — a seed só existe para empurrar a variação e
    NUNCA aparece na saída.
- Resposta esperada: `choices[0].message.content` contendo o JSON; é validado contra `TopicQuestion`/`TrailContent`/`ConceptExplanation` antes de virar domínio.
- Erros do provider viram `AIProviderError` com mensagem amigável; timeout cita o valor configurado e a env var a ajustar.
- Streaming não é usado (sempre `"stream": false`).
- Em ambiente de teste, usar `FakeAIProvider` determinístico — a API real **nunca** é chamada nos testes.

---

## 33. Princípios de Segurança

- Senhas com `bcrypt` (passlib). Nunca armazenar texto puro.
- JWT com expiração (`ACCESS_TOKEN_EXPIRE_MINUTES`, padrão 60).
- `SECRET_KEY` obrigatória via env. App falha ao subir se não houver.
- CORS restrito por env (`ALLOWED_ORIGINS`).
- Endpoints autenticados via dependência `get_current_user`.
- Usuário só acessa as próprias trilhas (autorização verificada no service).
- Validação de input no boundary (Pydantic).
- Sem segredos em código ou logs.
- **API keys BYOK do usuário são cifradas em repouso** (Fernet, em
  `app/core/crypto.py`). Nunca são persistidas em texto puro, nunca retornam
  pela API (só máscara dos últimos 4 caracteres) e nunca aparecem em log. A
  chave de cifragem vem de `ENCRYPTION_KEY` (ou deriva de `SECRET_KEY`).
- Rate limiting é evolução futura prevista (não bloqueia v0.1).

---

## 34. Retrocompatibilidade

- Endpoints v1 não mudam contrato após release. Mudança de contrato exige novo endpoint ou versão (`/api/v2/...`).
- Schemas Pydantic não removem campos sem deprecação documentada.
- Migrations de banco são sempre aditivas no primeiro passo (adicionar coluna nullable, popular, depois constraint).

---

## 35. UX Pedagógica para Geração de Trilhas

A experiência de gerar uma trilha deve transmitir intenção pedagógica clara:

1. **Escolha do modo + coleta**: na topo do formulário, um toggle
   segmentado ("Por tema" / "Por projeto") deixa o aluno escolher como
   quer descrever o que vai aprender. Modo **tema** mostra um único campo
   amplo com sugestões. Modo **projeto** mostra uma `TextArea` para o
   escopo + um chip-input de tecnologias com sugestões e botão remover
   por chip. As dicas laterais trocam de conteúdo conforme o modo. O modo
   padrão é **tema** (preserva o fluxo clássico). Detalhes do modo projeto
   em §40.
2. **Diagnóstico inicial obrigatório (modal sobreposto)**: ao continuar, a IA
   gera até 5 perguntas curtas de múltipla escolha para calibrar nível,
   contexto e pré-requisitos. Detalhes em §39 (versão tema) e §40 (versão
   projeto, com endpoint dedicado).
3. **Loading explícito**: durante a geração (que pode levar dezenas de segundos), mostrar mensagem como _"O mentor está desenhando o projeto e os tickets..."_, com indicador de progresso.
4. **Resultado estruturado**:
   - Título do projeto proposto.
   - Resumo do projeto e por que ele é realista.
   - Lista ordenada de tickets, cada um expansível.
   - Cada ticket mostra: título, objetivo, **nota de personalização**, conceitos abordados (clicáveis), tarefas e critérios de aceite.
5. **Conceitos aprofundáveis**: cada chip de conceito abre uma página dedicada com definição, padrões, armadilhas, dicas, exemplo de código e leituras complementares — também gerados por IA e calibrados pelo nível do aluno.
6. **Conclusão é por ticket**: cada `TicketCard` expõe um botão "Marcar
   como concluído" no rodapé do corpo expandido. Concluir um ticket pinta
   o node correspondente na ligadura visual (§11), risca o título do
   ticket e exibe uma pílula "Concluído" ao lado do código. A trilha
   **auto-conclui** assim que o último ticket é marcado — não existe
   botão "Concluir trilha". Desmarcar um ticket de uma trilha já
   concluída reabre a trilha (`completed_at = null`), mas **mantém** as
   skills aplicadas no perfil (desfazer aprendizado seria confuso).
7. **Progressão automática**: na transição 0→100% de tickets concluídos,
   as `skill_categories` da trilha (§37) viram skills no perfil ou
   elevam o nível existente, e a UI mostra o que foi adicionado/elevado
   via `EarnedSkillsCard`.
8. **Tom**: didático e exigente. Sem infantilizar. Sem encher de emoji.
9. **Não-editável**: o conteúdo gerado da trilha não é editável pelo
   usuário — para mudar, regenera ou cria uma nova.
10. **Regeneração**: pode pedir nova versão; isso zera `completed_at` e
    o estado dos tickets, e invalida o cache de explicações. As
    respostas do diagnóstico **são reaproveitadas** — o aluno não
    responde tudo de novo.
11. **Leitura confortável**: largura controlada, contraste alto, espaçamento generoso.

---

## 37. Skills, Personalização e Progressão

Skills são entidades de primeira classe — armazenam o que o aluno declara
conhecer (e em que profundidade) e alimentam a personalização da IA.

### Modelo
- Tabela `skills`: `id`, `user_id`, `name` (lowercase, único por usuário),
  `proficiency` (1-4), `created_at`, `updated_at`.
- Níveis: `1=novice`, `2=beginner`, `3=intermediate`, `4=advanced`.
- Constantes `PROFICIENCY_LEVELS`/`PROFICIENCY_LABELS` em
  `app/models/skill.py` são a única fonte de verdade dos níveis.

### Coleta
- Skills podem ser declaradas no **cadastro** (`UserCreate.skills`) ou
  gerenciadas a qualquer momento via `/api/v1/skills` (CRUD completo).
- `SkillService.add_for_user` normaliza para lowercase e rejeita duplicatas
  por usuário (`ConflictError`).

### Personalização da IA
- `LearningTrailService` converte `user.skills` em `UserSkillInput` e passa
  ao provider, que injeta no prompt junto com o tema.
- Prompts orientam o modelo a:
  - **assumir fluência** em skills `intermediate`/`advanced`;
  - **revisar rápido** o que está em `beginner`;
  - **explicar do zero** o que está em `novice` ou ausente;
  - escrever `personalization_notes` por ticket conectando o conteúdo ao
    nível atual do aluno.

### Progressão automática
- Skills no perfil são **categorias genéricas e transferíveis** (`git`,
  `python`, `api rest`, `autenticação`, etc.), não nomes específicos de
  conceitos. As categorias são geradas pela IA no `create`/`regenerate`
  da trilha (modelo `ABACUS_CATEGORIZER_MODEL`, padrão Claude Haiku) e
  persistidas em `TrailContent.skill_categories`. Isso evita poluir o
  perfil do aluno com dezenas de termos pontuais ("JWT", "OAuth2",
  "bcrypt"…) — eles colapsam em "autenticação".
- A conclusão da trilha é **um efeito colateral da conclusão dos
  tickets**, não uma ação separada do usuário. Não existe endpoint
  `POST /{id}/complete`.
- Endpoints reais: `POST /api/v1/learning-trails/{id}/tickets/{code}/complete`
  e `DELETE /api/v1/learning-trails/{id}/tickets/{code}/complete`.
  Ambos retornam `CompleteTicketResponse({ trail, trail_completed,
  added_concepts, upgraded_concepts })`.
- Comportamento do service `set_ticket_completion`:
  - marca/desmarca `completed_at` no ticket dentro de `content`;
  - operação **idempotente** — chamar duas vezes seguidas é no-op
    (`trail_completed=false`, listas vazias);
  - quando a transição leva a trilha de <100% para 100% de tickets
    concluídos, automaticamente marca `trail.completed_at`, itera sobre
    `content.skill_categories` e aplica skills no perfil. O response
    devolve `trail_completed=true` para a UI mostrar o feedback;
  - se `skill_categories` está vazio (trilha antiga), executa backfill
    on-the-fly com o categorizer e persiste o resultado antes de aplicar;
  - skill nova entra como `beginner` (2); skill em `novice` (1) sobe
    para `beginner`; nada acima é tocado;
  - **desmarcar um ticket de uma trilha 100% concluída** zera
    `trail.completed_at` (reabre a trilha) mas **não desfaz** as skills
    aplicadas no perfil — retroceder aprendizado seria confuso e
    convidaria a abuso.

### UX no frontend
- `SkillEditor` é o único componente que entende skills no frontend.
  Funciona em dois modos: estado local (cadastro) e remoto via callbacks
  (página de conta).
- `useSkills` encapsula `GET /skills` com `data/isLoading/error/refetch`.
- Sempre exibir o rótulo curto (`novice`/`beginner`/`intermediate`/`advanced`)
  além do número.

---

## 38. Explicação Aprofundada de Conceitos

Todo conceito listado em um ticket é clicável e abre uma explicação
gerada por IA.

### Schema
- `ConceptExplanation` em `app/schemas/learning_trail.py` carrega, na ordem
  pedagógica obrigatória: `concept`, `definition`, `why_it_matters`,
  `patterns`, `examples` (com `code` opcional), `hands_on_steps` (passo a
  passo executável), `tips`, `pitfalls`, `further_reading` e `glossary`
  (lista de `{term, brief}` para tooltips em conceitos secundários).
  Limites de tamanho estão no schema para impedir respostas absurdas.

### Endpoint
- `GET /api/v1/learning-trails/{id}/tickets/{code}/concepts/{concept}`.
- Verifica autorização sobre a trilha, valida que o ticket existe e que o
  conceito pertence a ele antes de chamar a IA.
- Aceita querystring `?refresh=true` para ignorar o cache e regenerar.
- Erros de domínio (`NotFoundError`, `ForbiddenError`) seguem o handler
  global.

### Cache persistido
- Tabela `concept_explanation_cache` com chave única
  `(trail_id, ticket_code, concept_key)`; `concept_key` é o conceito
  normalizado em lowercase.
- `LearningTrailService.explain_concept_for_user` consulta o cache primeiro;
  só chama a IA em cache miss ou `force_refresh=True`, e persiste o resultado.
- Cascade `ON DELETE` na trilha limpa o cache automaticamente.
- `regenerate_for_user` e edições manuais de `content` invalidam o cache
  associado à trilha — o contexto mudou, explicações antigas perderam validade.
- Tradeoff aceito: a explicação é calibrada pelo nível das skills **no
  momento da geração**. O usuário pode forçar regeneração via botão
  "Atualizar" no modal (envia `?refresh=true`).

### Prompt
- `CONCEPT_SYSTEM_PROMPT` + `build_concept_prompt` em `prompts.py`.
- Recebe `ConceptContext` (projeto, ticket, objetivo) e as skills do aluno
  para calibrar o nível da explicação.
- Tom: **acessível ao iniciante engajado**, com analogias antes do termo
  técnico, sem jargão não definido. Frases curtas, voz ativa.
- Exemplos **obrigatoriamente em domínio análogo**, nunca no domínio do
  projeto em que o conceito apareceu — força o aluno a fazer a transposição
  mental em vez de copiar/colar.
- `hands_on_steps`: 3 a 7 passos curtos e executáveis na voz imperativa
  ("Crie...", "Defina..."). Não usar a palavra "passo" no começo (UI
  numera). Pode usar markdown inline.
- `glossary`: 0 a 8 termos secundários citados nos textos com 1–2 frases
  cada. NUNCA repetir o conceito principal. O frontend gera tooltip na
  primeira ocorrência (case-insensitive, word boundary).
- Pode usar markdown inline nos textos: `**negrito**`, `==marca-texto==`,
  `` `código inline` ``. Nada de cabeçalhos, listas ou blocos de código no
  texto livre — listas e código têm campos próprios no schema.
- Saída JSON pura, validada antes de chegar ao frontend.

### UX
- **Página dedicada** em `/trails/:id/tickets/:code/concepts/:concept` —
  não modal. Permite múltiplas abas abertas, pairing, compartilhamento
  de link.
- Chips de conceito do `TicketCard` são `<a target="_blank">` para
  **abrir em nova guia**.
- Componente `RichText` renderiza o markdown leve com segurança (sem
  `dangerouslySetInnerHTML`; XSS impossível por construção) e detecta
  termos do `glossary` automaticamente, transformando a **primeira**
  ocorrência (case-insensitive, word boundary) em `GlossaryTerm` clicável
  com tooltip escuro.
- Marca-texto (`==trecho==`) tem visual de **caneta verde irregular**:
  cor primary do app, gradiente diagonal e bordas levemente desalinhadas
  para parecer feito à mão.
- Ordem pedagógica das seções é fixa e obrigatória, cada uma com label
  pequeno + título grande + hint opcional:
  1. **O que é** — definição em palavras simples (texto lead).
  2. **Por que isso importa** — callout verde conectando ao projeto.
  3. **Como funciona na prática** — padrões/variantes em lista.
  4. **Exemplos em outros contextos** — domínio análogo, com nota.
  5. **Passo a passo** — lista numerada executável para consolidar.
  6. **Como aplicar bem** — dicas acionáveis com seta `→`.
  7. **O que evitar** — armadilhas com `!` em fundo avermelhado.
  8. **Para ir além** — termos em pills para pesquisar.
- Botão discreto "Atualizar" no header dispara nova geração (cache bypass)
  para casos em que o usuário evoluiu de nível e quer recalibrar.

---

## 39. Diagnóstico Inicial Adaptativo (Antes da Trilha)

Toda trilha nova passa por um **diagnóstico adaptativo curto** antes da
geração. O objetivo é evitar trilhas ilógicas (alguém querendo "API design
com FastAPI" sem nunca ter usado FastAPI) e calibrar profundidade, ordem
dos tickets e pré-requisitos cobertos.

Esta seção descreve o diagnóstico do **modo TOPIC**. O modo PROJECT usa
as mesmas regras (teto rígido, adaptatividade, schemas), mas com endpoint
e prompts dedicados — ver §40.

**Princípio central:** cada resposta é contexto para a **próxima** pergunta.
Não geramos um set fixo upfront — a IA conduz a entrevista uma pergunta de
cada vez, sondando lacunas ou subindo o nível conforme o aluno responde.

### Schemas
- `TopicQuestion`: `{ id, question, rationale, options[] }`. `rationale` é
  documentação interna sobre o que a pergunta diagnostica — não aparece para
  o aluno.
- `TopicQuestionOption`: `{ id, label }`. IDs `a`/`b`/`c`/`d`. Alternativas
  específicas do tema, ordenadas do "sei pouco" ao "domino".
- `TopicNextQuestionRequest`: `{ topic, previous_answers: TopicAnswer[] }`.
  Histórico crescente que o cliente envia a cada chamada.
- `TopicNextQuestionResponse`: `{ question: TopicQuestion | null, done: bool }`.
  Quando `done=true`, o cliente para de perguntar e dispara o create.
- `TopicAnswer`: `{ question_id, question, answer }`. Carregamos o texto da
  pergunta + texto da alternativa escolhida (não só ids) para que o prompt
  da trilha receba contexto humano.

### Endpoints
- `POST /api/v1/learning-trails/assessment/next` com
  `{ topic, previous_answers }` → `TopicNextQuestionResponse`. Autenticado.
  Não persiste nada — só consulta a IA. Chamado N vezes (até 5) durante a
  entrevista. O service impõe teto rígido de 5 perguntas independente do
  que a IA retornar.
- `POST /api/v1/learning-trails` aceita `assessment: TopicAnswer[]` (lista
  pode estar vazia se o aluno pulou tudo). É persistido em `assessment_json`
  na tabela `learning_trails`.

### Modelo de IA
- Perguntas usam `ABACUS_QUESTIONS_MODEL` (ex.: `gemini-3.5-flash`) — modelo
  leve e barato, geralmente devolve em poucos segundos.
- Trilha + explicação de conceito usam `ABACUS_MODEL` (mais denso).
- Quando `ABACUS_QUESTIONS_MODEL` está vazio, o provider faz fallback
  transparente em `ABACUS_MODEL`.

### Reaproveitamento em regenerate
- `regenerate_for_user` lê `assessment_json` salvo e passa de volta ao
  provider. **O aluno não responde o diagnóstico de novo.**
- O conteúdo gerado **não é editável** pelo usuário — para mudar a trilha,
  basta regenerar (mesmo diagnóstico) ou criar uma nova. A regeneração
  invalida o cache de explicações associado.

### UX (frontend)
- O fluxo em `/trails/new` tem quatro fases: `idle` → `loading-questions` →
  `answering` → `generating`.
- A página dispara `assessment/next` com `previous_answers: []` para obter
  a **primeira** pergunta antes de abrir o modal. As próximas são pedidas
  pelo próprio modal via callback `loadNextQuestion(history)`.
- Botão principal mostra **"Continuar"**. Vira **"Gerar trilha"** apenas
  quando o teto duro (5) é atingido.
- `AssessmentModal` é fullscreen sobreposto e mantém o histórico internamente:
  - Backdrop com blur, animação de entrada suave.
  - Header com eyebrow "Diagnóstico inicial" + título + subtítulo lembrando
    que cada resposta calibra a próxima pergunta sobre o tema em **negrito**.
  - Indicador de progresso em pílulas numeradas: respondidas em primary-soft,
    atual em primary, e **pílulas pontilhadas** sinalizam "podem vir mais"
    até o teto duro de 5.
  - **Uma pergunta por vez** carregada sob demanda. Entre perguntas, o stage
    mostra `Spinner` com mensagem "A IA está usando suas respostas anteriores
    para escolher a próxima sondagem." Falha de rede expõe `ErrorState` inline
    com botão "Tentar novamente".
  - Transição forward usa slide horizontal (200ms) ANTES do fetch, dando
    sensação de continuidade.
  - Alternativas como `<label>` envolvendo `<input type="radio">` com estado
    `optionSelected` realçado em primary-soft.
  - Botão "Pular pergunta" registra um sentinela `__skip__` convertido em
    `"Prefiro não responder"` no payload e dispara o fetch da próxima.
  - Botão "Anterior" navega para trás entre perguntas já carregadas sem
    refazer fetch.
  - "Cancelar" (canto superior direito) e tecla **Esc** fecham o modal e
    voltam ao formulário sem submeter — cancelar durante `generating` é
    bloqueado.
  - Acessibilidade: `role="dialog" aria-modal="true"`, `aria-live="polite"`
    no stage, foco programático no card a cada troca de pergunta.

### Princípio adaptativo no prompt das perguntas
- `NEXT_QUESTION_SYSTEM_PROMPT` instrui a IA a tratar o diagnóstico como
  uma **entrevista**: cada nova pergunta tem que se basear no que já foi
  respondido, nunca repetir um tópico, e descer em pré-requisitos quando a
  resposta anterior revelar lacuna fundacional.
- Eixos cobertos ao longo da entrevista (sem repetir): familiaridade com a
  stack principal, pré-requisitos fundacionais, objetivo/contexto, práticas
  auxiliares — sempre que relevantes.
- A IA pode sinalizar `done=true` quando tiver contexto suficiente; o service
  ainda valida o teto rígido (5).

### Princípio pedagógico no prompt da trilha
- O bloco "Respostas do diagnóstico inicial" no prompt é **autoridade
  máxima** sobre o nível do aluno NO TEMA solicitado (skills declaradas
  cobrem o resto).
- Quando uma resposta revela falta de pré-requisito da stack pedida, o
  modelo é instruído a incluir tickets fundacionais cobrindo essa lacuna
  ANTES dos tickets avançados.
- **Mais da metade** dos `personalization_notes` precisa citar, em palavras
  concretas, alguma das respostas — não basta dizer "ajustado ao seu nível".
- Cada `personalization_notes` deve mencionar QUAL resposta justificou a
  decisão ("você respondeu que nunca usou X, então...").

### Validação automatizada
- Teste de integração
  (`test_assessment_actually_changes_generated_trail`) prova
  end-to-end que respostas diferentes produzem TG-1 com **título e
  conteúdo distintos**, e que o ticket fundacional cita literalmente a
  resposta do aluno.
- O `FakeAIProvider` aplica a mesma regra: quando uma resposta indica baixa
  familiaridade, monta um TG-1 "Primeiros passos guiados com {topic}" com
  o conceito "Pré-requisitos da stack" e cita a resposta no
  `personalization_notes`.

---

## 40. Modo "Por projeto" (escopo + tecnologias)

Modo alternativo de criação de trilha. Em vez de ditar um tema, o aluno
descreve o **escopo de um projeto** e lista as **tecnologias que quer
aprender** nele. A IA usa esses dados para desenhar a trilha, mas
**não fica refém da stack declarada** — tem permissão (e dever) de incluir
conceitos auxiliares fora dela quando o projeto exigir.

### Princípio central
- **O projeto é a autoridade** sobre o que precisa ser construído.
- A stack declarada é **guia**, não restrição. Se o projeto pedir auth e
  o aluno não listou autenticação, a IA inclui — sinalizando no
  `personalization_notes` do ticket que o tópico está fora da lista
  declarada e por quê.

### Schemas (`app/schemas/learning_trail.py`)
- `TrailCreationMode` (`topic` | `project`) — discriminante.
- `LearningTrailCreate` é discriminado por `mode`:
  - `topic`: exige `topic` (≥3 chars).
  - `project`: exige `project_scope` (≥20 chars) e `technologies` (lista
    não vazia, deduplicada case-insensitive, normalizada).
  - `assessment` é compartilhado entre os modos.
- `ProjectNextQuestionRequest`: `{ project_scope, technologies, previous_answers }`.

### Endpoints
- `POST /api/v1/learning-trails` aceita o payload discriminado; o router
  despacha pra `create_for_user` ou `create_project_for_user` conforme o
  `mode`.
- `POST /api/v1/learning-trails/assessment/project/next` com
  `{ project_scope, technologies, previous_answers }` →
  `TopicNextQuestionResponse`. Autenticado. Não persiste nada. Mesmo teto
  rígido de 5 perguntas do modo TOPIC, imposto no service.

### Persistência (`learning_trails`)
- Coluna `creation_input_json` (Text, nullable) guarda o snapshot do payload
  de criação:
  - TOPIC: `{"mode": "topic", "topic": "..."}`.
  - PROJECT: `{"mode": "project", "project_scope": "...", "technologies": [...]}`.
- `regenerate_for_user` lê esse snapshot e despacha para o método correto
  do provider (`generate_project_trail` quando mode=project). Trilhas
  legadas sem snapshot caem no fallback de modo TOPIC usando `trail.topic`
  — sem migração de dados retroativa.
- `trail.topic` no modo PROJECT é populado com o `project_title` que a IA
  retornou (rótulo curto, vai para listagens, cabeçalhos e o card da
  Dashboard).

### Provider (`AIProvider`)
- Métodos `generate_next_project_question` e `generate_project_trail`
  detalhados em §32.
- `FakeAIProvider` reaproveita o pipeline do modo TOPIC usando a primeira
  tecnologia declarada como eixo, e depois ENRIQUECE o resultado:
  - sobrescreve `project_title`/`project_summary`/`final_deliverable` com
    o escopo do aluno;
  - cicla pelas tecnologias declaradas anexando "Tecnologia praticada
    nesta etapa: X." em cada `personalization_notes`;
  - adiciona conceitos complementares ("Autenticação" quando o escopo
    menciona login/cadastro/usuário, "Testes automatizados" sempre) em
    um ticket intermediário — comprovando que o modo PROJECT cobre
    pré-requisitos fora da stack declarada.
- `AbacusAIProvider` usa `PROJECT_SYSTEM_PROMPT` +
  `build_project_user_prompt` para a trilha e
  `NEXT_PROJECT_QUESTION_SYSTEM_PROMPT` +
  `build_next_project_question_prompt` para as perguntas. Ambos os prompts
  são versionados em `prompts.py`.

### Princípios pedagógicos do prompt da trilha
- O **escopo** é citado verbatim e tratado como autoridade do que construir.
- A **stack declarada** é a espinha dorsal da implementação, mas pode (e
  deve) ser estendida quando o projeto pedir.
- O `project_title` precisa ser curto, específico e memorável — vira o
  rótulo da trilha em todas as listagens.
- `personalization_notes` cita ou (a) qual tecnologia da lista está sendo
  praticada naquele ticket, ou (b) qual resposta do diagnóstico justificou
  a decisão. Quando o assessment está presente, mais da metade dos notes
  precisa referenciá-lo (mesma regra do modo TOPIC).
- Encerramento obrigatório segue igual: o último ticket é a release final
  que entrega o projeto descrito; `final_deliverable` casa com o escopo.

### UX (frontend)
- Página `/trails/new` tem um toggle segmentado no topo: **"Por tema"** /
  **"Por projeto"**. O modo default é tema.
- Modo PROJECT mostra:
  - `TextArea` "Escopo do projeto" (mínimo 20 caracteres, hint visível).
  - Chip-input "Tecnologias que quer aprender": input + botão Adicionar,
    Enter/vírgula adicionam, dedup case-insensitive, chips removíveis via
    "×", sugestões clicáveis abaixo.
  - Dicas laterais específicas do modo (descrever em uma frase, listar
    fluxos principais, citar restrições reais, listar só o que QUER
    aprender).
- O `AssessmentModal` é reutilizado — recebe um rótulo curto derivado do
  escopo (primeira frase ou primeiros 80 chars com elipses) como o `topic`
  exibido no header, e usa `loadNextQuestion` apontando para o endpoint
  `assessment/project/next`.
- Validação cliente: escopo ≥20 chars + ≥1 tecnologia antes do submit.
  Backend (Pydantic) é a autoridade final e devolve 422.

---

## 41. BYOK — Credenciais de IA do Usuário (provider-agnóstico)

Cada usuário pode **trazer a própria API key** de IA (Bring Your Own Key) e
escolher o provedor. Um usuário pode usar Abacus enquanto outro usa OpenAI —
sem qualquer mudança de código. Quando o usuário não configura nada, o sistema
cai no provider global definido por ambiente (§32).

### Princípio central
- **Uma credencial ativa por usuário** (one-to-one). Trocar de provedor é
  sobrescrever a credencial. A chave é **write-only** pela API: entra no `PUT`,
  nunca volta.
- **Máxima proteção do segredo:** cifrado em repouso (Fernet), nunca logado,
  nunca devolvido em texto puro (a leitura expõe só `••••` + 4 últimos chars).

### Modelo (`app/models/ai_credential.py`)
- Tabela `ai_credentials`: `id`, `user_id` (FK único, cascade), `provider`
  (`abacus` | `openai`), `encrypted_api_key` (Text), `model` (nullable),
  `base_url` (nullable), timestamps. Apenas tipos portáveis (§31).
- `AI_PROVIDER_KINDS` é a fonte de verdade dos provedores suportados.
- Migration aditiva `f7a8b9c0d1e2` (nova tabela; down_revision `e6f7a8b9c0d1`).

### Criptografia (`app/core/crypto.py`)
- `encrypt_secret`/`decrypt_secret` via `cryptography.fernet.Fernet`.
- `mask_secret` devolve `••••` + últimos 4 caracteres para a UI.
- Chave Fernet derivada (SHA-256 → urlsafe-base64) de `ENCRYPTION_KEY` quando
  definida, senão de `SECRET_KEY`. Determinística: rotacionar a fonte invalida
  o que já foi cifrado (documentado).

### Schemas (`app/schemas/ai_credential.py`)
- `AICredentialUpsert` (write): `provider`, `api_key` (min 8), `model?`,
  `base_url?` (precisa começar com http/https). Valida o provider.
- `AICredentialStatus` (read): `configured`, `provider`, `model`, `base_url`,
  `key_masked`, `updated_at`. **NUNCA** expõe a chave ou o valor cifrado.

### Service / Repository
- `AICredentialRepository.upsert` cria ou substitui a credencial do usuário.
- `AICredentialService`: `get_status` (mascara), `upsert` (cifra antes de
  persistir), `delete` (404 se não houver), `build_provider` (decifra e delega
  à factory; devolve `None` quando o usuário não tem credencial → fallback).

### Endpoints (`app/api/v1/ai_credentials.py`)
- `GET /api/v1/ai-credentials` → `AICredentialStatus` (configurada ou não).
- `PUT /api/v1/ai-credentials` → cria/atualiza; devolve status mascarado.
- `DELETE /api/v1/ai-credentials` → 204 (404 se nada a remover).
- Todos autenticados; a credencial é **isolada por usuário**.

### Variáveis de ambiente
- `ENCRYPTION_KEY` (opcional; deriva de `SECRET_KEY` quando vazia).
- `AI_PROVIDER` aceita `openai` além de `abacus`/`fake`.
- `OPENAI_API_URL` (padrão `https://api.openai.com`), `OPENAI_API_KEY`,
  `OPENAI_MODEL` (padrão `gpt-4o-mini`), `OPENAI_TIMEOUT_SECONDS`. Servem ao
  provider global OpenAI e como defaults do modo BYOK `openai`.

### UX (frontend)
- Seção **"Chave de IA (BYOK)"** na página de conta, componente
  `components/account/AICredentialEditor` (autocontido, via `useAiCredential`).
- Seletor de provedor (Abacus / OpenAI), campo de chave (`type="password"`,
  write-only), modelo e base URL opcionais. Quando configurada, mostra a pílula
  **"Configurada"** + a chave mascarada + botão **Remover**.
- A chave nunca é pré-preenchida (o backend não a devolve). Atualizar exige
  reenviar a chave.

### Testes
- Backend: round-trip de cifragem, CRUD/máscara do service, montagem de provider
  por credencial, isolamento por usuário, e a API completa (incluindo que a
  chave nunca vaza na resposta).
- Frontend: estados configurado/não-configurado, validação, save e remove.
- O `FakeAIProvider` permanece o default de teste; sem credencial, o fallback
  por ambiente é preservado — **BYOK não quebra nada do fluxo existente**.

---

## 36. Como Usar Este Documento

- Antes de implementar qualquer coisa, **consulte a seção relevante**.
- Se algo não está coberto, **proponha uma adição via PR** antes de divergir.
- Code reviews devem citar a seção quando apontarem violação.
- Mudanças neste arquivo são tratadas como **mudança de contrato do projeto** e requerem PR dedicado.

---

_Última atualização: v0.4.0 — BYOK provider-agnóstico (Abacus/OpenAI): cada usuário traz a própria API key, cifrada em repouso, com fallback por ambiente preservado._
