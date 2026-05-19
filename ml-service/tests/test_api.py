import pytest
from httpx import ASGITransport, AsyncClient

from src.api.main import app


@pytest.mark.asyncio
async def test_health():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_predict_malicious():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/predict", json={"query": "' UNION SELECT password FROM users--"})
    assert r.status_code == 200 and r.json()["label"] == "MALICIOUS"


@pytest.mark.asyncio
async def test_predict_safe():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/predict", json={"query": "SELECT id FROM users WHERE id=1"})
    assert r.status_code == 200 and r.json()["label"] == "SAFE"


@pytest.mark.asyncio
async def test_predict_empty_422():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/predict", json={"query": ""})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_predict_too_long_422():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/predict", json={"query": "A" * 2001})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_explain_char_scores():
    q = "' OR 1=1--"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/explain", json={"query": q})
    assert r.status_code == 200 and len(r.json()["char_scores"]) == len(q)


@pytest.mark.asyncio
async def test_model_info():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/model-info")
    assert r.status_code == 200 and "architecture" in r.json()


@pytest.mark.asyncio
async def test_metrics_prometheus():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/metrics")
    assert r.status_code == 200 and "queryguard_predictions_total" in r.text
