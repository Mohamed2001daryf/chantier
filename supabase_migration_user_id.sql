-- ============================================
-- Migration: Ajouter user_id à toutes les tables
-- Exécutez dans Supabase → SQL Editor
-- ============================================

-- Ajouter la colonne user_id à chaque table
ALTER TABLE blocks ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE floors ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE vertical_elements ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE slabs ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE productivity ADD COLUMN IF NOT EXISTS user_id UUID;

-- Créer des index pour améliorer la performance des requêtes filtrées
CREATE INDEX IF NOT EXISTS idx_blocks_user_id ON blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_floors_user_id ON floors(user_id);
CREATE INDEX IF NOT EXISTS idx_vertical_elements_user_id ON vertical_elements(user_id);
CREATE INDEX IF NOT EXISTS idx_slabs_user_id ON slabs(user_id);
CREATE INDEX IF NOT EXISTS idx_teams_user_id ON teams(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_productivity_user_id ON productivity(user_id);
