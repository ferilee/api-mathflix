import { Hono } from 'hono';
import { db } from '../db';
import { students, quizzes, quiz_results, materials } from '../db/schema';
import { eq, like, and, or, desc, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const app = new Hono();

const studentSchema = z.object({
    nisn: z.string().min(1),
    full_name: z.string().min(1),
    major: z.string().min(1),
    grade_level: z.coerce.number().int(),
    school: z.string().min(1),
});

// Schema for CSV Import (matches frontend payload)
const csvStudentSchema = z.object({
    nisn: z.string().min(1),
    name: z.string().min(1),
    grade: z.coerce.number().int(),
    major: z.string().min(1),
    school: z.string().optional(),
});
const batchCsvSchema = z.array(csvStudentSchema);

const batchStudentSchema = z.array(studentSchema);

// GET /students - Support Pagination and Filtering
app.get('/', async (c) => {
    const page = Number(c.req.query('page')) || 1;
    const limit = Number(c.req.query('limit')) || 10;
    const search = c.req.query('search') || '';
    const major = c.req.query('major') || '';
    const grade = c.req.query('grade') || '';
    const school = c.req.query('school') || '';

    const offset = (page - 1) * limit;

    const conditions = [];
    if (search) {
        conditions.push(or(
            like(students.full_name, `%${search}%`),
            like(students.nisn, `%${search}%`)
        ));
    }
    if (major) {
        conditions.push(eq(students.major, major));
    }
    if (grade) {
        conditions.push(eq(students.grade_level, Number(grade)));
    }
    if (school) {
        conditions.push(eq(students.school, school));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count for pagination
    const totalResult = await db.select({ count: db.$count(students, whereClause) }).from(students);
    const total = totalResult[0]?.count ?? 0;

    // Get paginated data
    const data = await db.select().from(students)
        .where(whereClause)
        .limit(limit)
        .offset(offset);

    return c.json({
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
    });
});

// GET /students/:id/recommendations
app.get('/:id/recommendations', async (c) => {
    const id = c.req.param('id');
    const limit = Number(c.req.query('limit')) || 6;

    const student = await db.query.students.findFirst({
        where: eq(students.id, id)
    });

    if (!student) return c.json({ error: 'Student not found' }, 404);

    const results = await db.select({
        score: quiz_results.score,
        submitted_at: quiz_results.submitted_at,
        quiz_id: quiz_results.quiz_id,
        passing_score: quizzes.passing_score,
        quiz_title: quizzes.title,
        material_id: quizzes.material_id,
        material_title: materials.title,
        material_description: materials.description,
        material_image_url: materials.image_url,
        material_major_target: materials.major_target
    })
        .from(quiz_results)
        .leftJoin(quizzes, eq(quiz_results.quiz_id, quizzes.id))
        .leftJoin(materials, eq(quizzes.material_id, materials.id))
        .where(eq(quiz_results.student_id, id))
        .orderBy(desc(quiz_results.submitted_at));

    const latest = results[0] || null;

    const weak = results
        .filter(r => (r.passing_score ?? 75) > r.score)
        .sort((a, b) => a.score - b.score);

    const recommendations = [];
    const used = new Set();

    const pushRec = (item, reason) => {
        if (!item?.material_id || used.has(item.material_id)) return;
        used.add(item.material_id);
        recommendations.push({
            material_id: item.material_id,
            title: item.material_title,
            description: item.material_description,
            image_url: item.material_image_url,
            major_target: item.material_major_target,
            score: item.score,
            passing_score: item.passing_score,
            reason
        });
    };

    if (latest) {
        const reason = latest.score < (latest.passing_score ?? 75)
            ? `Perkuat materi ini (nilai terakhir ${latest.score})`
            : `Lanjutkan topik ini (nilai terakhir ${latest.score})`;
        pushRec(latest, reason);
    }

    weak.forEach((item) => pushRec(item, `Skor di bawah target (${item.score}/${item.passing_score ?? 75})`));

    if (recommendations.length < limit) {
        const extras = await db.select({
            material_id: materials.id,
            material_title: materials.title,
            material_description: materials.description,
            material_image_url: materials.image_url,
            material_major_target: materials.major_target
        })
            .from(materials)
            .where(or(
                eq(materials.major_target, student.major),
                isNull(materials.major_target),
                eq(materials.major_target, 'Semua')
            ));

        for (const item of extras) {
            if (recommendations.length >= limit) break;
            if (!item.material_id || used.has(item.material_id)) continue;
            used.add(item.material_id);
            recommendations.push({
                material_id: item.material_id,
                title: item.material_title,
                description: item.material_description,
                image_url: item.material_image_url,
                major_target: item.material_major_target,
                reason: 'Rekomendasi untuk jurusan Anda'
            });
        }
    }

    return c.json({
        latest_result: latest,
        recommendations
    });
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
        major: s.major,
        grade_level: s.grade,
        school: s.school || "Unknown"
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

// POST /students/bulk-delete - Delete students based on filters
app.post('/bulk-delete', async (c) => {
    const body = await c.req.json(); // { full_name?, grade_level?, major? }

    const conditions = [];
    if (body.full_name) {
        conditions.push(or(
            like(students.full_name, `%${body.full_name}%`),
            like(students.nisn, `%${body.full_name}%`)
        ));
    }
    if (body.grade_level) {
        conditions.push(eq(students.grade_level, Number(body.grade_level)));
    }
    if (body.major) {
        conditions.push(eq(students.major, body.major));
    }
    if (body.school) {
        conditions.push(eq(students.school, body.school));
    }

    if (conditions.length === 0) {
        return c.json({ error: 'No filters provided for bulk delete' }, 400);
    }

    try {
        const result = await db.delete(students).where(and(...conditions)).returning();
        return c.json({
            message: `Successfully deleted ${result.length} students`,
            count: result.length
        });
    } catch (e) {
        console.error(e);
        return c.json({ error: 'Failed to perform bulk delete' }, 500);
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
