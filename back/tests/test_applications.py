from copy import deepcopy

from sqlalchemy import select

from app.db import SessionLocal
from app.models import Application

VALID = {
    "parent_name": "Aysel Məmmədova",
    "phone": "+994 50 123 45 67",
    "children": [{"name": "Leyla Məmmədova", "birth_date": "2016-03-14"}],
    "languages": ["Azərbaycan", "Rus"],
}


def with_(**changes):
    body = deepcopy(VALID)
    body.update(changes)
    return body


def test_creates_application_with_children(client):
    body = with_(
        children=[
            {"name": "Leyla Məmmədova", "birth_date": "2016-03-14"},
            {"name": "Tural Məmmədov", "birth_date": "2014-11-02"},
        ]
    )
    response = client.post("/api/applications", json=body)

    assert response.status_code == 201
    assert list(response.json()) == ["id"]
    with SessionLocal() as db:
        saved = db.scalars(select(Application)).one()
        assert saved.parent_name == "Aysel Məmmədova"
        assert saved.languages == ["Azərbaycan", "Rus"]
        assert saved.status == "new"
        assert [c.name for c in saved.children] == ["Leyla Məmmədova", "Tural Məmmədov"]


def test_trims_and_deduplicates(client):
    response = client.post(
        "/api/applications",
        json=with_(parent_name="  Aysel  ", languages=["Rus", "Rus", "İngilis"]),
    )
    assert response.status_code == 201
    with SessionLocal() as db:
        saved = db.scalars(select(Application)).one()
        assert saved.parent_name == "Aysel"
        assert saved.languages == ["Rus", "İngilis"]


def test_rejects_invalid_input(client):
    bad = [
        with_(parent_name="   "),
        with_(phone="12345"),
        with_(phone="abc defg hijk"),
        with_(children=[]),
        with_(children=[VALID["children"][0]] * 3),
        with_(children=[{"name": "", "birth_date": "2016-03-14"}]),
        with_(children=[{"name": "Leyla", "birth_date": "1999-01-01"}]),
        with_(languages=[]),
        with_(languages=["Fransız"]),
    ]
    for body in bad:
        assert client.post("/api/applications", json=body).status_code == 422, body
    with SessionLocal() as db:
        assert db.scalars(select(Application)).all() == []


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}
