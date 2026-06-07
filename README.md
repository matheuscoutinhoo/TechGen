# TechGen

Plataforma educacional de tecnologia movida a IA. O usuário descreve um tema e o sistema gera uma **trilha de aprendizado** estruturada como tickets estilo Jira, simulando um projeto real conduzido por um Staff Software Engineer mentor.

> Antes de qualquer contribuição, leia [agents.md](./agents.md) — é a fonte oficial de regras, padrões e Definition of Done do projeto.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18, TypeScript, Vite, React Router, CSS Modules |
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2, Pydantic v2 |
| Banco | SQLite (inicial), preparado para PostgreSQL |
| IA | Abacus AI (provider abstraído) |
| Testes | pytest + httpx (backend), Vitest + React Testing Library (frontend) |
| Auth | JWT (HS256) + bcrypt |
| VCS | Git (trunk-based em `develop`, releases via `release/*`) |

---

## Estrutura

```
TechGen/
├── agents.md           # Regras oficiais do projeto
├── README.md
├── backend/            # FastAPI + SQLite
└── frontend/           # React + TypeScript + Vite
```

---

## Requisitos

- **Python** 3.11+
- **Node.js** 20+
- **npm** 10+
- **Git** 2.30+

---

## Setup — Backend

```powershell
cd backend

# 1. Criar ambiente virtual
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# 2. Instalar dependências
pip install -r requirements.txt

# 3. Copiar variáveis de ambiente
Copy-Item .env.example .env
# editar .env e preencher SECRET_KEY e credenciais da Abacus AI

# 4. Subir o servidor
uvicorn app.main:app --reload --port 8000
```

Documentação interativa da API: <http://localhost:8000/docs>

### Variáveis de ambiente — backend

| Variável | Descrição | Padrão |
|---|---|---|
| `DATABASE_URL` | URL do banco | `sqlite:///./techgen.db` |
| `SECRET_KEY` | Chave usada para assinar JWT | _obrigatória_ |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Expiração do token | `60` |
| `ALLOWED_ORIGINS` | Origens CORS permitidas (CSV) | `http://localhost:5173` |
| `ABACUS_API_URL` | URL base da API Abacus (RouteLLM) | `https://routellm.abacus.ai` |
| `ABACUS_API_KEY` | API key Abacus | _obrigatória em produção_ |
| `ABACUS_MODEL` | Modelo usado no chat completions | `gpt-5` |
| `ABACUS_TIMEOUT_SECONDS` | Timeout HTTP em segundos | `60` |
| `AI_PROVIDER` | `abacus` ou `fake` (para dev/teste) | `abacus` |

> Em desenvolvimento, basta deixar `AI_PROVIDER=fake` para usar o provider determinístico (sem custo nem rede).

### Rodar testes — backend

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pytest                       # tudo
pytest tests/unit            # só unitários
pytest tests/integration     # só integração
pytest --cov=app --cov-report=term-missing
```

---

## Setup — Frontend

```powershell
cd frontend

# 1. Instalar dependências
npm install

# 2. Copiar variáveis de ambiente
Copy-Item .env.example .env

# 3. Subir o dev server
npm run dev
```

App em <http://localhost:5173>

### Variáveis de ambiente — frontend

| Variável | Descrição | Padrão |
|---|---|---|
| `VITE_API_BASE_URL` | URL do backend | `http://localhost:8000/api/v1` |

### Rodar testes — frontend

```powershell
cd frontend
npm test              # modo watch
npm run test:run      # uma rodada (CI)
npm run test:coverage # com cobertura
```

---

## Comandos úteis

| Onde | Comando | O que faz |
|---|---|---|
| backend/ | `uvicorn app.main:app --reload` | sobe API em modo dev |
| backend/ | `pytest` | roda todos os testes |
| backend/ | `pytest -k auth` | só testes que casam com "auth" |
| frontend/ | `npm run dev` | dev server |
| frontend/ | `npm run build` | build de produção |
| frontend/ | `npm run lint` | lint |
| frontend/ | `npm test` | testes em watch |

---

## Fluxo de desenvolvimento (trunk-based em `develop`)

```
main        ────────●────────────●─────  (releases / hotfixes)
                    /            /
develop  ──●──●──●────●───●───●────────  (branch de trabalho diário)
```

1. Sempre comece sincronizado:
   ```powershell
   git checkout develop
   git pull --rebase origin develop
   ```
2. Edite, rode `pytest` / `npm run test:run` (devem estar verdes), commite em Conventional Commits (`feat`, `fix`, `test`, `docs`, `refactor`, `chore`, `perf`, `style`).
3. Push direto em `develop`:
   ```powershell
   git push origin develop
   ```
4. **Sem branches `feature/*`**. PR continua sendo a porta de entrada apenas para `release/* → main` e `hotfix/* → main`. Detalhes em [agents.md §25](./agents.md).

---

## Decisões arquiteturais (resumo)

| Decisão | Justificativa |
|---|---|
| Camadas API / Service / Repository | Testabilidade, baixa acoplagem, fácil substituição de qualquer camada |
| AIProvider como interface | Permite trocar Abacus por outro fornecedor sem tocar em service ou rota |
| SQLAlchemy 2.x com tipos genéricos | Mesma base de código serve SQLite e PostgreSQL |
| Alembic configurado desde o início | Migração futura para Postgres exige zero refatoração estrutural |
| CSS Modules + design tokens | Zero dependência de framework de UI, identidade própria, build leve |
| Context API para auth + hooks para dados | Estado mínimo, evita complexidade prematura; migração para TanStack Query prevista como evolução |
| TDD obrigatório | Garante regressão controlada e desenho dirigido por uso |
| Conventional Commits + trunk-based em `develop` | Histórico legal e linear; releases previsíveis via `release/*` |

Detalhamento completo em [agents.md](./agents.md).

---

## Roadmap inicial

- [x] Estrutura base de frontend e backend
- [x] Autenticação e gerenciamento de conta
- [x] Geração, edição e exclusão de trilhas via IA (Abacus)
- [x] Suite de testes (TDD)
- [ ] Pipeline CI (GitHub Actions)
- [ ] Migração para PostgreSQL
- [ ] Histórico de regenerações com diff visual
- [ ] Compartilhamento público de trilhas

---

## Licença

Uso interno / educacional. Defina antes de publicar.
