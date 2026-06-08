"""Provider de IA determinístico para desenvolvimento e testes.

Gera trilhas e explicações realistas, bem formadas e personalizadas, sem
chamadas externas. Útil para:
- desenvolver UI sem custo/rede;
- garantir suite de testes offline;
- demos e ambientes ephemeral.
"""
from __future__ import annotations

import hashlib
from typing import Sequence

from app.schemas.learning_trail import (
    ConceptExample,
    ConceptExplanation,
    GlossaryEntry,
    Ticket,
    TicketTask,
    TopicAnswer,
    TopicQuestion,
    TopicQuestionOption,
    TrailContent,
)
from app.services.ai.base import AIProvider, ConceptContext, UserSkillInput


# Sinais textuais que indicam baixa familiaridade na resposta — usados pelo
# FakeProvider para escolher o próximo template adaptativo e para enriquecer
# as trilhas com pré-requisitos.
_LOW_FAMILIARITY_SIGNALS = (
    "nunca",
    "não usei",
    "nao usei",
    "não conheço",
    "nao conheco",
    "primeira vez",
    "pouca",
    "pouco",
    "iniciante",
    "passo a passo",
)


def _looks_low_familiarity(text: str) -> bool:
    lowered = text.lower()
    return any(signal in lowered for signal in _LOW_FAMILIARITY_SIGNALS)


# Ordem importa: o primeiro keyword cuja substring aparece no concept vence.
# Categorias mantêm granularidade média — específicas o bastante para terem
# valor curricular, mas ainda transferíveis entre projetos.
_CATEGORY_KEYWORDS: tuple[tuple[str, tuple[str, ...]], ...] = (
    # Auth & segurança — quebrados em subáreas concretas
    ("autenticação com jwt", ("jwt", "json web token", "bearer", "access token", "refresh token")),
    ("oauth e single sign-on", ("oauth", "sso", "openid", "single sign")),
    ("criptografia e hashing de senha", ("bcrypt", "scrypt", "argon2", "hash", "salt", "criptograf")),
    ("controle de acesso", ("rbac", "permiss", "autoriz", "role", "scope")),
    ("autenticação", ("auth", "login", "senha", "token")),
    ("segurança de aplicações web", ("seguran", "owasp", "vulnerab", "csrf", "xss", "sqli", "injection")),
    # Persistência — separado por aspecto
    ("migrations e versionamento de schema", ("migration", "alembic", "flyway", "schema versão", "schema versao")),
    ("queries sql", ("query", "queries", "select", "join", "índice", "indice", "transac")),
    ("modelagem relacional", ("modelagem", "modelo de dados", "tabela", "relacional", "normaliza")),
    ("camada de persistência", ("repository", "dao", "orm", "active record")),
    ("queries sql", ("sql",)),
    ("banco de dados", ("banco", "database", "postgres", "mysql", "sqlite", "mongo")),
    # API
    ("design de api rest", ("rest", "endpoint", "rota", "router", "fastapi", "express", "verbo http")),
    ("documentação de api", ("openapi", "swagger", "documentação de api", "documentacao de api")),
    ("validação de input", ("validação", "validacao", "pydantic", "schema de entrada", "input")),
    ("api rest", (" api ",)),
    ("graphql", ("graphql",)),
    # Testes
    ("tdd e refatoração", ("tdd", "red", "refactor", "refator", "code smell")),
    ("testes de integração", ("teste de integ", "test de integ", "end-to-end", "ponta a ponta")),
    ("testes unitários", ("teste unit", "test unit", "mock", "stub", "fake", "pytest", "jest", "cobertura", "arrange-act-assert", "test")),
    # Arquitetura
    ("arquitetura em camadas", ("camad", "boundary", "clean arch", "hexagonal", "ports and adapters")),
    ("modelagem de domínio", ("domín", "domin", "ddd", "linguagem ub", "ubíqua", "ubiqua", "entidade", "valor", "agregado")),
    ("tratamento de erros", ("erro de domínio", "erro de dominio", "exception", "exceção", "excecao", "tratamento de erro")),
    ("arquitetura de software", ("solid", "dry", "pattern")),
    # Infra / devops
    ("containerização com docker", ("docker", "container", "dockerfile", "compose")),
    ("ci/cd", ("ci/cd", "ci ", "cd ", "github actions", "gitlab ci", "pipeline", "deploy")),
    ("orquestração com kubernetes", ("kubernetes", "k8s", "helm")),
    # Observabilidade
    ("logs estruturados", ("log",)),
    ("métricas e observabilidade", ("métrica", "metrica", "telemetria", "trace", "monitor", "prometheus", "grafana")),
    # Linguagens & front
    ("versionamento com git", ("git", "branch", "commit", "merge", "rebase")),
    ("tipagem estática", ("tipagem", "type hint", "typescript", "mypy", " ts ")),
    ("async e concorrência", ("async", "await", "concurrency", "thread", "asyncio")),
    ("python", ("python", "django", "flask")),
    ("javascript", ("javascript", " js ", "node")),
    ("react", ("react",)),
    ("vue", ("vue",)),
    ("gerenciamento de estado", ("redux", "zustand", "estado global", "state manag")),
    ("css e design system", ("css", "design system", "tokens de design", "tailwind", "styled")),
    ("acessibilidade web", ("aria", "acessibilidade", "wcag")),
    ("frontend", ("frontend", "ui", "ux", "html", "componente")),
    # Qualidade
    ("qualidade de código e revisão", ("code review", "linter", "definition of done", "demo", "qualidade")),
    # Fundamentos (fallback didático para setup/pré-requisitos)
    ("fundamentos da stack", ("fundament", "pré-requisito", "pre-requisito", "setup", "ambiente", "dependência", "dependencia", "build")),
)


