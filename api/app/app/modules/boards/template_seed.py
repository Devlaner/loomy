"""Built-in starter templates focused on software architecture.

Each entry is a real excalidraw_snapshot payload (elements + appState).
We ship enough templates to differentiate Loomy from a blank-canvas tool
for architects: C4, AWS 3-tier, microservices, ERD, flowchart.

The elements below are intentionally hand-written minimal Excalidraw
shapes — plain rectangles, ellipses, arrows, and text — so they render
in any Excalidraw version and stay small. Users edit freely from there.
"""

from typing import Any

from sqlalchemy.orm import Session

from app.modules.boards.template_repo import upsert


def _rect(
    *,
    id: str,
    x: float,
    y: float,
    w: float,
    h: float,
    bg: str = "#ffffff",
    stroke: str = "#1e1e1e",
    label: str | None = None,
) -> list[dict[str, Any]]:
    base: dict[str, Any] = {
        "id": id,
        "type": "rectangle",
        "x": x,
        "y": y,
        "width": w,
        "height": h,
        "angle": 0,
        "strokeColor": stroke,
        "backgroundColor": bg,
        "fillStyle": "solid",
        "strokeWidth": 2,
        "strokeStyle": "solid",
        "roughness": 1,
        "opacity": 100,
        "groupIds": [],
        "roundness": {"type": 3},
        "seed": hash(id) & 0x7FFFFFFF,
        "version": 1,
        "versionNonce": hash(id + "vn") & 0x7FFFFFFF,
        "isDeleted": False,
        "boundElements": [],
        "updated": 1,
        "link": None,
        "locked": False,
    }
    out: list[dict[str, Any]] = [base]
    if label:
        out.append(
            {
                "id": f"{id}-label",
                "type": "text",
                "x": x + 12,
                "y": y + h / 2 - 10,
                "width": w - 24,
                "height": 20,
                "angle": 0,
                "strokeColor": "#1e1e1e",
                "backgroundColor": "transparent",
                "fillStyle": "solid",
                "strokeWidth": 1,
                "strokeStyle": "solid",
                "roughness": 1,
                "opacity": 100,
                "groupIds": [],
                "seed": hash(id + "label") & 0x7FFFFFFF,
                "version": 1,
                "versionNonce": hash(id + "labelvn") & 0x7FFFFFFF,
                "isDeleted": False,
                "boundElements": [],
                "updated": 1,
                "link": None,
                "locked": False,
                "text": label,
                "fontSize": 16,
                "fontFamily": 1,
                "textAlign": "left",
                "verticalAlign": "middle",
                "baseline": 14,
                "containerId": None,
                "originalText": label,
            }
        )
    return out


def _arrow(*, id: str, x1: float, y1: float, x2: float, y2: float) -> dict[str, Any]:
    return {
        "id": id,
        "type": "arrow",
        "x": x1,
        "y": y1,
        "width": x2 - x1,
        "height": y2 - y1,
        "angle": 0,
        "strokeColor": "#1e1e1e",
        "backgroundColor": "transparent",
        "fillStyle": "solid",
        "strokeWidth": 2,
        "strokeStyle": "solid",
        "roughness": 1,
        "opacity": 100,
        "groupIds": [],
        "seed": hash(id) & 0x7FFFFFFF,
        "version": 1,
        "versionNonce": hash(id + "vn") & 0x7FFFFFFF,
        "isDeleted": False,
        "boundElements": [],
        "updated": 1,
        "link": None,
        "locked": False,
        "points": [[0, 0], [x2 - x1, y2 - y1]],
        "lastCommittedPoint": None,
        "startBinding": None,
        "endBinding": None,
        "startArrowhead": None,
        "endArrowhead": "arrow",
    }


def _snapshot(elements: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "elements": elements,
        "appState": {"viewBackgroundColor": "#ffffff", "gridSize": 20},
    }


def _blank() -> dict[str, Any]:
    return _snapshot([])


