-- ============================================
-- Migration: Table project_members
-- Exécutez dans Supabase → SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS project_members (
  id BIGSERIAL PRIMARY KEY,
  owner_id UUID NOT NULL,          -- Le chef de projet (celui qui invite)
  member_email TEXT NOT NULL,       -- Email du membre invité
  member_id UUID,                   -- ID du membre (rempli quand il se connecte)
  role TEXT NOT NULL DEFAULT 'viewer', -- admin, suivi, planning, viewer
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE project_members DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_project_members_owner ON project_members(owner_id);
CREATE INDEX IF NOT EXISTS idx_project_members_member ON project_members(member_id);
CREATE INDEX IF NOT EXISTS idx_project_members_email ON project_members(member_email);
