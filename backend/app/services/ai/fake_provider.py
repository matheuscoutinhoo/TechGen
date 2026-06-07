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
    TrailContent,
)
from app.services.ai.base import AIProvider, ConceptContext, UserSkillInput


def _personalization_for(
    concepts: Sequence[str], skills: Sequence[UserSkillInput]
) -> str:
    if not skills:
        return (
            "Sem skills declaradas: este ticket parte do zero e explica todos "
            "os conceitos envolvidos."
        )
    by_name = {skill.name.lower(): skill for skill in skills}
    notes: list[str] = []
    for concept in concepts:
        match = by_name.get(concept.lower())
        if match is None:
            notes.append(f"'{concept}' será apresentado do zero.")
        elif match.level >= 3:
            notes.append(
                f"Você já usa '{concept}' confortavelmente — vamos focar em "
                "trade-offs e otimizações."
            )
        elif match.level == 2:
            notes.append(
                f"Você já mexeu em '{concept}'; revisaremos rápido e iremos ao uso real."
            )
        else:
            notes.append(f"Você ouviu falar de '{concept}'; explicaremos com calma.")
    return " ".join(notes)


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
    {
        "title_pattern": "Próximos passos e evolução",
        "objective": (
            "Mapear evoluções possíveis (escalabilidade, segurança, novas "
            "funcionalidades) e priorizar o que faz sentido a seguir."
        ),
        "concepts": ["Roadmap", "Trade-offs", "Custos de evolução"],
        "tasks": [
            "Listar débitos técnicos conhecidos",
            "Listar 3 melhorias com maior ROI",
            "Documentar decisão de priorização",
        ],
        "acceptance": [
            "Roadmap publicado no repositório",
        ],
    },
]


class FakeAIProvider(AIProvider):
    def generate_learning_trail(
        self,
        topic: str,
        *,
        skills: Sequence[UserSkillInput] = (),
    ) -> TrailContent:
        safe_topic = topic.strip().rstrip(".") or "Tecnologia"
        seed = int(hashlib.sha256(safe_topic.encode("utf-8")).hexdigest()[:6], 16)
        ticket_count = 6 + (seed % 4)  # 6 a 9 tickets

        tickets = [
            self._make_ticket(i, safe_topic, skills)
            for i in range(1, ticket_count + 1)
        ]

        audience_suffix = ""
        if skills:
            top = ", ".join(
                f"{s.name} ({s.label})"
                for s in sorted(skills, key=lambda s: -s.level)[:3]
            )
            audience_suffix = f" Calibrada para um perfil com: {top}."

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
            tickets=tickets,
        )

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

    @staticmethod
    def _make_ticket(
        index: int,
        topic: str,
        skills: Sequence[UserSkillInput],
    ) -> Ticket:
        spec = _TICKET_TEMPLATES[(index - 1) % len(_TICKET_TEMPLATES)]
        concepts = list(spec["concepts"])
        return Ticket(
            code=f"TG-{index}",
            title=spec["title_pattern"].format(topic=topic),
            objective=spec["objective"],
            personalization_notes=_personalization_for(concepts, skills),
            concepts=concepts,
            tasks=[TicketTask(description=task) for task in spec["tasks"]],
            acceptance_criteria=list(spec["acceptance"]),
            estimated_effort="2h",
        )
