-- Add columns linking tasks and physical elements for bidirectional sync
ALTER TABLE vertical_elements ADD COLUMN task_id bigint REFERENCES tasks(id) ON DELETE SET NULL;
ALTER TABLE slabs ADD COLUMN task_id bigint REFERENCES tasks(id) ON DELETE SET NULL;

-- element_id can refer to either vertical_elements or slabs. We won't use a strict foreign key constraint because it's polymorphic.
ALTER TABLE tasks ADD COLUMN element_id bigint;
