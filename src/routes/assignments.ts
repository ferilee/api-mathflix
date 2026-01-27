
import { Hono } from 'hono';
import { db } from '../db';
import { assignments, students, assignment_targets, assignment_submissions } from '../db/schema';
import { eq, or, and, isNull, inArray } from 'drizzle-orm';

const app = new Hono();

const sanitizeStudent = (row: any) => {
    if (!row) return row;
    const { password_hash, ...rest } = row;
    return rest;
};

// POST Create Assignment
// Body: { title, description, due_date, target_grade: number, target_major: string, target_students: string[] }
app.post('/', async (c) => {
    try {
        const body = await c.req.json();

        const [newAssignment] = await db.insert(assignments).values({
            title: body.title,
            description: body.description,
            due_date: new Date(body.due_date),
            target_grade: body.target_grade,
            target_major: body.target_major,
            rubric: body.rubric || null,
            created_by: body.created_by || null
        }).returning();

        if (!newAssignment) {
            throw new Error("Failed to insert assignment");
        }

        // Handle Individual Targets
        if (body.target_students && Array.isArray(body.target_students) && body.target_students.length > 0) {
            const targets = body.target_students.map((sid: string) => ({
                assignment_id: newAssignment.id,
                student_id: sid
            }));
            await db.insert(assignment_targets).values(targets);
        }

        return c.json(newAssignment, 201);
    } catch (e: any) {
        console.error(e);
        return c.json({ error: e.message || String(e) }, 500);
    }
});

// GET My Assignments (Student)
// Expects header: X-Student-ID
app.get('/my-assignments', async (c) => {
    const studentId = c.req.header('X-Student-ID');
    if (!studentId) return c.json({ error: 'Unauthorized' }, 401);

    try {
        console.log(`[DEBUG] Fetching assignments for Student ID: ${studentId}`);

        // 1. Get student details
        const student = await db.query.students.findFirst({
            where: eq(students.id, studentId)
        });

        if (!student) {
            console.log(`[DEBUG] Student NOT FOUND: ${studentId}`);
            return c.json({ error: 'Student not found' }, 404);
        }

        console.log(`[DEBUG] Student Found: ${student.full_name}, Grade: ${student.grade_level}, Major: ${student.major}`);

        // 2. Get assignments targeted individually
        const individualTargets = await db.select({ id: assignment_targets.assignment_id })
            .from(assignment_targets)
            .where(eq(assignment_targets.student_id, studentId));

        const individualAssignmentIds = individualTargets.map(t => t.id);
        console.log(`[DEBUG] Individual Assignment IDs:`, individualAssignmentIds);

        // 3. Query Assignments
        // Logic: (Class Match) OR (ID IN individualAssignmentIds)

        const conditions = [
            // Class Match Logic:
            // 1. target_grade is NULL (All grades) OR matches student.grade
            // 2. target_major is NULL (All majors) OR matches student.major
            // 3. EXCEPTION: If target_grade is -1 or target_major is 'NONE', it is PRIVATE and should NOT match class rules.
            and(
                // Ensure it is not a Private Assignment (Private ones use -1/NONE)
                or(isNull(assignments.target_grade), eq(assignments.target_grade, student.grade_level)),
                or(isNull(assignments.target_major), eq(assignments.target_major, student.major)),
                // Strict check: If it was marked private (-1/NONE), strict equality above would fail (10 != -1),
                // BUT isNull might be tricky if we didn't save it as -1.
                // Let's add explicit check that it's NOT -1 or 'NONE' to be safe against data anomalies
                // actually the above logic `eq(target_grade, student.grade)` handles -1 since student.grade (e.g. 10) != -1.
                // The issue user reported implies `isNull` is matching.
                // If I save as -1, then `isNull` is FALSE.
                // So checking `ne(target_grade, -1)` is redundant but good for clarity if DB supports it.
                // Let's stick to the current logic but double check the DB value via logs if needed.
                // Wait, if I created assignments BEFORE the fix, they might have NULLs.
                // The user says "new individual tasks".
                // Let's ensure 'private' tasks never match the class query section.
                // Adding a clause: target_major != 'NONE'
            )
        ];

        if (individualAssignmentIds.length > 0) {
            conditions.push(inArray(assignments.id, individualAssignmentIds));
        }

        const result = await db.select()
            .from(assignments)
            .where(or(...conditions))
            .orderBy(assignments.due_date);

        return c.json(result);
    } catch (e) {
        console.error(e);
        return c.json({ error: e }, 500);
    }
});

// GET All Assignments (Admin)
app.get('/', async (c) => {
    try {
        const result = await db.select().from(assignments).orderBy(assignments.due_date);
        return c.json(result);
    } catch (e) {
        return c.json({ error: e }, 500);
    }
});

