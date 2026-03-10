-- Migration pour supprimer la colonne surface redondante de la table slabs
-- La surface est désormais gérée au niveau de l'étage (floors.surface_totale_dalle)
ALTER TABLE slabs DROP COLUMN IF EXISTS surface;
