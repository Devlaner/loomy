"""unique snapshot per board

Revision ID: 00425b753873
Revises: fe24635bcc34
Create Date: 2026-07-10 12:29:54.664126

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '00425b753873'
down_revision: Union[str, Sequence[str], None] = 'fe24635bcc34'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SNAPSHOT_TYPE = "excalidraw_snapshot"


def upgrade() -> None:
    """Upgrade schema."""
    # Before enforcing uniqueness, collapse any duplicate snapshot rows a
    # board may already have accumulated (the bug this migration fixes):
    # keep the most-recently-updated one per board, drop the rest.
    op.execute(
        f"""
        DELETE FROM elements
        WHERE id IN (
            SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY board_id
                           ORDER BY updated_at DESC, id DESC
                       ) AS rn
                FROM elements
                WHERE type = '{SNAPSHOT_TYPE}'
            ) ranked
            WHERE rn > 1
        )
        """
    )
    op.create_index(
        "ix_elements_board_snapshot_singleton",
        "elements",
        ["board_id"],
        unique=True,
        postgresql_where=sa.text(f"type = '{SNAPSHOT_TYPE}'"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_elements_board_snapshot_singleton", table_name="elements")