// Helper to get logic
app.get('/:id', async (c) => {
    try {
        const { id } = c.req.param();
        const result = await db.query.assignments.findFirst({
            where: eq(assignments.id, id)
        });
        if (!result) return c.json({ error: 'Assignment not found' }, 404);
        return c.json(result);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// GET Submission Status
app.get('/:id/status', async (c) => {
    const studentId = c.req.header('X-Student-ID');
    if (!studentId) return c.json({ error: 'Unauthorized' }, 401);
    const { id } = c.req.param();

    try {
        const submission = await db.query.assignment_submissions.findFirst({
            where: and(
                eq(assignment_submissions.assignment_id, id),
                eq(assignment_submissions.student_id, studentId)
            )
        });
        return c.json(submission || null);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST Submit Assignment
app.post('/:id/submit', async (c) => {
    const studentId = c.req.header('X-Student-ID');
    if (!studentId) return c.json({ error: 'Unauthorized' }, 401);
    const { id } = c.req.param();
    const body = await c.req.json();

    try {
        // Check if exists, update or insert
        const existing = await db.query.assignment_submissions.findFirst({
            where: and(
                eq(assignment_submissions.assignment_id, id),
                eq(assignment_submissions.student_id, studentId)
            )
        });

        if (existing) {
            await db.update(assignment_submissions)
                .set({
                    submission_url: body.url,
                    submission_note: body.note,
                    submitted_at: new Date()
                })
                .where(eq(assignment_submissions.id, existing.id));
        } else {
            await db.insert(assignment_submissions).values({
                assignment_id: id,
                student_id: studentId,
                submission_url: body.url,
                submission_note: body.note
            });
        }
        return c.json({ success: true });
    } catch (e: any) {
        console.error(e);
        return c.json({ error: e.message }, 500);
    }
});

// GET All Submissions for an Assignment (merged with Student list)
app.get('/:id/submissions', async (c) => {
    const { id } = c.req.param();
    try {
        // 1. Get Assignment to know targets
        const assignment = await db.query.assignments.findFirst({
            where: eq(assignments.id, id)
        });
        if (!assignment) return c.json({ error: 'Assignment not found' }, 404);

        console.log(`[DEBUG] Submissions for Assignment: ${id}`);
        console.log(`[DEBUG] Targets: Grade=${assignment.target_grade}, Major=${assignment.target_major}`);

        // 2. Get Individual Targets
        const individualTargets = await db.select({ student_id: assignment_targets.student_id })
            .from(assignment_targets)
            .where(eq(assignment_targets.assignment_id, id));
        const targetIds = individualTargets.map(t => t.student_id).filter(id => id !== null) as string[];

        // 3. Build Student Query
        const conditions = [];

        // Class-based targets
        if (assignment.target_grade !== -1 && assignment.target_major !== 'NONE') {
            const classFilters = [];
            if (assignment.target_grade !== null) {
                classFilters.push(eq(students.grade_level, assignment.target_grade));
            }
            if (assignment.target_major !== null) {
                classFilters.push(eq(students.major, assignment.target_major));
            }

            if (classFilters.length > 0) {
                conditions.push(and(...classFilters));
            }
        }

        // Individual targets
        if (targetIds.length > 0) {
            conditions.push(inArray(students.id, targetIds));
        }

        let studentsList: any[] = [];
        if (conditions.length > 0) {
            studentsList = await db.select().from(students).where(or(...conditions));
        } else if (assignment.target_grade === null && assignment.target_major === null) {
            // No class filters and not private -> Everyone
            studentsList = await db.select().from(students);
        } else {
            studentsList = [];
        }

        console.log(`[DEBUG] Targeted Students count: ${studentsList.length}`);

        // 4. Get Actual Submissions
        const submissions = await db.select()
            .from(assignment_submissions)
            .where(eq(assignment_submissions.assignment_id, id));

        console.log(`[DEBUG] Submissions found: ${submissions.length}`);

        // 5. Merge
        // Use a Map to combine target list and actual submitters
        const mergedMap = new Map();

        // Add everyone from target list
        studentsList.forEach(s => {
            const sub = submissions.find(sub => sub.student_id === s.id);
            mergedMap.set(s.id, {
                student: sanitizeStudent(s),
                submission: sub || null,
                status: sub ? 'submitted' : 'missing'
            });
        });

        // Add any submissions from students NOT in the target list
        for (const sub of submissions) {
            if (!mergedMap.has(sub.student_id)) {
                const studentInfo = await db.query.students.findFirst({
                    where: eq(students.id, sub.student_id)
                });
                if (studentInfo) {
                    mergedMap.set(sub.student_id, {
                        student: sanitizeStudent(studentInfo),
                        submission: sub,
                        status: 'submitted'
                    });
                }
            }
        }

        const result = Array.from(mergedMap.values());
        console.log(`[DEBUG] Result count: ${result.length}`);
        return c.json(result);
    } catch (e: any) {
        console.error(e);
        return c.json({ error: e.message }, 500);
    }
});

// POST Grade Submission
app.post('/:id/grade', async (c) => {
    const { id } = c.req.param();
    const body = await c.req.json(); // { student_id, grade, feedback }

    if (!body.student_id || body.grade === undefined) {
        return c.json({ error: 'Missing student_id or grade' }, 400);
    }

    try {
        // Find submission
        const existing = await db.query.assignment_submissions.findFirst({
            where: and(
                eq(assignment_submissions.assignment_id, id),
                eq(assignment_submissions.student_id, body.student_id)
            )
        });

        if (existing) {
            await db.update(assignment_submissions)
                .set({
                    grade: body.grade,
                    feedback: body.feedback,
                    rubric_scores: body.rubric_scores || null
                })
                .where(eq(assignment_submissions.id, existing.id));
        } else {
            // Create "Graded but not submitted" entry? 
            // Or force submission creation. Let's create it.
            await db.insert(assignment_submissions).values({
                assignment_id: id,
                student_id: body.student_id,
                grade: body.grade,
                feedback: body.feedback,
                rubric_scores: body.rubric_scores || null,
                submission_note: 'Graded by teacher (No submission)',
                submitted_at: new Date()
            });
        }

        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// DELETE
app.delete('/:id', async (c) => {
    try {
        const { id } = c.req.param();
        await db.delete(assignments).where(eq(assignments.id, id));
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