def _c4_context() -> dict[str, Any]:
    els: list[dict[str, Any]] = []
    els += _rect(id="u", x=120, y=80, w=160, h=80, bg="#d0ebff", label="User")
    els += _rect(
        id="sys",
        x=400,
        y=200,
        w=260,
        h=120,
        bg="#fff3bf",
        label="System (Your Software)",
    )
    els += _rect(
        id="ext1",
        x=120,
        y=400,
        w=200,
        h=80,
        bg="#e9ecef",
        label="External System A",
    )
    els += _rect(
        id="ext2",
        x=700,
        y=400,
        w=200,
        h=80,
        bg="#e9ecef",
        label="External System B",
    )
    els.append(_arrow(id="a1", x1=200, y1=160, x2=480, y2=200))
    els.append(_arrow(id="a2", x1=500, y1=320, x2=220, y2=400))
    els.append(_arrow(id="a3", x1=600, y1=320, x2=780, y2=400))
    return _snapshot(els)


def _aws_three_tier() -> dict[str, Any]:
    els: list[dict[str, Any]] = []
    els += _rect(id="u", x=80, y=80, w=140, h=60, bg="#d0ebff", label="Users")
    els += _rect(
        id="cf",
        x=80,
        y=200,
        w=140,
        h=60,
        bg="#ffe3a3",
        label="CloudFront",
    )
    els += _rect(
        id="alb",
        x=80,
        y=320,
        w=140,
        h=60,
        bg="#ffe3a3",
        label="ALB",
    )
    els += _rect(
        id="web",
        x=320,
        y=320,
        w=160,
        h=60,
        bg="#c8f5b5",
        label="Web Tier (ECS)",
    )
    els += _rect(
        id="app",
        x=540,
        y=320,
        w=160,
        h=60,
        bg="#c8f5b5",
        label="App Tier (ECS)",
    )
    els += _rect(
        id="rds",
        x=760,
        y=260,
        w=160,
        h=60,
        bg="#fcc2d7",
        label="RDS Primary",
    )
    els += _rect(
        id="rdsr",
        x=760,
        y=380,
        w=160,
        h=60,
        bg="#fcc2d7",
        label="RDS Read Replica",
    )
    els += _rect(
        id="cache",
        x=540,
        y=440,
        w=160,
        h=60,
        bg="#ffd6a5",
        label="ElastiCache",
    )
    els += _rect(
        id="s3",
        x=320,
        y=440,
        w=160,
        h=60,
        bg="#ffd6a5",
        label="S3",
    )
    els.append(_arrow(id="a1", x1=150, y1=140, x2=150, y2=200))
    els.append(_arrow(id="a2", x1=150, y1=260, x2=150, y2=320))
    els.append(_arrow(id="a3", x1=220, y1=350, x2=320, y2=350))
    els.append(_arrow(id="a4", x1=480, y1=350, x2=540, y2=350))
    els.append(_arrow(id="a5", x1=700, y1=350, x2=760, y2=290))
    els.append(_arrow(id="a6", x1=700, y1=350, x2=760, y2=410))
    els.append(_arrow(id="a7", x1=620, y1=380, x2=620, y2=440))
    els.append(_arrow(id="a8", x1=400, y1=380, x2=400, y2=440))
    return _snapshot(els)


def _microservices() -> dict[str, Any]:
    els: list[dict[str, Any]] = []
    els += _rect(id="gw", x=80, y=240, w=160, h=60, bg="#ffe3a3", label="API Gateway")
    els += _rect(id="auth", x=320, y=100, w=160, h=60, bg="#c8f5b5", label="Auth")
    els += _rect(id="users", x=320, y=220, w=160, h=60, bg="#c8f5b5", label="Users")
    els += _rect(id="orders", x=320, y=340, w=160, h=60, bg="#c8f5b5", label="Orders")
    els += _rect(id="billing", x=320, y=460, w=160, h=60, bg="#c8f5b5", label="Billing")
    els += _rect(id="bus", x=580, y=280, w=180, h=60, bg="#bac8ff", label="Event Bus")
    els += _rect(id="dbu", x=820, y=220, w=160, h=60, bg="#fcc2d7", label="DB: users")
    els += _rect(id="dbo", x=820, y=340, w=160, h=60, bg="#fcc2d7", label="DB: orders")
    for i, target in enumerate(["auth", "users", "orders", "billing"]):
        els.append(
            _arrow(id=f"gwa{i}", x1=240, y1=270, x2=320, y2=130 + i * 120)
        )
    els.append(_arrow(id="ub", x1=480, y1=250, x2=580, y2=310))
    els.append(_arrow(id="ob", x1=480, y1=370, x2=580, y2=310))
    els.append(_arrow(id="bb", x1=480, y1=490, x2=580, y2=310))
    els.append(_arrow(id="u-dbu", x1=480, y1=250, x2=820, y2=250))
    els.append(_arrow(id="o-dbo", x1=480, y1=370, x2=820, y2=370))
    return _snapshot(els)


