import { Hono } from 'hono';
import { db } from '../db';
import { announcements, announcement_reads, students, cohort_members } from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const app = new Hono();

const attachmentSchema = z.object({
    type: z.enum(['image', 'pdf', 'file', 'link']),
    url: z.string().min(1),
    name: z.string().optional(),
    size: z.number().optional(),
});

const announcementSchema = z.object({
    title: z.string().min(1),
    content: z.string().min(1),
    target_all: z.boolean().optional(),
    target_grades: z.array(z.number()).optional(),
    target_majors: z.array(z.string()).optional(),
    target_cohorts: z.array(z.string()).optional(),
    attachments: z.array(attachmentSchema).optional(),
    is_pinned: z.boolean().optional(),
    priority: z.enum(['normal', 'important', 'deadline']).optional(),
    created_by: z.string().optional(),
});

const normalizeTargets = (announcement: any) => {
    const targetAll = announcement.target_all ?? true;
    const grades = Array.isArray(announcement.target_grades) ? announcement.target_grades : [];
    const majors = Array.isArray(announcement.target_majors) ? announcement.target_majors : [];
    const cohorts = Array.isArray(announcement.target_cohorts) ? announcement.target_cohorts : [];
    return { targetAll, grades, majors, cohorts };
};

const matchesTarget = (announcement: any, student: any, cohortIds: string[]) => {
    const { targetAll, grades, majors, cohorts } = normalizeTargets(announcement);
    if (targetAll) return true;
    if (grades.length === 0 && majors.length === 0 && cohorts.length === 0) return true;
    const gradeMatch = grades.includes(student.grade_level);
    const majorMatch = majors.includes(student.major);
    const cohortMatch = cohorts.some((id: string) => cohortIds.includes(id));
    return gradeMatch || majorMatch || cohortMatch;
};

const buildCohortMap = (memberships: any[]) => {
    const map = new Map<string, string[]>();
    memberships.forEach((m) => {
        const list = map.get(m.student_id) || [];
        list.push(m.cohort_id);
        map.set(m.student_id, list);
    });
    return map;
};

// GET /announcements - List announcements
app.get('/', async (c) => {
    const studentId = c.req.query('student_id');
    const result = await db
        .select()
        .from(announcements)
        .orderBy(desc(announcements.is_pinned), desc(announcements.created_at));

    if (studentId) {
        const student = await db.query.students.findFirst({
            where: eq(students.id, studentId),
        });
        if (!student) return c.json([]);
        const memberships = await db
            .select()
            .from(cohort_members)
            .where(eq(cohort_members.student_id, studentId));
        const cohortIds = memberships.map((m) => m.cohort_id);
        const reads = await db
            .select()
            .from(announcement_reads)
            .where(eq(announcement_reads.student_id, studentId));
        const readSet = new Set(reads.map((r) => r.announcement_id));

        const filtered = result.filter((announcement) => matchesTarget(announcement, student, cohortIds));
        return c.json(
            filtered.map((announcement) => ({
                ...announcement,
                has_read: readSet.has(announcement.id),
            }))
        );
    }

    const allStudents = await db.select().from(students);
    const allMemberships = await db.select().from(cohort_members);
    const cohortMap = buildCohortMap(allMemberships);
    const reads = await db.select().from(announcement_reads);

    const response = result.map((announcement) => {
        const { targetAll, grades, majors, cohorts } = normalizeTargets(announcement);
        const eligibleIds = new Set<string>();
        if (targetAll || (grades.length === 0 && majors.length === 0 && cohorts.length === 0)) {
            allStudents.forEach((student) => eligibleIds.add(student.id));
        } else {
            allStudents.forEach((student) => {
                const cohortIds = cohortMap.get(student.id) || [];
                if (matchesTarget(announcement, student, cohortIds)) {
                    eligibleIds.add(student.id);
                }
            });
        }
        const readCount = reads.filter(
            (row) => row.announcement_id === announcement.id && eligibleIds.has(row.student_id)
        ).length;
        const eligibleCount = eligibleIds.size;
        const readPercent = eligibleCount === 0 ? 0 : Math.round((readCount / eligibleCount) * 100);
        return {
            ...announcement,
            read_stats: {
                read_count: readCount,
                eligible_count: eligibleCount,
                read_percent: readPercent,
            },
        };
    });

    return c.json(response);
});

// POST /announcements - Create new announcement
app.post('/', zValidator('json', announcementSchema), async (c) => {
    const body = c.req.valid('json');
    const [announcement] = await db
        .insert(announcements)
        .values({
            title: body.title,
            content: body.content,
            target_all: body.target_all ?? true,
            target_grades: body.target_grades ?? [],
            target_majors: body.target_majors ?? [],
            target_cohorts: body.target_cohorts ?? [],
            attachments: body.attachments ?? [],
            is_pinned: body.is_pinned ?? false,
            priority: body.priority ?? 'normal',
            created_by: body.created_by,
        })
        .returning();
    return c.json(announcement, 201);
});

// POST /announcements/:id/read - Mark announcement as read
app.post('/:id/read', async (c) => {
    const id = c.req.param('id');
    const { student_id } = await c.req.json();
    if (!student_id) return c.json({ error: 'student_id is required' }, 400);
    const existing = await db.query.announcement_reads.findFirst({
        where: and(eq(announcement_reads.announcement_id, id), eq(announcement_reads.student_id, student_id)),
    });
    if (existing) {
        await db
            .update(announcement_reads)
            .set({ read_at: new Date() })
            .where(eq(announcement_reads.id, existing.id));
    } else {
        await db.insert(announcement_reads).values({ announcement_id: id, student_id });
    }
    return c.json({ success: true });
});

// GET /announcements/:id/readers - Read status per student
app.get('/:id/readers', async (c) => {
    const id = c.req.param('id');
    const announcement = await db.query.announcements.findFirst({
        where: eq(announcements.id, id),
    });
    if (!announcement) return c.json({ error: 'Announcement not found' }, 404);

    const allStudents = await db.select().from(students);
    const memberships = await db.select().from(cohort_members);
    const cohortMap = buildCohortMap(memberships);
    const reads = await db
        .select()
        .from(announcement_reads)
        .where(eq(announcement_reads.announcement_id, id));
    const readMap = new Map(reads.map((row) => [row.student_id, row.read_at]));

    const eligible = allStudents.filter((student) => {
        const cohortIds = cohortMap.get(student.id) || [];
        return matchesTarget(announcement, student, cohortIds);
    });

    const response = eligible
        .map((student) => ({
            student_id: student.id,
            nisn: student.nisn,
            full_name: student.full_name,
            major: student.major,
            grade_level: student.grade_level,
            has_read: readMap.has(student.id),
            read_at: readMap.get(student.id) || null,
        }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name));

    return c.json(response);
});

// DELETE /announcements/:id - Delete announcement
app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    await db.delete(announcements).where(eq(announcements.id, id));
    return c.json({ message: 'Announcement deleted' });
});

export default app;
