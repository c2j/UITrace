"""
Initial database schema

Revision ID: 001
Revises:
Create Date: 2025-11-30

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create user role enum
    userrole_enum = sa.Enum('ADMIN', 'TESTER', 'VIEWER', name='userrole')
    userrole_enum.create(op.get_bind())

    # Create team member role enum
    teammemberrole_enum = sa.Enum('OWNER', 'MAINTAINER', 'MEMBER', 'VIEWER', name='teammemberrole')
    teammemberrole_enum.create(op.get_bind())

    # Create users table
    op.create_table('users',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('email', sa.String(255), nullable=False, unique=True, index=True),
        sa.Column('username', sa.String(100), nullable=False, unique=True, index=True),
        sa.Column('password_hash', sa.String(255), nullable=True),
        sa.Column('oauth_provider', sa.String(50), nullable=True),
        sa.Column('oauth_id', sa.String(255), nullable=True, index=True),
        sa.Column('full_name', sa.String(255), nullable=True),
        sa.Column('role', userrole_enum, nullable=False, default='TESTER'),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('is_verified', sa.Boolean(), nullable=False, default=False),
        sa.Column('avatar_url', sa.String(500), nullable=True),
        sa.Column('timezone', sa.String(50), nullable=False, default='UTC'),
        sa.Column('language', sa.String(10), nullable=False, default='en'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()'), nullable=False),
        sa.Column('last_login', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_seen', sa.DateTime(timezone=True), nullable=True)
    )

    # Create teams table
    op.create_table('teams',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('avatar_url', sa.String(500), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_by', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()'), nullable=False)
    )

    # Create team_members table
    op.create_table('team_members',
        sa.Column('team_id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), primary_key=True),
        sa.Column('role', teammemberrole_enum, nullable=False, default='MEMBER'),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('invited_by', UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'])
    )

    # Create indexes
    op.create_index('idx_team_members_team_id', 'team_members', ['team_id'])
    op.create_index('idx_team_members_user_id', 'team_members', ['user_id'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_team_members_user_id', table_name='team_members')
    op.drop_index('idx_team_members_team_id', table_name='team_members')

    # Drop tables
    op.drop_table('team_members')
    op.drop_table('teams')
    op.drop_table('users')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS teammemberrole')
    op.execute('DROP TYPE IF EXISTS userrole')