def _erd() -> dict[str, Any]:
    els: list[dict[str, Any]] = []
    els += _rect(id="user", x=120, y=120, w=200, h=120, bg="#d0ebff", label="User")
    els += _rect(id="wksp", x=440, y=120, w=200, h=120, bg="#d0ebff", label="Workspace")
    els += _rect(id="board", x=760, y=120, w=200, h=120, bg="#d0ebff", label="Board")
    els += _rect(id="element", x=760, y=320, w=200, h=120, bg="#d0ebff", label="Element")
    els.append(_arrow(id="u-w", x1=320, y1=180, x2=440, y2=180))
    els.append(_arrow(id="w-b", x1=640, y1=180, x2=760, y2=180))
    els.append(_arrow(id="b-e", x1=860, y1=240, x2=860, y2=320))
    return _snapshot(els)


def _flowchart() -> dict[str, Any]:
    els: list[dict[str, Any]] = []
    els += _rect(id="start", x=200, y=80, w=160, h=60, bg="#c8f5b5", label="Start")
    els += _rect(id="in", x=200, y=200, w=160, h=60, bg="#ffe3a3", label="Input request")
    els += _rect(id="dec", x=200, y=320, w=160, h=60, bg="#ffd6a5", label="Valid?")
    els += _rect(id="ok", x=60, y=440, w=160, h=60, bg="#c8f5b5", label="Process")
    els += _rect(id="err", x=340, y=440, w=160, h=60, bg="#fcc2d7", label="Reject")
    els += _rect(id="end", x=200, y=560, w=160, h=60, bg="#c8f5b5", label="End")
    els.append(_arrow(id="s-i", x1=280, y1=140, x2=280, y2=200))
    els.append(_arrow(id="i-d", x1=280, y1=260, x2=280, y2=320))
    els.append(_arrow(id="d-ok", x1=220, y1=380, x2=140, y2=440))
    els.append(_arrow(id="d-err", x1=340, y1=380, x2=420, y2=440))
    els.append(_arrow(id="ok-e", x1=140, y1=500, x2=260, y2=560))
    els.append(_arrow(id="err-e", x1=420, y1=500, x2=320, y2=560))
    return _snapshot(els)


TEMPLATES: list[dict[str, Any]] = [
    {
        "slug": "blank",
        "name": "Blank board",
        "category": "general",
        "description": "Start from an empty canvas.",
        "snapshot": _blank(),
    },
    {
        "slug": "c4-context",
        "name": "C4 — Context diagram",
        "category": "architecture",
        "description": "System + users + external dependencies. Classic C4 Level 1.",
        "snapshot": _c4_context(),
    },
    {
        "slug": "aws-three-tier",
        "name": "AWS 3-tier web app",
        "category": "architecture",
        "description": "CloudFront → ALB → Web/App ECS tiers → RDS + ElastiCache + S3.",
        "snapshot": _aws_three_tier(),
    },
    {
        "slug": "microservices",
        "name": "Microservices overview",
        "category": "architecture",
        "description": "API Gateway, services, event bus, per-service databases.",
        "snapshot": _microservices(),
    },
    {
        "slug": "erd",
        "name": "Entity-relationship diagram",
        "category": "data",
        "description": "Starter ERD with four example entities.",
        "snapshot": _erd(),
    },
    {
        "slug": "flowchart",
        "name": "Flowchart",
        "category": "process",
        "description": "Classic start → input → decision → end flowchart.",
        "snapshot": _flowchart(),
    },
]


def seed_builtin_templates(db: Session) -> int:
    """Idempotent: inserts missing templates, refreshes the snapshot for
    existing ones. Returns the number of templates upserted.
    """
    count = 0
    for t in TEMPLATES:
        upsert(
            db,
            slug=t["slug"],
            name=t["name"],
            category=t["category"],
            description=t["description"],
            snapshot=t["snapshot"],
        )
        count += 1
    return count
