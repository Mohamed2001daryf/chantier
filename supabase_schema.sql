-- ============================================
-- ChantierPro - Structure de base de données Supabase
-- ============================================
-- Exécutez ce script dans Supabase > SQL Editor > New Query

-- 1. BLOCS
CREATE TABLE IF NOT EXISTS blocks (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  zone TEXT NOT NULL,
  description TEXT
);

-- 2. ÉTAGES
CREATE TABLE IF NOT EXISTS floors (
  id BIGSERIAL PRIMARY KEY,
  block_id BIGINT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_number INTEGER NOT NULL
);

-- 3. ÉLÉMENTS VERTICAUX (Poteaux, Voiles)
CREATE TABLE IF NOT EXISTS vertical_elements (
  id BIGSERIAL PRIMARY KEY,
  block_id BIGINT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  floor_id BIGINT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  axes TEXT,
  ferraillage_status TEXT DEFAULT 'Non commencé',
  coffrage_status TEXT DEFAULT 'Non commencé',
  coulage_status TEXT DEFAULT 'Non commencé'
);

-- 4. DALLES POST-TENSION
CREATE TABLE IF NOT EXISTS slabs (
  id BIGSERIAL PRIMARY KEY,
  block_id BIGINT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  floor_id BIGINT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  axes TEXT,
  surface REAL,
  start_date TEXT,
  end_date TEXT,
  status TEXT DEFAULT 'Non commencé',
  coffrage_status TEXT DEFAULT 'Non commencé',
  ferraillage_inf_status TEXT DEFAULT 'Non commencé',
  pose_gaine_status TEXT DEFAULT 'Non commencé',
  pose_cable_status TEXT DEFAULT 'Non commencé',
  renforcement_status TEXT DEFAULT 'Non commencé',
  coulage_status TEXT DEFAULT 'Non commencé'
);

-- 5. ÉQUIPES
CREATE TABLE IF NOT EXISTS teams (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  speciality TEXT NOT NULL,
  block_id BIGINT REFERENCES blocks(id) ON DELETE SET NULL,
  workers INTEGER DEFAULT 0
);

-- 6. TÂCHES (Planning)
CREATE TABLE IF NOT EXISTS tasks (
  id BIGSERIAL PRIMARY KEY,
  block_id BIGINT REFERENCES blocks(id) ON DELETE CASCADE,
  floor_id BIGINT REFERENCES floors(id) ON DELETE CASCADE,
  team_id BIGINT REFERENCES teams(id) ON DELETE SET NULL,
  element TEXT,
  description TEXT,
  start_date TEXT,
  end_date TEXT,
  duration INTEGER,
  status TEXT DEFAULT 'Non commencé',
  element_id BIGINT,
  element_type TEXT,
  slab_id BIGINT,
  axes TEXT,
  surface REAL
);

-- 7. PRODUCTIVITÉ
CREATE TABLE IF NOT EXISTS productivity (
  id BIGSERIAL PRIMARY KEY,
  block_id BIGINT REFERENCES blocks(id) ON DELETE CASCADE,
  team_id BIGINT REFERENCES teams(id) ON DELETE CASCADE,
  task_id BIGINT REFERENCES tasks(id) ON DELETE SET NULL,
  work_type TEXT,
  workers_count INTEGER,
  quantity_realized REAL,
  date TEXT
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- Permet l'accès complet (anon + authenticated)
-- ============================================

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertical_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE slabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE productivity ENABLE ROW LEVEL SECURITY;

-- Politique : accès complet pour tous (anon + authenticated)
-- ⚠️ En production, restreignez ces politiques selon vos besoins de sécurité
CREATE POLICY "Allow full access" ON blocks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access" ON floors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access" ON vertical_elements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access" ON slabs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access" ON teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access" ON productivity FOR ALL USING (true) WITH CHECK (true);
