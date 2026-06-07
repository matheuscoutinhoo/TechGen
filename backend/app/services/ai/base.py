"""Interface de provider de IA.

Qualquer implementação (Abacus, OpenAI, mock, etc.) deve conformar com
``AIProvider``. Services só dependem desta interface.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from app.schemas.learning_trail import TrailContent


class AIProvider(ABC):
    """Contrato para provedores de IA usados na geração de trilhas."""

    @abstractmethod
    def generate_learning_trail(self, topic: str) -> TrailContent:
        """Gera uma trilha estruturada para o tema fornecido.

        Deve respeitar a metodologia pedagógica obrigatória:
        projeto realista decomposto em tickets progressivos.
        """
