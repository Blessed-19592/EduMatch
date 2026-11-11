CREATE OR REPLACE FUNCTION validate_assessment_evidence_ownership()
RETURNS TRIGGER AS $$
DECLARE
    assessment_student_id UUID;
    portfolio_student_id UUID;
BEGIN
    SELECT student_id
    INTO assessment_student_id
    FROM skill_assessments
    WHERE assessment_id = NEW.assessment_id;

    IF assessment_student_id IS NULL THEN
        RAISE EXCEPTION 'Assessment does not exist'
            USING ERRCODE = '23503';
    END IF;

    IF NEW.portfolio_id IS NOT NULL THEN
        SELECT student_id
        INTO portfolio_student_id
        FROM portfolios
        WHERE portfolio_id = NEW.portfolio_id;

        IF portfolio_student_id IS NULL THEN
            RAISE EXCEPTION 'Portfolio does not exist'
                USING ERRCODE = '23503';
        END IF;

        IF assessment_student_id <> portfolio_student_id THEN
            RAISE EXCEPTION
                'Assessment evidence must belong to the assessment owner'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER trg_validate_assessment_evidence_ownership
BEFORE INSERT OR UPDATE OF assessment_id, portfolio_id
ON assessment_evidence
FOR EACH ROW
EXECUTE FUNCTION validate_assessment_evidence_ownership();