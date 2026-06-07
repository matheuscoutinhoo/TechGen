"""Testes unitários do FakeAIProvider — garantia de saída pedagógica correta."""
import pytest

from app.schemas.learning_trail import TrailContent
from app.services.ai.fake_provider import FakeAIProvider


@pytest.mark.unit
class TestFakeAIProvider:
    def test_generates_valid_trail_content_for_any_topic(self):
        provider = FakeAIProvider()
        content = provider.generate_learning_trail("FastAPI avançado")
        assert isinstance(content, TrailContent)
        assert content.project_title.startswith("Plataforma")
        assert len(content.tickets) >= 6
        for index, ticket in enumerate(content.tickets, start=1):
            assert ticket.code == f"TG-{index}"
            assert ticket.title
            assert ticket.objective
            assert ticket.concepts
            assert ticket.tasks
            assert ticket.acceptance_criteria

    def test_output_is_deterministic_per_topic(self):
        provider = FakeAIProvider()
        a = provider.generate_learning_trail("Redes neurais")
        b = provider.generate_learning_trail("Redes neurais")
        assert a.model_dump() == b.model_dump()

    def test_different_topics_produce_different_titles(self):
        provider = FakeAIProvider()
        a = provider.generate_learning_trail("Kubernetes")
        b = provider.generate_learning_trail("Rust")
        assert a.project_title != b.project_title
