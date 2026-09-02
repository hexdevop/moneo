"""add hide accounts balance

Revision ID: c1a2b3d4e5f6
Revises: 9b3f1c7e5a02
Create Date: 2026-09-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1a2b3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '9b3f1c7e5a02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'users',
        sa.Column('hide_accounts_balance', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.alter_column('users', 'hide_accounts_balance', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'hide_accounts_balance')
