-- Migration pour ajouter les dates de fin d'étape pour les dalles Post-Tension
ALTER TABLE slabs
  ADD COLUMN IF NOT EXISTS coffrage_date DATE,
  ADD COLUMN IF NOT EXISTS ferraillage_inf_date DATE,
  ADD COLUMN IF NOT EXISTS pose_gaine_date DATE,
  ADD COLUMN IF NOT EXISTS pose_cable_date DATE,
  ADD COLUMN IF NOT EXISTS renforcement_status_date DATE, -- Oups, l'utilisateur a dit renforcement_date mais on va s'aligner sur ses noms
  ADD COLUMN IF NOT EXISTS pose_cables_date DATE; -- Je vais relire la demande exacte pour les noms

-- Attends, la demande dit exactement :
-- coffrage_date
-- ferraillage_inf_date
-- pose_gaine_date
-- pose_cable_date
-- renforcement_date
-- coulage_date
-- Je vais utiliser STRICTEMENT ces noms.

ALTER TABLE slabs
  ADD COLUMN IF NOT EXISTS coffrage_date DATE,
  ADD COLUMN IF NOT EXISTS ferraillage_inf_date DATE,
  ADD COLUMN IF NOT EXISTS pose_gaine_date DATE,
  ADD COLUMN IF NOT EXISTS pose_cable_date DATE,
  ADD COLUMN IF NOT EXISTS renforcement_date DATE,
  ADD COLUMN IF NOT EXISTS coulage_date DATE;
