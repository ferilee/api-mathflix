import { Hono } from "hono";
import { db } from "../db";
import {
  students,
  quiz_results,
  reflections,
  posts,
  materials,
  quizzes,
  student_activity,
  question_results,
  questions,
  question_bank,
} from "../db/schema";
import { sql, desc, eq, lt, inArray, like, and } from "drizzle-orm";

const app = new Hono();

app.get("/", async (c) => {
  try {
    const teacherId = c.req.query("teacher_id") || "";
    const teacherName = c.req.query("teacher_name") || "";
    const teacherFilter = teacherId
      ? eq(students.teacher_id, teacherId)
      : teacherName
        ? like(students.teacher_name, `%${teacherName}%`)
        : null;

    const studentIds = teacherFilter
      ? (await db.select({ id: students.id }).from(students).where(teacherFilter)).map((row) => row.id)
      : null;

    // 1. Total Students
    const [studentCount] = teacherFilter
      ? await db
          .select({ count: sql<number>`count(*)` })
          .from(students)
          .where(teacherFilter)
      : await db
          .select({ count: sql<number>`count(*)` })
          .from(students);

    // 2. Average Quiz Score
    const [avgScoreResult] = teacherFilter
      ? await db
          .select({ avg: sql<number>`avg(${quiz_results.score})` })
          .from(quiz_results)
          .leftJoin(students, eq(quiz_results.student_id, students.id))
          .where(teacherFilter)
      : await db
          .select({ avg: sql<number>`avg(${quiz_results.score})` })
          .from(quiz_results);
    const avgScore = avgScoreResult?.avg
      ? Math.round(avgScoreResult.avg * 10) / 10
      : 0;

    // 3. Recent Reflections (Last 5)
    let recentReflections: any[] = [];
    if (!teacherFilter) {
      const recentReflectionsRaw = await db.query.reflections.findMany({
        limit: 10, // Fetch a few more to allow for filtering orphans
        orderBy: [desc(reflections.created_at)],
        with: {
          student: {
            columns: { full_name: true, grade_level: true, major: true },
          },
        },
      });
      recentReflections = recentReflectionsRaw
        .filter((r) => r.student)
        .slice(0, 5);
    } else if (studentIds && studentIds.length > 0) {
      const recentReflectionsRaw = await db.query.reflections.findMany({
        limit: 10,
        where: inArray(reflections.student_id, studentIds),
        orderBy: [desc(reflections.created_at)],
        with: {
          student: {
            columns: { full_name: true, grade_level: true, major: true },
          },
        },
      });
      recentReflections = recentReflectionsRaw
        .filter((r) => r.student)
        .slice(0, 5);
    }

    // 4. Count Today's Journals
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayReflectionsQuery = teacherFilter
      ? studentIds && studentIds.length > 0
        ? await db
            .select({ count: sql<number>`count(*)` })
            .from(reflections)
            .where(
              and(
                inArray(reflections.student_id, studentIds),
                sql`${reflections.created_at} >= ${today.getTime()}`,
              ),
            )
        : [{ count: 0 }]
      : await db
          .select({ count: sql<number>`count(*)` })
          .from(reflections)
          .where(sql`${reflections.created_at} >= ${today.getTime()}`);
    const todayReflections = todayReflectionsQuery[0];

    // 5. At Risk Students (Avg Score < 60)
    const allResults = teacherFilter
      ? await db
          .select({
            studentId: quiz_results.student_id,
            score: quiz_results.score,
            studentName: students.full_name,
          })
          .from(quiz_results)
          .leftJoin(students, eq(quiz_results.student_id, students.id))
          .where(teacherFilter)
      : await db
          .select({
            studentId: quiz_results.student_id,
            score: quiz_results.score,
            studentName: students.full_name,
          })
          .from(quiz_results)
          .leftJoin(students, eq(quiz_results.student_id, students.id));

    const studentScores: Record<
      string,
      { total: number; count: number; name: string }
    > = {};
    allResults.forEach((r) => {
      if (!r.studentId) return;
      if (!studentScores[r.studentId]) {
        studentScores[r.studentId] = {
          total: 0,
          count: 0,
          name: r.studentName || "Unknown",
        };
      }
      const entry = studentScores[r.studentId];
      if (entry) {
        entry.total += r.score;
        entry.count++;
      }
    });

    const atRiskStudents = Object.values(studentScores)
      .map((s) => ({ name: s.name, average: Math.round(s.total / s.count) }))
      .filter((s) => s.average < 60);

    return c.json({
      total_students: studentCount?.count || 0,
      average_score: avgScore,
      today_reflections: todayReflections?.count || 0,
      recent_reflections: recentReflections,
      at_risk_students: atRiskStudents,
    });
  } catch (e: any) {
    console.error(e);
    return c.json({ error: e.message || String(e) }, 500);
  }
});

