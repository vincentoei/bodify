"""add agent_memories table

Revision ID: 1a3b21b5f479
Revises: 9a3fbc11ed8b
Create Date: 2026-07-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1a3b21b5f479'
down_revision: Union[str, None] = '9a3fbc11ed8b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'agent_memories',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('source_agent', sa.String(), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        'ix_agent_memories_user_active',
        'agent_memories',
        ['user_id', 'active', 'expires_at'],
    )


def downgrade() -> None:
    op.drop_index('ix_agent_memories_user_active', table_name='agent_memories')
    op.drop_table('agent_memories')