def _categorize_one(concept: str) -> str:
    """Retorna a primeira categoria cujo keyword aparece no concept."""
    # Acrescenta espaços nas pontas para permitir matches por palavra inteira.
    lowered = f" {concept.lower()} "
    for category, keywords in _CATEGORY_KEYWORDS:
        for keyword in keywords:
            if keyword in lowered:
                return category
    # Sem match: cai em "fundamentos da stack" — categoria genérica menos
    # quebradiça que repetir o concept inteiro.
    return "fundamentos da stack"


def _personalization_for(
    concepts: Sequence[str],
    skills: Sequence[UserSkillInput],
    assessment: Sequence[TopicAnswer] = (),
) -> str:
    parts: list[str] = []
    if not skills:
        parts.append(
            "Sem skills declaradas: este ticket parte do zero e explica todos "
            "os conceitos envolvidos."
        )
    else:
        by_name = {skill.name.lower(): skill for skill in skills}
        for concept in concepts:
            match = by_name.get(concept.lower())
            if match is None:
                parts.append(f"'{concept}' será apresentado do zero.")
            elif match.level >= 3:
                parts.append(
                    f"Você já usa '{concept}' confortavelmente — vamos focar em "
                    "trade-offs e otimizações."
                )
            elif match.level == 2:
                parts.append(
                    f"Você já mexeu em '{concept}'; revisaremos rápido e iremos ao uso real."
                )
            else:
                parts.append(
                    f"Você ouviu falar de '{concept}'; explicaremos com calma."
                )
    if assessment:
        first = assessment[0]
        parts.append(
            f"No diagnóstico, você respondeu '{first.answer}' — calibramos o "
            "ticket por isso."
        )
    return " ".join(parts)


