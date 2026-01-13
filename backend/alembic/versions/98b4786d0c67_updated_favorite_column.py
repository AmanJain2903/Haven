"""Updated favorite column

Revision ID: 98b4786d0c67
Revises: aca6a66a3b5b
Create Date: 2026-01-12 22:33:01.438185

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '98b4786d0c67'
down_revision: Union[str, Sequence[str], None] = 'aca6a66a3b5b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    
    # 1. IMAGES TABLE
    # Backfill existing NULLs to FALSE
    op.execute("UPDATE images SET is_favorite = FALSE WHERE is_favorite IS NULL")
    # Apply the Default and make it Non-Nullable
    op.alter_column('images', 'is_favorite', 
                    server_default=sa.text('FALSE'))

    # 2. VIDEOS TABLE
    op.execute("UPDATE videos SET is_favorite = FALSE WHERE is_favorite IS NULL")
    op.alter_column('videos', 'is_favorite', 
                    server_default=sa.text('FALSE'))

    # 3. RAW IMAGES TABLE
    op.execute("UPDATE raw_images SET is_favorite = FALSE WHERE is_favorite IS NULL")
    op.alter_column('raw_images', 'is_favorite', 
                    server_default=sa.text('FALSE'))

def downgrade() -> None:
    """Downgrade schema."""
    # Remove constraints if we roll back
    op.alter_column('images', 'is_favorite', server_default=None)
    op.alter_column('videos', 'is_favorite', server_default=None)
    op.alter_column('raw_images', 'is_favorite', server_default=None)