// GET /analytics/materials - Per-material analytics
app.get("/materials", async (c) => {
  try {
    const [materialsList, studentsList, activityRows, quizRows] = await Promise.all([
      db.select().from(materials),
      db.select().from(students),
      db.select({ material_id: student_activity.material_id, student_id: student_activity.student_id }).from(student_activity),
      db.select({ material_id: quizzes.material_id, score: quiz_results.score, passing_score: quizzes.passing_score, student_id: quiz_results.student_id })
        .from(quiz_results)
        .leftJoin(quizzes, eq(quiz_results.quiz_id, quizzes.id))
    ]);

    const totalAll = studentsList.length;
    const totalByMajor = new Map();
    studentsList.forEach((s) => {
      totalByMajor.set(s.major, (totalByMajor.get(s.major) || 0) + 1);
    });

    const engagedMap = new Map();
    activityRows.forEach((row) => {
      if (!row.material_id) return;
      const list = engagedMap.get(row.material_id) || new Set();
      list.add(row.student_id);
      engagedMap.set(row.material_id, list);
    });

    const quizAgg = new Map();
    quizRows.forEach((row) => {
      if (!row.material_id) return;
      const entry = quizAgg.get(row.material_id) || { total: 0, count: 0, pass: 0, students: new Set() };
      entry.total += row.score || 0;
      entry.count += 1;
      if ((row.score || 0) >= (row.passing_score ?? 75)) {
        entry.pass += 1;
      }
      entry.students.add(row.student_id);
      quizAgg.set(row.material_id, entry);
    });

    const data = materialsList.map((m: any) => {
      const totalStudents = m.major_target ? (totalByMajor.get(m.major_target) || 0) : totalAll;
      const engaged = engagedMap.get(m.id) || new Set();
      const quiz = quizAgg.get(m.id) || { total: 0, count: 0, pass: 0, students: new Set() };
      const avg = quiz.count > 0 ? Math.round((quiz.total / quiz.count) * 10) / 10 : 0;
      const passRate = quiz.count > 0 ? Math.round((quiz.pass / quiz.count) * 100) : 0;
      const progress = totalStudents > 0
        ? Math.round((((engaged.size / totalStudents) + (quiz.students.size / totalStudents)) / 2) * 100)
        : 0;
      return {
        material_id: m.id,
        title: m.title,
        progress_rate: progress,
        average_score: avg,
        pass_rate: passRate,
        active_students: engaged.size,
        total_students: totalStudents,
      };
    });

    return c.json(data);
  } catch (e: any) {
    console.error(e);
    return c.json({ error: e.message || String(e) }, 500);
  }
});

// GET /analytics/materials/:id - Detail for single material
app.get("/materials/:id", async (c) => {
  try {
    const materialId = c.req.param("id");
    const [material, studentsList, activityRows, quizRows, quizIds] = await Promise.all([
      db.query.materials.findFirst({
        where: eq(materials.id, materialId),
      }),
      db.select().from(students),
      db.select({ material_id: student_activity.material_id, student_id: student_activity.student_id }).from(student_activity).where(eq(student_activity.material_id, materialId)),
      db.select({ score: quiz_results.score, passing_score: quizzes.passing_score, student_id: quiz_results.student_id, quiz_id: quizzes.id })
        .from(quiz_results)
        .leftJoin(quizzes, eq(quiz_results.quiz_id, quizzes.id))
        .where(eq(quizzes.material_id, materialId)),
      db.select({ id: quizzes.id, passing_score: quizzes.passing_score }).from(quizzes).where(eq(quizzes.material_id, materialId)),
    ]);

    if (!material) return c.json({ error: 'Material not found' }, 404);

    const totalStudents = material.major_target
      ? studentsList.filter((s) => s.major === material.major_target).length
      : studentsList.length;

    const engaged = new Set(activityRows.map((row) => row.student_id));
    const quizStudents = new Set(quizRows.map((r) => r.student_id));

    const quizAgg = quizRows.reduce(
      (acc: any, r: any) => {
        acc.total += r.score || 0;
        acc.count += 1;
        if ((r.score || 0) >= (r.passing_score ?? 75)) acc.pass += 1;
        return acc;
      },
      { total: 0, count: 0, pass: 0 },
    );

    const avg = quizAgg.count > 0 ? Math.round((quizAgg.total / quizAgg.count) * 10) / 10 : 0;
    const passRate = quizAgg.count > 0 ? Math.round((quizAgg.pass / quizAgg.count) * 100) : 0;
    const progress = totalStudents > 0
      ? Math.round((((engaged.size / totalStudents) + (quizStudents.size / totalStudents)) / 2) * 100)
      : 0;

    const quizIdList = quizIds.map((q) => q.id);
    let hardest = [] as Array<{ question_id: string; question_text: string; correct_rate: number; attempts: number }>;
    if (quizIdList.length > 0) {
      const results = await db.select().from(question_results).where(inArray(question_results.quiz_id, quizIdList));
      const agg = new Map<string, { correct: number; total: number }>;
      results.forEach((row: any) => {
        const entry = agg.get(row.question_id) || { correct: 0, total: 0 };
        if (row.is_correct) entry.correct += 1;
        entry.total += 1;
        agg.set(row.question_id, entry);
      });

      const [quizQuestions, bankQuestions] = await Promise.all([
        db.select({ id: questions.id, question_text: questions.question_text }).from(questions).where(inArray(questions.quiz_id, quizIdList)),
        db.select({ id: question_bank.id, question_text: question_bank.question_text }).from(question_bank),
      ]);

      const textMap = new Map([...quizQuestions, ...bankQuestions].map((q) => [q.id, q.question_text]));

      hardest = Array.from(agg.entries())
        .map(([question_id, data]) => ({
          question_id,
          question_text: textMap.get(question_id) || 'Soal tidak ditemukan',
          correct_rate: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
          attempts: data.total,
        }))
        .sort((a, b) => a.correct_rate - b.correct_rate)
        .slice(0, 5);
    }

    return c.json({
      material_id: material.id,
      title: material.title,
      progress_rate: progress,
      average_score: avg,
      pass_rate: passRate,
      active_students: engaged.size,
      total_students: totalStudents,
      hardest_questions: hardest,
    });
  } catch (e: any) {
    console.error(e);
    return c.json({ error: e.message || String(e) }, 500);
  }
});

export default app;
