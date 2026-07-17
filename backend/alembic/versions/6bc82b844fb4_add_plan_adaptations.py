"""add plan_adaptations to plans

Revision ID: 6bc82b844fb4
Revises: 1a3b21b5f479
Create Date: 2026-07-17 00:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6bc82b844fb4'
down_revision: Union[str, None] = '1a3b21b5f479'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'plans',
        sa.Column('plan_adaptations', sa.JSON(), nullable=False, server_default='[]'),
    )


def downgrade() -> None:
    op.drop_column('plans', 'plan_adaptations')