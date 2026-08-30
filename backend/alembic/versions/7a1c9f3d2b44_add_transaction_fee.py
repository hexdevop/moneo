"""add transaction fee

Revision ID: 7a1c9f3d2b44
Revises: 54e126f98090
Create Date: 2026-08-30 15:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7a1c9f3d2b44'
down_revision: Union[str, Sequence[str], None] = '54e126f98090'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('transactions', sa.Column('fee', sa.Numeric(18, 2), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('transactions', 'fee')
