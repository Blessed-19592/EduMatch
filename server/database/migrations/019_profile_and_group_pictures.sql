BEGIN;

ALTER TABLE student_profiles
    ADD COLUMN profile_picture_storage_key TEXT,
    ADD CONSTRAINT student_profiles_picture_storage_key_format
        CHECK (
            profile_picture_storage_key IS NULL
            OR profile_picture_storage_key ~
                '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
        );

ALTER TABLE student_groups
    ADD COLUMN group_picture_storage_key TEXT,
    ADD CONSTRAINT student_groups_picture_storage_key_format
        CHECK (
            group_picture_storage_key IS NULL
            OR group_picture_storage_key ~
                '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
        );

COMMIT;
