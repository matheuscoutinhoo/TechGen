# agents.md — Regras e Padrões Oficiais do TechGen

> Este documento é a **fonte de verdade** para qualquer pessoa (humana ou agente de IA) que contribua com o projeto. Toda implementação, refatoração, code review ou geração de código deve respeitar o que está aqui. Se algo neste arquivo conflita com uma sugestão de fora, **este arquivo vence**.

---

## 1. Visão Geral do Projeto

**TechGen** é uma plataforma educacional de tecnologia movida a IA. O usuário descreve um tema que deseja aprender e o sistema gera uma **trilha de aprendizado** estruturada como um conjunto de **tickets estilo Jira**, simulando um projeto real de mercado conduzido por um Staff Software Engineer mentor.

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
- Espaçamento via tokens (`--space-1` a `--space-8`).
- Tipografia escalonada (`--font-size-sm`, `-base`, `-lg`, `-xl`, `-2xl`).
- Botões: 3 variantes — `primary`, `secondary`, `ghost`. Sempre com estado de foco visível.
- Inputs sempre com `label` associado.
- Cards: borda 1px sutil, raio 8px, sombra mínima.
- Animações discretas (≤ 200ms).

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

Inspiração estética: site oficial do FastAPI — minimalista, técnico, claro.

| Token | Valor | Uso |
|---|---|---|
| `--color-bg` | `#ffffff` | Fundo principal |
| `--color-surface` | `#fafafa` | Cards e blocos |
| `--color-text` | `#1f2933` | Texto principal |
| `--color-text-muted` | `#52606d` | Texto secundário |
| `--color-border` | `#e4e7eb` | Bordas sutis |
| `--color-primary` | `#009688` | Ação primária (teal FastAPI-like) |
| `--color-primary-strong` | `#00796b` | Hover/foco |
| `--color-accent` | `#05a37a` | Destaques pontuais |
| `--color-danger` | `#c0392b` | Erro/exclusão |
| `--color-warning` | `#b7791f` | Aviso |
| `--font-sans` | `'Inter', system-ui, sans-serif` | UI |
| `--font-mono` | `'JetBrains Mono', ui-monospace, monospace` | Código/tickets |

> Não copiar o FastAPI literalmente — apenas se inspirar.

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

## 25. Fluxo de Branches — GitFlow

| Branch | Propósito |
|---|---|
| `main` | Código em produção. Apenas merges de `release/*` ou `hotfix/*`. |
| `develop` | Integração de features. Base de novas features. |
| `feature/<slug>` | Nova feature. Sai e volta para `develop`. |
| `release/<versão>` | Estabilização para release. Sai de `develop`, vai para `main` e volta para `develop`. |
| `hotfix/<slug>` | Correção urgente em produção. Sai de `main`, vai para `main` e `develop`. |

Regras:
- Branches `feature/*` devem ser pequenas (idealmente < 400 linhas alteradas).
- Sempre rebase de `develop` antes de abrir PR.
- Tags semânticas em `main` (`v0.1.0`, `v0.2.0`...).

---

## 26. Regras de Pull Request

Todo PR deve conter:
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

PRs devem ter pelo menos **1 revisor**. PRs grandes (>800 linhas) precisam de revisão dupla.

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

## 32. Integração com Abacus AI

- Acessada **apenas** via `AbacusAIProvider`, que implementa a interface `AIProvider`.
- Usa o endpoint **RouteLLM** da Abacus em `POST {ABACUS_API_URL}/v1/chat/completions`, compatível com o contrato OpenAI Chat Completions.
- Configuração por variáveis de ambiente:
  - `ABACUS_API_URL` (padrão `https://routellm.abacus.ai`)
  - `ABACUS_API_KEY` (header `Authorization: Bearer <key>`)
  - `ABACUS_MODEL` (ex.: `gpt-5`, `claude-sonnet-4`, etc.)
  - `ABACUS_TIMEOUT_SECONDS` (padrão 60)
- Prompts ficam em `app/services/ai/prompts.py` — versionados, revisados via PR.
- Resposta esperada: `choices[0].message.content` contendo o JSON da trilha; é validado e parseado antes de virar `LearningTrail`.
- Erros do provider viram `AIProviderError` com mensagem amigável.
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
- Rate limiting é evolução futura prevista (não bloqueia v0.1).

---

## 34. Retrocompatibilidade

- Endpoints v1 não mudam contrato após release. Mudança de contrato exige novo endpoint ou versão (`/api/v2/...`).
- Schemas Pydantic não removem campos sem deprecação documentada.
- Migrations de banco são sempre aditivas no primeiro passo (adicionar coluna nullable, popular, depois constraint).

---

## 35. UX Pedagógica para Geração de Trilhas

A experiência de gerar uma trilha deve transmitir intenção pedagógica clara:

1. **Coleta de tema**: campo amplo, exemplos sugeridos, dica visível sobre o que torna um tema bom.
2. **Loading explícito**: durante a geração (que pode levar segundos), mostrar mensagem como _"O mentor está desenhando o projeto e os tickets..."_, com indicador de progresso.
3. **Resultado estruturado**:
   - Título do projeto proposto.
   - Resumo do projeto e por que ele é realista.
   - Lista ordenada de tickets, cada um expansível.
   - Cada ticket mostra: título, objetivo, conceitos abordados, tarefas, critérios de aceite.
4. **Tom**: didático e exigente. Sem infantilizar. Sem encher de emoji.
5. **Edição**: usuário pode editar título, descrição e tickets manualmente.
6. **Regeneração**: pode pedir nova versão, mantendo histórico.
7. **Leitura confortável**: largura controlada, contraste alto, espaçamento generoso.

---

## 36. Como Usar Este Documento

- Antes de implementar qualquer coisa, **consulte a seção relevante**.
- Se algo não está coberto, **proponha uma adição via PR** antes de divergir.
- Code reviews devem citar a seção quando apontarem violação.
- Mudanças neste arquivo são tratadas como **mudança de contrato do projeto** e requerem PR dedicado.

---

_Última atualização: v0.1.0_
