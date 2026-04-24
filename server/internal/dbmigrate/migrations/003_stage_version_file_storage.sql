ALTER TABLE stage_versions
    ADD COLUMN IF NOT EXISTS storage_path TEXT;

ALTER TABLE stage_versions
    ADD COLUMN IF NOT EXISTS source_size_bytes BIGINT NOT NULL DEFAULT 0;

UPDATE stage_versions
   SET storage_path = ''
 WHERE storage_path IS NULL;
