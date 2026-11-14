import httpx
import pytest

from app.models.schemas import DataStatus, FarmRequest
from app.services.environment import (
    SHARED_CACHE,
    RetryingClient,
    TTLCache,
    fallback_for,
)


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


def test_soil_texture_manual_override_takes_precedence():
    request = FarmRequest(
        latitude=14.1203,
        longitude=-16.0351,
        current_crop_id="groundnut",
        soil_texture_override="CLAY",
    )
    context, provenance = fallback_for(request)
    assert context.soil_texture == "CLAY"
    assert context.soil_texture_source == "OVERRIDE"
    assert any("override" in p.source.lower() for p in provenance)


def test_shared_cache_lifecycle():
    cache = TTLCache(ttl_seconds=1)
    cache.set("geo:10:20", {"data": 42})
    assert cache.get("geo:10:20") == {"data": 42}
    assert cache.get("non_existent") is None


@pytest.mark.asyncio
async def test_soil_provider_cache_returns_cached_status():
    from app.services.environment import SoilGridsProvider
    cache = TTLCache(ttl_seconds=60)
    key = "soil:25.701:32.635:v2"
    cache.set(key, {
        "soil_texture": "SANDY_LOAM",
        "soil_ph": 7.8,
        "soil_organic_matter_pct": 1.15,
        "raw_soc_dg_kg": 67.0,
    })
    provider = SoilGridsProvider(client=RetryingClient(), cache=cache)
    result = await provider.fetch(25.701, 32.635)
    assert result.status == DataStatus.CACHED
    assert result.payload["soil_texture"] == "SANDY_LOAM"
    assert result.payload["soil_ph"] == 7.8


@pytest.mark.asyncio
async def test_soil_data_service_raises_on_unhandled_failure():
    from app.services.environment import SoilDataService, SoilProvider, AdapterResult

    class FailingProvider(SoilProvider):
        async def fetch(self, lat: float, lon: float) -> AdapterResult:
            raise RuntimeError("ISRIC API unreachable")

    service = SoilDataService(primary_provider=FailingProvider())
    with pytest.raises(RuntimeError, match="ISRIC API unreachable"):
        await service.get_soil_data(25.701, 32.635)


def test_provenance_structure_and_units():
    request = FarmRequest(latitude=25.701, longitude=32.635, current_crop_id="wheat")
    context, provenance = fallback_for(request)
    assert len(provenance) >= 3
    sources = {p.source for p in provenance}
    assert any("Demonstration" in s or "regional profile" in s for s in sources)
    for item in provenance:
        assert item.status in (DataStatus.LIVE, DataStatus.CACHED, DataStatus.ESTIMATED, DataStatus.FALLBACK, DataStatus.SENSOR, DataStatus.UNAVAILABLE)
        if item.status != DataStatus.UNAVAILABLE:
            assert item.unit != ""

