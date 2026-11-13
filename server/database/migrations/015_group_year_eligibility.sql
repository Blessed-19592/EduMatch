BEGIN;

-- Whether a group accepts students from every academic year.
ALTER TABLE student_groups
ADD COLUMN accepts_all_years BOOLEAN NOT NULL DEFAULT TRUE;

-- Stores the specific academic years accepted by a group.
CREATE TABLE group_allowed_years (
    group_id UUID NOT NULL,
    year_of_study SMALLINT NOT NULL,

    CONSTRAINT pk_group_allowed_years
        PRIMARY KEY (group_id, year_of_study),

    CONSTRAINT fk_group_allowed_years_group
        FOREIGN KEY (group_id)
        REFERENCES student_groups(group_id)
        ON DELETE CASCADE,

    CONSTRAINT chk_group_allowed_years
        CHECK (year_of_study BETWEEN 1 AND 4)
);

CREATE INDEX idx_group_allowed_years_year
ON group_allowed_years(year_of_study);

COMMIT;