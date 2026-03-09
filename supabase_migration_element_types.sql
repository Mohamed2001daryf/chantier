-- ============================================
-- Migration : Ajout de la table element_types
-- ============================================

-- 1. Création de la table
CREATE TABLE IF NOT EXISTS element_types (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- S'assurer qu'un même utilisateur ne peut pas créer deux fois le même type
  UNIQUE(user_id, name)
);

-- 2. Activer RLS
ALTER TABLE element_types ENABLE ROW LEVEL SECURITY;

-- 3. Politiques (Les membres peuvent lire ce qui appartient au owner_id)
-- Cette politique est très permissive en lecture (comme les autres)
CREATE POLICY "Allow read access to element_types" 
  ON element_types FOR SELECT 
  USING (true);

-- Permettre l'insertion (l'UI va s'assurer d'envoyer le bon user_id)
CREATE POLICY "Allow insert access to element_types" 
  ON element_types FOR INSERT 
  WITH CHECK (auth.uid() = user_id OR auth.uid() IS NOT NULL);

-- Permettre la suppression et modification
CREATE POLICY "Allow update access to element_types" 
  ON element_types FOR UPDATE 
  USING (auth.uid() = user_id OR auth.uid() IS NOT NULL);

CREATE POLICY "Allow delete access to element_types" 
  ON element_types FOR DELETE 
  USING (auth.uid() = user_id OR auth.uid() IS NOT NULL);

-- 4. Insertion des types par défaut pour les utilisateurs existants
-- Optionnel : Copier les types par défaut pour chaque utilisateur existant
INSERT INTO element_types (user_id, name)
SELECT DISTINCT id, 'Poteaux' FROM auth.users
ON CONFLICT DO NOTHING;

INSERT INTO element_types (user_id, name)
SELECT DISTINCT id, 'Voiles' FROM auth.users
ON CONFLICT DO NOTHING;

INSERT INTO element_types (user_id, name)
SELECT DISTINCT id, 'Voiles périphériques' FROM auth.users
ON CONFLICT DO NOTHING;