# Cada template tem um "trigger" — uma função que decide se ele é a melhor
# próxima pergunta dado o histórico. Ordem importa: o primeiro template cujo
# trigger casar e que ainda não foi usado é o escolhido.
_QUESTION_TEMPLATES: list[dict] = [
    {
        "key": "familiarity",
        "trigger": lambda history: len(history) == 0,
        "question": "Você já trabalhou com {topic} antes?",
        "rationale": "Mede familiaridade direta com o tema (primeiro eixo).",
        "options": [
            {"id": "a", "label": "Nunca usei {topic}"},
            {"id": "b", "label": "Já li sobre, mas nunca apliquei"},
            {"id": "c", "label": "Já fiz um projeto pequeno usando {topic}"},
            {"id": "d", "label": "Uso {topic} no dia a dia"},
        ],
    },
    {
        "key": "fundamentals",
        # Disparado quando a resposta anterior indica baixa familiaridade.
        "trigger": lambda history: bool(history)
        and _looks_low_familiarity(history[-1].answer),
        "question": "Você se sente confortável com a linguagem/base necessária para {topic}?",
        "rationale": (
            "Aluno sinalizou pouca familiaridade — preciso verificar o pré-requisito "
            "fundacional antes de subir o nível."
        ),
        "options": [
            {"id": "a", "label": "Estou começando do zero"},
            {"id": "b", "label": "Já fiz alguns exercícios"},
            {"id": "c", "label": "Já tenho prática consolidada"},
        ],
    },
    {
        "key": "advanced",
        # Quando a resposta anterior indica fluência, subimos o nível.
        "trigger": lambda history: bool(history)
        and not _looks_low_familiarity(history[-1].answer),
        "question": "Quando você usa {topic}, você costuma pensar em quais trade-offs?",
        "rationale": (
            "Aluno mostrou domínio — calibro o nível subindo para decisões de "
            "arquitetura."
        ),
        "options": [
            {"id": "a", "label": "Sigo o padrão da equipe sem questionar"},
            {"id": "b", "label": "Penso em performance e legibilidade"},
            {"id": "c", "label": "Avalio trade-offs entre acoplamento, performance e custo"},
        ],
    },
    {
        "key": "goal",
        "trigger": lambda history: len(history) >= 1,
        "question": "Qual é seu objetivo principal aprendendo {topic}?",
        "rationale": "Calibra o cenário do projeto (estudo, trabalho, entrevista).",
        "options": [
            {"id": "a", "label": "Curiosidade pessoal"},
            {"id": "b", "label": "Aplicar em um projeto real do trabalho"},
            {"id": "c", "label": "Preparar para entrevista técnica"},
            {"id": "d", "label": "Liderar um time que usa {topic}"},
        ],
    },
    {
        "key": "testing",
        "trigger": lambda history: len(history) >= 2,
        "question": "Você está confortável com testes automatizados ao construir {topic}?",
        "rationale": "Decide se cobrimos TDD do zero ou só citamos.",
        "options": [
            {"id": "a", "label": "Nunca escrevi um teste"},
            {"id": "b", "label": "Já escrevi alguns, mas sem disciplina"},
            {"id": "c", "label": "Escrevo testes para o caminho feliz"},
            {"id": "d", "label": "Pratico TDD com frequência"},
        ],
    },
]


