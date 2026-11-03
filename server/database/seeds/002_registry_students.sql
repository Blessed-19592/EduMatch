BEGIN;

INSERT INTO registry_students (
    registration_number,
    full_name,
    university_email,
    course_id,
    year_of_study
)
SELECT
    students.reg_number,
    students.full_name,
    students.email,
    courses.course_id,
    students.year
FROM (
    VALUES
        ('SIST/2024/001', 'Fridah Jerono', 'fridahjerono@kisiiuniversity.com', 'Software Engineering', 2),
        ('SIST/2024/002', 'Laura Blessed', 'laurablessed@kisiiuniversity.com', 'Computer Science', 2),
        ('SIST/2024/003', 'Fidel Muthoni', 'fidelmuthoni@kisiiuniversity.com', 'Information Technology', 3),
        ('SIST/2024/004', 'Caleb Kiprotich', 'calebkiprotich@kisiiuniversity.com', 'Applied Computer Science', 2),

        ('SIST/2024/005', 'Alex Morgan', 'alexmorgan@kisiiuniversity.com', 'Software Engineering', 3),
        ('SIST/2024/006', 'Taylor Reed', 'taylorreed@kisiiuniversity.com', 'Computer Science', 1),
        ('SIST/2024/007', 'Jordan Ellis', 'jordanellis@kisiiuniversity.com', 'Information Science', 2),
        ('SIST/2024/008', 'Casey Bennett', 'caseybennett@kisiiuniversity.com', 'Journalism and Mass Communication', 3),

        ('SPA/2024/009', 'Riley Parker', 'rileyparker@kisiiuniversity.com', 'Biochemistry', 2),
        ('SPA/2024/010', 'Avery Quinn', 'averyquinn@kisiiuniversity.com', 'Physics', 1),

        ('SBE/2024/011', 'Jamie Rowan', 'jamierowan@kisiiuniversity.com', 'Commerce', 2),
        ('SBE/2024/012', 'Morgan Blake', 'morganblake@kisiiuniversity.com', 'Project Management', 3)

) AS students(reg_number, full_name, email, course_name, year)

JOIN courses ON courses.name = students.course_name
JOIN departments ON departments.department_id = courses.department_id
JOIN faculties ON faculties.faculty_id = departments.faculty_id
JOIN institutions ON institutions.institution_id = faculties.institution_id

WHERE institutions.name = 'Kisii University'

ON CONFLICT (registration_number) DO NOTHING;

COMMIT;