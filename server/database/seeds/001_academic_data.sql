BEGIN;

-- Insert Kisii University
INSERT INTO institutions (name)
VALUES ('Kisii University')
ON CONFLICT (name) DO NOTHING;


-- Insert faculties / schools
INSERT INTO faculties (institution_id, name)
SELECT institution_id, school.name
FROM institutions
CROSS JOIN (
    VALUES
        ('School of Information Science and Technology (SIST)'),
        ('School of Pure and Applied Sciences'),
        ('School of Business and Economics')
) AS school(name)
WHERE institutions.name = 'Kisii University'
ON CONFLICT (institution_id, name) DO NOTHING;


-- Insert departments
INSERT INTO departments (faculty_id, name)
SELECT f.faculty_id, d.department_name
FROM faculties f
JOIN institutions i ON i.institution_id = f.institution_id
CROSS JOIN (
    VALUES
        ('School of Information Science and Technology (SIST)', 'Computing Science'),
        ('School of Information Science and Technology (SIST)', 'Communication Media and Information Science'),
        ('School of Pure and Applied Sciences', 'Biological Sciences'),
        ('School of Pure and Applied Sciences', 'Mathematics and Actuarial Science'),
        ('School of Pure and Applied Sciences', 'Chemistry'),
        ('School of Pure and Applied Sciences', 'Physics'),
        ('School of Business and Economics', 'Accounting and Finance'),
        ('School of Business and Economics', 'Business Administration')
) AS d(school_name, department_name)
WHERE i.name = 'Kisii University'
AND f.name = d.school_name
ON CONFLICT (faculty_id, name) DO NOTHING;


-- Insert courses
INSERT INTO courses (department_id, name)
SELECT d.department_id, c.course_name
FROM departments d
JOIN faculties f ON f.faculty_id = d.faculty_id
JOIN institutions i ON i.institution_id = f.institution_id
CROSS JOIN (
    VALUES
        ('Computing Science', 'Software Engineering'),
        ('Computing Science', 'Computer Science'),
        ('Computing Science', 'Information Technology'),
        ('Computing Science', 'Applied Computer Science'),

        ('Communication Media and Information Science', 'Communication Studies'),
        ('Communication Media and Information Science', 'Journalism and Mass Communication'),
        ('Communication Media and Information Science', 'Information Science'),
        ('Communication Media and Information Science', 'Media and Communication'),

        ('Biological Sciences', 'Biochemistry'),
        ('Biological Sciences', 'Forensic Science'),
        ('Biological Sciences', 'Microbiology'),
        ('Biological Sciences', 'Laboratory Science'),
        ('Biological Sciences', 'Biotechnology'),

        ('Mathematics and Actuarial Science', 'Pure Mathematics'),
        ('Mathematics and Actuarial Science', 'Applied Mathematics'),
        ('Mathematics and Actuarial Science', 'Actuarial Science'),

        ('Chemistry', 'Analytical Chemistry'),
        ('Chemistry', 'Petroleum Chemistry'),
        ('Chemistry', 'Environmental Chemistry'),
        ('Chemistry', 'Organic Chemistry'),
        ('Chemistry', 'Inorganic Chemistry'),

        ('Physics', 'Physics'),
        ('Physics', 'Renewable Energy'),
        ('Physics', 'Geophysical and Mineralogy'),

        ('Accounting and Finance', 'Commerce'),
        ('Accounting and Finance', 'Business and Management'),

        ('Business Administration', 'Business Administration'),
        ('Business Administration', 'Project Management'),
        ('Business Administration', 'Business Information and Management')
) AS c(department_name, course_name)
WHERE i.name = 'Kisii University'
AND d.name = c.department_name
ON CONFLICT (department_id, name) DO NOTHING;

COMMIT;