_TICKET_TEMPLATES = [
    {
        "title_pattern": "Setup do ambiente para {topic}",
        "objective": (
            "Preparar o ambiente de desenvolvimento, instalar dependências e "
            "validar o ciclo de build/run/test mais simples possível."
        ),
        "concepts": ["Ambiente de desenvolvimento", "Gerenciamento de dependências"],
        "tasks": [
            "Criar o repositório local",
            "Instalar dependências mínimas",
            "Executar o 'hello world' do stack",
        ],
        "acceptance": [
            "Comando de execução roda sem erros",
            "Repositório versionado com commit inicial",
        ],
    },
    {
        "title_pattern": "Modelagem do domínio de {topic}",
        "objective": (
            "Identificar as entidades principais, seus relacionamentos e o "
            "vocabulário ubíquo do domínio."
        ),
        "concepts": ["Modelagem de domínio", "Linguagem ubíqua", "Entidades vs. valor"],
        "tasks": [
            "Listar entidades-chave",
            "Desenhar diagrama simplificado de relacionamentos",
            "Documentar termos no README",
        ],
        "acceptance": [
            "Diagrama publicado no repositório",
            "Glossário inicial criado",
        ],
    },
    {
        "title_pattern": "Primeiro caso de uso com TDD",
        "objective": (
            "Implementar o caso de uso mais simples usando o ciclo "
            "Red → Green → Refactor."
        ),
        "concepts": ["TDD", "Arrange-Act-Assert", "Refatoração segura"],
        "tasks": [
            "Escrever o teste que falha",
            "Implementar o mínimo para passar",
            "Refatorar mantendo a suite verde",
        ],
        "acceptance": [
            "Pelo menos um teste unitário verde",
            "Cobertura do caso de uso documentada",
        ],
    },
    {
        "title_pattern": "Persistência e camada de dados",
        "objective": (
            "Introduzir persistência respeitando a separação de camadas "
            "(repository pattern)."
        ),
        "concepts": ["Repository", "Mapping objeto-relacional", "Migrations"],
        "tasks": [
            "Modelar a tabela inicial",
            "Implementar repositório com create/read",
            "Adicionar testes de integração",
        ],
        "acceptance": [
            "Migrations versionadas",
            "Teste de integração lendo e escrevendo do banco",
        ],
    },
    {
        "title_pattern": "Camada de API/Interface",
        "objective": (
            "Expor o caso de uso por uma interface clara (HTTP/CLI/UI) com "
            "validação de entrada e tratamento de erro."
        ),
        "concepts": ["Boundary", "Validação", "Erros de domínio"],
        "tasks": [
            "Mapear endpoint/comando para o caso de uso",
            "Validar entrada",
            "Padronizar resposta de erro",
        ],
        "acceptance": [
            "Caso feliz coberto por teste",
            "Erro de validação coberto por teste",
        ],
    },
    {
        "title_pattern": "Observabilidade e logs",
        "objective": (
            "Adicionar logs significativos e métricas mínimas para investigar "
            "problemas em produção."
        ),
        "concepts": ["Logging estruturado", "Níveis de log", "Telemetria mínima"],
        "tasks": [
            "Configurar logger central",
            "Logar entrada/saída do caso de uso",
            "Adicionar contador de execuções (in-memory ou real)",
        ],
        "acceptance": [
            "Log presente em níveis adequados",
            "Sem segredos vazando em log",
        ],
    },
    {
        "title_pattern": "Refatoração e código limpo",
        "objective": (
            "Refinar a estrutura, eliminar duplicações e aplicar princípios "
            "SOLID quando fizerem sentido — sem over-engineering."
        ),
        "concepts": ["SOLID", "DRY", "Code smells", "Refatorações canônicas"],
        "tasks": [
            "Identificar code smells",
            "Extrair funções/classes claras",
            "Garantir suite verde após cada refatoração",
        ],
        "acceptance": [
            "Cobertura mantida ou ampliada",
            "Sem regressões",
        ],
    },
    {
        "title_pattern": "Empacotamento e entrega",
        "objective": (
            "Preparar a aplicação para ser distribuída/executada por outras "
            "pessoas com instruções claras."
        ),
        "concepts": ["Build reprodutível", "Documentação de uso", "Versionamento"],
        "tasks": [
            "Adicionar script/imagem de build",
            "Escrever instruções de uso no README",
            "Etiquetar versão inicial",
        ],
        "acceptance": [
            "Outra pessoa consegue rodar seguindo o README",
            "Tag v0.1.0 criada",
        ],
    },
]


# Template OBRIGATÓRIO do último ticket: realiza a entrega descrita em
# `project_summary`. Tem placeholder {topic} para personalização.
_CAPSTONE_TEMPLATE: dict = {
    "title_pattern": "Release final: {topic} rodando de ponta a ponta",
    "objective_pattern": (
        "Validar que o projeto descrito no resumo está funcionando end-to-end "
        "na sua máquina e que outra pessoa consegue reproduzir a demo a partir "
        "do README. Nenhuma funcionalidade declarada no resumo pode estar "
        "pendente — o que faltar precisa ser fechado neste ticket."
    ),
    "concepts": [
        "Validação end-to-end",
        "Definition of Done",
        "Demo reprodutível",
    ],
    "tasks": [
        "Executar o fluxo principal descrito no resumo do projeto, do início ao fim",
        "Rodar a suite de testes completa e garantir tudo verde",
        "Atualizar o README com os comandos para reproduzir a demo",
        "Gravar (ou roteirizar) um walkthrough de 2 minutos cobrindo o cenário do resumo",
        "Etiquetar o repositório com a tag v1.0",
    ],
    "acceptance": [
        "Todos os cenários listados em `project_summary` rodam sem erro na sua máquina",
        "Outra pessoa consegue subir o projeto seguindo o README em menos de 10 minutos",
        "Tag v1.0 criada no repositório",
        "Suite de testes 100% verde",
    ],
}


