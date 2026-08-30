"""add trash (soft delete)

Revision ID: 9b3f1c7e5a02
Revises: 7a1c9f3d2b44
Create Date: 2026-08-30 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9b3f1c7e5a02'
down_revision: Union[str, Sequence[str], None] = '7a1c9f3d2b44'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ['accounts', 'transactions', 'categories', 'budgets', 'recurring_payments', 'goals']


def upgrade() -> None:
    """Upgrade schema."""
    for table in TABLES:
        op.add_column(table, sa.Column('deleted_at', sa.DateTime(), nullable=True))
        op.create_index(f'ix_{table}_deleted_at', table, ['deleted_at'])

    # A trashed budget must not block creating a new one for the same category+month.
    op.drop_constraint('uq_budget_month', 'budgets', type_='unique')


def downgrade() -> None:
    """Downgrade schema."""
    op.create_unique_constraint('uq_budget_month', 'budgets', ['user_id', 'category_id', 'month'])
    for table in TABLES:
        op.drop_index(f'ix_{table}_deleted_at', table_name=table)
        op.drop_column(table, 'deleted_at')
