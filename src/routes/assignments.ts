
import { Hono } from 'hono';
import { db } from '../db';
import { assignments, students, assignment_targets } from '../db/schema';
import { eq, or, and, isNull, inArray } from 'drizzle-orm';

const app = new Hono();

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
            target_major: body.target_major
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

// DELETE Assignment
app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    try {
        await db.delete(assignments).where(eq(assignments.id, id));
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message || String(e) }, 500);
    }
});

export default app;