def _capstone_deliverable_for(topic: str) -> str:
    return (
        f"Ao final desta trilha você terá **{topic}** rodando na sua máquina, "
        "com README documentando como subir, suite de testes verde e tag v1.0 "
        "no repositório — pronto para outra pessoa clonar e reproduzir."
    )


class FakeAIProvider(AIProvider):
    # Teto duro de perguntas no fake provider — service também limita.
    MAX_QUESTIONS = 5

    def generate_next_topic_question(
        self,
        topic: str,
        *,
        skills: Sequence[UserSkillInput] = (),
        previous_answers: Sequence[TopicAnswer] = (),
    ) -> TopicQuestion | None:
        safe_topic = topic.strip() or "Tecnologia"
        asked_count = len(previous_answers)

        if asked_count >= self.MAX_QUESTIONS:
            return None

        # Decisão de parar antecipadamente baseada no histórico:
        # se a primeira resposta indica fluência alta E a segunda confirma,
        # 3 perguntas são suficientes.
        if asked_count >= 3:
            return None

        used_keys = {self._template_key_for(a, i) for i, a in enumerate(previous_answers)}
        history = list(previous_answers)

        chosen = None
        for template in _QUESTION_TEMPLATES:
            if template["key"] in used_keys:
                continue
            if template["trigger"](history):
                chosen = template
                break
        if chosen is None:
            # Sem trigger compatível e ainda abaixo do teto → encerra.
            return None

        return self._make_question(asked_count + 1, safe_topic, chosen)

    @staticmethod
    def _template_key_for(answer: TopicAnswer, index: int) -> str:
        """Heurística para descobrir qual template gerou cada resposta passada.

        O FakeProvider é determinístico, então usamos a posição + o sinal de
        baixa familiaridade para reconstruir a chave. Suficiente para evitar
        repetição em testes; o provider real recebe a chave direto da IA.
        """
        if index == 0:
            return "familiarity"
        if _looks_low_familiarity(answer.answer):
            return "fundamentals"
        return "advanced"

    def generate_learning_trail(
        self,
        topic: str,
        *,
        skills: Sequence[UserSkillInput] = (),
        assessment: Sequence[TopicAnswer] = (),
    ) -> TrailContent:
        safe_topic = topic.strip().rstrip(".") or "Tecnologia"
        seed = int(hashlib.sha256(safe_topic.encode("utf-8")).hexdigest()[:6], 16)

        # Detecta se o diagnóstico revelou falta de pré-requisito da stack
        # principal — sinal que vamos enxergar mais à frente para enxertar
        # tickets fundacionais ANTES dos avançados.
        low_familiarity_signals = [
            a for a in assessment if _looks_low_familiarity(a.answer)
        ]
        needs_foundation = bool(low_familiarity_signals)

        # Dimensiona pelo nível: aluno iniciante recebe trilha mais granular
        # (12–15 tickets) para dissecar o tema; aluno fluente recebe 6–9.
        # Respeita o teto de 20 imposto pelo prompt.
        if needs_foundation:
            ticket_count = min(12 + (seed % 4), 20)  # 12 a 15
        else:
            ticket_count = 6 + (seed % 4)  # 6 a 9

        if needs_foundation:
            # Quando o aluno é iniciante no tema, montamos a trilha em modo
            # fundacional: tickets extras de pré-requisito antes dos templates
            # genéricos, e quase todos os notes citam a resposta do aluno.
            tickets = self._build_foundation_first_tickets(
                safe_topic, skills, assessment, ticket_count
            )
        else:
            # Body = todos menos o último; o último é SEMPRE o capstone que
            # entrega o projeto descrito em project_summary.
            body_count = max(ticket_count - 1, 1)
            body = [
                self._make_ticket(i, safe_topic, skills, assessment)
                for i in range(1, body_count + 1)
            ]
            capstone = self._make_capstone_ticket(
                code=f"TG-{body_count + 1}",
                topic=safe_topic,
                skills=skills,
                assessment=assessment,
            )
            tickets = [*body, capstone]

        audience_suffix = ""
        if skills:
            top = ", ".join(
                f"{s.name} ({s.label})"
                for s in sorted(skills, key=lambda s: -s.level)[:3]
            )
            audience_suffix = f" Calibrada para um perfil com: {top}."
        if assessment:
            audience_suffix += (
                f" Diagnóstico inicial considerou {len(assessment)} resposta(s)."
            )
            if needs_foundation:
                audience_suffix += (
                    " Pré-requisitos da stack estão cobertos nos primeiros tickets."
                )

        return TrailContent(
            project_title=f"Plataforma prática de {safe_topic}",
            project_summary=(
                f"Você construirá, do zero, uma aplicação realista de {safe_topic}, "
                "passando por modelagem, implementação, testes e empacotamento. "
                "Cada etapa entrega um incremento utilizável e reforça os fundamentos "
                "necessários para a próxima."
            ),
            why_realistic=(
                "O projeto reproduz desafios encontrados em times de produto de mercado: "
                "decisões de arquitetura, trade-offs, testes automatizados e evolução "
                "incremental — sem atalhos pedagógicos."
            ),
            target_audience=(
                "Pessoas desenvolvedoras com conhecimento básico de programação que "
                f"desejam dominar {safe_topic} construindo um projeto real."
                f"{audience_suffix}"
            ),
            prerequisites=[
                "Lógica de programação",
                "Git básico (clone, branch, commit)",
                "Linha de comando",
            ],
            final_deliverable=_capstone_deliverable_for(safe_topic),
            tickets=tickets,
        )

    @staticmethod
    def _build_foundation_first_tickets(
        topic: str,
        skills: Sequence[UserSkillInput],
        assessment: Sequence[TopicAnswer],
        total: int,
    ) -> list[Ticket]:
        """Monta tickets com fundação extra quando o diagnóstico revela lacunas.

        Diferenças observáveis em relação à versão "normal":
        - Adiciona um ticket TG-1 **explicitamente** fundacional ("primeiros
          passos com {topic}") que cita a resposta do aluno;
        - Acrescenta o conceito "Pré-requisitos da stack" no segundo ticket;
        - Todos os tickets ganham `personalization_notes` mencionando a
          resposta de baixa familiaridade.
        """
        low_answer = next(
            (a for a in assessment if _looks_low_familiarity(a.answer)), None
        )
        anchor = (
            f"você respondeu \"{low_answer.answer}\""
            if low_answer is not None
            else "diagnóstico inicial"
        )

        foundation = Ticket(
            code="TG-1",
            title=f"Primeiros passos guiados com {topic}",
            objective=(
                f"Cobrir os pré-requisitos mínimos de {topic} com um exercício "
                "linear, do zero, antes de partir para arquitetura."
            ),
            personalization_notes=(
                f"Adicionado porque, no diagnóstico, {anchor} — então este "
                "ticket existe SÓ para garantir que você tem base suficiente "
                "para os próximos passos."
            ),
            concepts=[
                f"Fundamentos de {topic}",
                "Pré-requisitos da stack",
                "Setup guiado",
            ],
            tasks=[
                TicketTask(description=f"Subir o ambiente mínimo de {topic} seguindo a documentação oficial"),
                TicketTask(description="Rodar o exemplo 'hello world' canônico"),
                TicketTask(description="Anotar dúvidas para revisitar nos próximos tickets"),
            ],
            acceptance_criteria=[
                "Exemplo canônico roda sem erros no seu ambiente",
                "Você consegue explicar em 3 frases o que esse exemplo faz",
            ],
            estimated_effort="2h",
        )

        # Body intermediário: entre foundation (TG-1) e capstone (último).
        # Garantimos pelo menos 1 body ticket para a progressão fazer sentido.
        body_count = max(total - 2, 1)
        body = [
            FakeAIProvider._make_ticket(
                i + 1, topic, skills, assessment, foundation_anchor=anchor
            )
            for i in range(body_count)
        ]
        capstone = FakeAIProvider._make_capstone_ticket(
            code=f"TG-{len(body) + 2}",
            topic=topic,
            skills=skills,
            assessment=assessment,
            foundation_anchor=anchor,
        )
        return [foundation, *body, capstone]

    def explain_concept(
        self,
        concept: str,
        *,
        context: ConceptContext,
        skills: Sequence[UserSkillInput] = (),
    ) -> ConceptExplanation:
        focused_skill = next(
            (s for s in skills if s.name.lower() == concept.lower()), None
        )
        if focused_skill and focused_skill.level >= 3:
            level_note = (
                f"Como você já está em nível **{focused_skill.label}**, vamos focar "
                "nos trade-offs e padrões avançados."
            )
        elif focused_skill and focused_skill.level == 2:
            level_note = (
                "Você já experimentou esse conceito; vamos consolidar e ir além do básico."
            )
        else:
            level_note = (
                "Vamos começar definindo o conceito com calma e exemplos do dia a dia."
            )

        slug = concept.lower().replace(" ", "_").replace("-", "_")
        return ConceptExplanation(
            concept=concept,
            definition=(
                f"**{concept}** é uma ideia que aparece quando você precisa organizar "
                "uma parte do código que cresce rápido. Em palavras simples: é uma "
                "==forma idiomática== de resolver um problema recorrente, com vocabulário "
                f"e estrutura próprios. {level_note} Pense nele como uma `peça de "
                "lego` que se encaixa em outras peças do seu projeto."
            ),
            why_it_matters=(
                f"No contexto de '{context.ticket_title}' (parte do projeto "
                f"'{context.project_title}'), dominar **{concept}** é o que diferencia "
                "uma solução que funciona hoje de uma que continua funcionando quando "
                "o sistema cresce."
            ),
            patterns=[
                f"Uso clássico de **{concept}** com responsabilidades bem separadas.",
                f"Combinação de **{concept}** com testes automatizados.",
                "Variação simplificada quando o contexto é pequeno demais para "
                "justificar a forma completa.",
            ],
            examples=[
                ConceptExample(
                    title="Catálogo de livros de uma biblioteca",
                    description=(
                        "Imagine um app que lista livros. O conceito aparece quando "
                        "você separa **quem busca os livros** de **quem decide o que "
                        "mostrar na tela**."
                    ),
                    code=(
                        "# domínio análogo: catálogo de livros\n"
                        f"def {slug}_no_catalogo(repo):\n"
                        '    livros = repo.buscar(termo="ficção")\n'
                        "    return [l for l in livros if l.disponivel]\n"
                    ),
                ),
                ConceptExample(
                    title="Pedido de uma cafeteria",
                    description=(
                        "Numa cafeteria, o atendente faz o pedido (==intenção==), o "
                        "barista prepara (==execução==), e o caixa cobra (==registro==). "
                        f"**{concept}** é o que mantém esses papéis claros."
                    ),
                    code=None,
                ),
            ],
            tips=[
                "Comece com o caso mais simples e refatore quando o segundo aparecer.",
                "Escreva o teste **antes** de criar a abstração — ele guia o desenho.",
                "Documente em uma frase qual problema o conceito resolve no seu README.",
                "Releia o ticket após cada commit para garantir alinhamento.",
            ],
            pitfalls=[
                f"Aplicar **{concept}** sem entender qual problema ele resolve.",
                "Acoplar a abstração a detalhes de banco/HTTP/framework.",
                "Ignorar testes ao introduzir o conceito — a refatoração fica arriscada.",
            ],
            hands_on_steps=[
                f"Crie um arquivo isolado para experimentar **{concept}** fora do projeto principal.",
                "Defina a `interface` ou contrato mínimo que o conceito exige.",
                "Implemente a versão mais simples possível, sem se preocupar com casos extremos.",
                "Escreva um teste cobrindo o caminho feliz e rode com `pytest` (ou equivalente).",
                "Refatore movendo o código para o projeto, mantendo a suite verde.",
            ],
            further_reading=[
                f"História e motivação de **{concept}**",
                f"Anti-padrões comuns ao usar **{concept}**",
                f"Variantes modernas de **{concept}**",
            ],
            glossary=[
                GlossaryEntry(
                    term="interface",
                    brief=(
                        "Um **contrato** que diz quais métodos uma classe precisa "
                        "ter, sem dizer como implementá-los."
                    ),
                ),
                GlossaryEntry(
                    term="pytest",
                    brief=(
                        "Ferramenta padrão para escrever e rodar testes em Python. "
                        "Roda no terminal com o comando `pytest`."
                    ),
                ),
            ],
        )

    def categorize_concepts(self, concepts: Sequence[str]) -> list[str]:
        """Mapeia concepts específicos em poucas categorias genéricas.

        Determinístico (sem rede): para cada concept, encontra a primeira
        categoria do ``_CATEGORY_KEYWORDS`` cujo keyword aparece como
        substring (case-insensitive) no texto. Concepts sem keyword caem
        em "fundamentos".
        """
        seen: set[str] = set()
        out: list[str] = []
        for concept in concepts:
            if not concept or not concept.strip():
                continue
            category = _categorize_one(concept)
            if category in seen:
                continue
            seen.add(category)
            out.append(category)
        return out

    @staticmethod
    def _make_ticket(
        index: int,
        topic: str,
        skills: Sequence[UserSkillInput],
        assessment: Sequence[TopicAnswer] = (),
        *,
        foundation_anchor: str | None = None,
    ) -> Ticket:
        spec = _TICKET_TEMPLATES[(index - 1) % len(_TICKET_TEMPLATES)]
        concepts = list(spec["concepts"])
        notes = _personalization_for(concepts, skills, assessment)
        if foundation_anchor:
            notes = (
                f"Sequência calibrada porque {foundation_anchor} no diagnóstico — "
                f"{notes}"
            )
        return Ticket(
            code=f"TG-{index}",
            title=spec["title_pattern"].format(topic=topic),
            objective=spec["objective"],
            personalization_notes=notes,
            concepts=concepts,
            tasks=[TicketTask(description=task) for task in spec["tasks"]],
            acceptance_criteria=list(spec["acceptance"]),
            estimated_effort="2h",
        )

    @staticmethod
    def _make_capstone_ticket(
        *,
        code: str,
        topic: str,
        skills: Sequence[UserSkillInput],
        assessment: Sequence[TopicAnswer] = (),
        foundation_anchor: str | None = None,
    ) -> Ticket:
        """Cria o ticket OBRIGATÓRIO de encerramento: entrega o projeto.

        Sempre o último ticket da trilha. Garante que o aluno realmente
        finaliza no estágio de entrega definido em `project_summary`/
        `final_deliverable`, ao invés de parar em refatoração/observabilidade
        ou em "próximos passos".
        """
        spec = _CAPSTONE_TEMPLATE
        concepts = list(spec["concepts"])
        notes = _personalization_for(concepts, skills, assessment)
        delivery_note = (
            f"Este é o ticket de ENTREGA do projeto: ao fechá-lo, você terá "
            f"{topic} rodando end-to-end exatamente como o resumo do projeto "
            "descreve."
        )
        if foundation_anchor:
            notes = (
                f"{delivery_note} Sequência calibrada porque {foundation_anchor} "
                f"no diagnóstico — {notes}"
            )
        else:
            notes = f"{delivery_note} {notes}"
        return Ticket(
            code=code,
            title=spec["title_pattern"].format(topic=topic),
            objective=spec["objective_pattern"].format(topic=topic),
            personalization_notes=notes,
            concepts=concepts,
            tasks=[TicketTask(description=task) for task in spec["tasks"]],
            acceptance_criteria=list(spec["acceptance"]),
            estimated_effort="3h",
        )

    @staticmethod
    def _make_question(index: int, topic: str, spec: dict) -> TopicQuestion:
        options = [
            TopicQuestionOption(id=opt["id"], label=opt["label"].format(topic=topic))
            for opt in spec["options"]
        ]
        return TopicQuestion(
            id=f"q{index}",
            question=spec["question"].format(topic=topic),
            rationale=spec["rationale"],
            options=options,
        )
