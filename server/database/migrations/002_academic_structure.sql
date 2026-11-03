BEGIN;

-- 1. University
CREATE TABLE institutions (
    institution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Faculties / Schools
CREATE TABLE faculties (
    faculty_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(institution_id),
    name VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (institution_id, name)
);

-- 3. Departments
CREATE TABLE departments (
    department_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faculty_id UUID NOT NULL REFERENCES faculties(faculty_id),
    name VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (faculty_id, name)
);

-- 4. Courses
CREATE TABLE courses (
    course_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES departments(department_id),
    name VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (department_id, name)
);

-- 5. Simulated university student registry
CREATE TABLE registry_students (
    registry_student_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_number VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(200) NOT NULL,
    university_email VARCHAR(255) NOT NULL UNIQUE,
    course_id UUID NOT NULL REFERENCES courses(course_id),
    year_of_study SMALLINT NOT NULL CHECK (year_of_study BETWEEN 1 AND 8),
    student_status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (student_status IN ('active', 'suspended', 'graduated')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Link EduMatch profiles to verified registry records
ALTER TABLE student_profiles
ADD COLUMN registry_student_id UUID UNIQUE
REFERENCES registry_students(registry_student_id);

-- 7. Indexes
CREATE INDEX idx_faculties_institution
ON faculties(institution_id);

CREATE INDEX idx_departments_faculty
ON departments(faculty_id);

CREATE INDEX idx_courses_department
ON courses(department_id);

CREATE INDEX idx_registry_course
ON registry_students(course_id);

COMMIT;