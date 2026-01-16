import { Hono } from 'hono';
import { db } from '../db';
import { students } from '../db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const app = new Hono();

const studentSchema = z.object({
    nisn: z.string().min(1),
    full_name: z.string().min(1),
    major: z.string().min(1),
    grade_level: z.coerce.number().int(),
});

// Schema for CSV Import (matches frontend payload)
const csvStudentSchema = z.object({
    nisn: z.string().min(1),
    name: z.string().min(1),
    major: z.string().optional(),
});
const batchCsvSchema = z.array(csvStudentSchema);

const batchStudentSchema = z.array(studentSchema);

// GET /students
app.get('/', async (c) => {
    const result = await db.select().from(students);
    return c.json(result);
});

// GET /students/:id
app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const result = await db.select().from(students).where(eq(students.id, id));
    if (result.length === 0) return c.json({ error: 'Student not found' }, 404);
    return c.json(result[0]);
});

// POST /students
app.post('/', zValidator('json', studentSchema), async (c) => {
    const body = c.req.valid('json');
    try {
        const result = await db.insert(students).values(body).returning();
        return c.json(result[0], 201);
    } catch (e) {
        return c.json({ error: 'Failed to create student. NISN might be duplicate.' }, 400);
    }
});

// PUT /students/:id
app.put('/:id', zValidator('json', studentSchema.partial()), async (c) => {
    const id = c.req.param('id');
    const body = c.req.valid('json');
    try {
        const result = await db.update(students).set(body).where(eq(students.id, id)).returning();
        if (result.length === 0) return c.json({ error: 'Student not found' }, 404);
        return c.json(result[0]);
    } catch (e) {
        return c.json({ error: 'Failed to update student' }, 400);
    }
});

// POST /students/bulk - Import multiple students
app.post('/bulk', zValidator('json', batchCsvSchema), async (c) => {
    const body = c.req.valid('json');

    // Map to DB schema
    const studentsData = body.map(s => ({
        nisn: s.nisn,
        full_name: s.name,
        major: s.major || 'Umum',
        grade_level: 10
    }));

    try {
        // Use studentsData instead of body
        const result = await db.insert(students).values(studentsData).returning();
        return c.json({ message: `Successfully imported ${result.length} students` });
    } catch (e) {
        console.error(e);
        return c.json({ error: 'Failed to import. Check for duplicate NISN.' }, 400);
    }
});

// DELETE /students/:id
app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const result = await db.delete(students).where(eq(students.id, id)).returning();
    if (result.length === 0) return c.json({ error: 'Student not found' }, 404);
    return c.json({ message: 'Student deleted successfully' });
});

export default app;
