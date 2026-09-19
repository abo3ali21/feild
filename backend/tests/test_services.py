import httpx
import pytest

from app.models.schemas import DataStatus, FarmRequest
from app.services.environment import RetryingClient, fallback_for


@pytest.mark.asyncio
async def test_external_timeout_handling(monkeypatch):
    async def fail(*args, **kwargs):
        raise httpx.TimeoutException("timeout")
    monkeypatch.setattr(httpx.AsyncClient, "get", fail)
    with pytest.raises(RuntimeError, match="unavailable"):
        await RetryingClient(timeout=.01, attempts=1).get_json("https://example.invalid", {})


def test_missing_data_uses_visible_fallback():
    request = FarmRequest(latitude=14.1203, longitude=-16.0351, current_crop_id="groundnut")
    context, provenance = fallback_for(request)
    assert context.data_quality["climate"] == DataStatus.FALLBACK
    assert provenance[0].status == DataStatus.FALLBACK
