"""Provider de IA determinístico para desenvolvimento e testes.

Gera uma trilha realista e bem formada sem chamadas externas. Útil para:
- desenvolver UI sem custo/rede;
- garantir suite de testes offline;
- demos e ambientes ephemeral.
"""
from __future__ import annotations

import hashlib

from app.schemas.learning_trail import Ticket, TicketTask, TrailContent
from app.services.ai.base import AIProvider


class FakeAIProvider(AIProvider):
    def generate_learning_trail(self, topic: str) -> TrailContent:
        safe_topic = topic.strip().rstrip(".") or "Tecnologia"
        seed = int(hashlib.sha256(safe_topic.encode("utf-8")).hexdigest()[:6], 16)
        ticket_count = 6 + (seed % 4)  # 6 a 9 tickets

        tickets = [self._make_ticket(i, safe_topic) for i in range(1, ticket_count + 1)]
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
            ),
            prerequisites=[
                "Lógica de programação",
                "Git básico (clone, branch, commit)",
                "Linha de comando",
            ],
            tickets=tickets,
        )

    @staticmethod
    def _make_ticket(index: int, topic: str) -> Ticket:
        templates = [
            {
                "title": f"Setup do ambiente para {topic}",
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
                "title": f"Modelagem do domínio de {topic}",
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
                "title": "Primeiro caso de uso com TDD",
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
                "title": "Persistência e camada de dados",
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
                "title": "Camada de API/Interface",
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
                "title": "Observabilidade e logs",
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
                "title": "Refatoração e código limpo",
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
                "title": "Empacotamento e entrega",
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
                "title": "Próximos passos e evolução",
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
        spec = templates[(index - 1) % len(templates)]
        return Ticket(
            code=f"TG-{index}",
            title=spec["title"],
            objective=spec["objective"],
            concepts=list(spec["concepts"]),
            tasks=[TicketTask(description=task) for task in spec["tasks"]],
            acceptance_criteria=list(spec["acceptance"]),
            estimated_effort="2h",
        )
