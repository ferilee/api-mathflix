import { Hono } from "hono";
import { db } from "../db";
import { students, quiz_results, reflections, posts, materials, quizzes, student_activity, question_results, questions, question_bank } from "../db/schema";
import { sql, desc, eq, lt, inArray } from "drizzle-orm";

const app = new Hono();

app.get("/", async (c) => {
  try {
    // 1. Total Students
    const [studentCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(students);

    // 2. Average Quiz Score
    const [avgScoreResult] = await db
      .select({ avg: sql<number>`avg(${quiz_results.score})` })
      .from(quiz_results);
    const avgScore = avgScoreResult?.avg
      ? Math.round(avgScoreResult.avg * 10) / 10
      : 0;

    // 3. Recent Reflections (Last 5)
    const recentReflectionsRaw = await db.query.reflections.findMany({
      limit: 10, // Fetch a few more to allow for filtering orphans
      orderBy: [desc(reflections.created_at)],
      with: {
        student: {
          columns: { full_name: true, grade_level: true, major: true },
        },
      },
    });
    const recentReflections = recentReflectionsRaw
      .filter((r) => r.student)
      .slice(0, 5);

        // 4. Count Today's Journals
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Using gte with the Date object - Drizzle handles the mapping for 'timestamp' mode columns
        const [todayReflections] = await db.select({ count: sql<number>`count(*)` })
            .from(reflections)
            // Fix: Compare against timestamp integer
            .where(sql`${reflections.created_at} >= ${today.getTime()}`);

    // 5. At Risk Students (Avg Score < 60)
    // This is a bit complex in Drizzle without aggregation subqueries easily mapped.
    // For simple SQLite, we can fetch all results and process in JS (if dataset is small)
    // OR use a raw query. Let's try a raw query approach or Drizzle's sophisticated builder if possible.
    // Given simplicity, we'll fetch student averages.

    const allResults = await db
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
      // Safe access pattern
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
      const key = row.material_id;
      const set = engagedMap.get(key) || new Set();
      set.add(row.student_id);
      engagedMap.set(key, set);
    });

    const quizAgg = new Map();
    quizRows.forEach((row) => {
      if (!row.material_id) return;
      const entry = quizAgg.get(row.material_id) || { total: 0, count: 0, pass: 0, students: new Set() };
      entry.total += row.score;
      entry.count += 1;
      entry.students.add(row.student_id);
      if (row.score >= row.passing_score) entry.pass += 1;
      quizAgg.set(row.material_id, entry);
    });

    const result = materialsList.map((m) => {
      const totalStudents = !m.major_target || m.major_target === "Semua" ? totalAll : (totalByMajor.get(m.major_target) || 0);
      const engaged = engagedMap.get(m.id) || new Set();
      const quiz = quizAgg.get(m.id) || { total: 0, count: 0, pass: 0, students: new Set() };
      const avg = quiz.count > 0 ? Math.round((quiz.total / quiz.count) * 10) / 10 : 0;
      const passRate = quiz.count > 0 ? Math.round((quiz.pass / quiz.count) * 100) : 0;
      const progressRate = totalStudents > 0
        ? Math.round((((engaged.size / totalStudents) + (quiz.students.size / totalStudents)) / 2) * 100)
        : 0;
      return {
        material_id: m.id,
        title: m.title,
        progress_rate: progressRate,
        average_score: avg,
        pass_rate: passRate,
        active_students: engaged.size,
        total_students: totalStudents
      };
    });

    return c.json(result);
  } catch (e: any) {
    console.error(e);
    return c.json({ error: e.message || String(e) }, 500);
  }
});

// GET /analytics/materials/:id - Detail analytics with hardest questions
app.get("/materials/:id", async (c) => {
  try {
    const materialId = c.req.param("id");
    const [material, studentsList, activityRows, quizRows, quizIds] = await Promise.all([
      db.select().from(materials).where(eq(materials.id, materialId)).limit(1),
      db.select().from(students),
      db.select({ material_id: student_activity.material_id, student_id: student_activity.student_id }).from(student_activity).where(eq(student_activity.material_id, materialId)),
      db.select({ score: quiz_results.score, passing_score: quizzes.passing_score, student_id: quiz_results.student_id, quiz_id: quizzes.id })
        .from(quiz_results)
        .leftJoin(quizzes, eq(quiz_results.quiz_id, quizzes.id))
        .where(eq(quizzes.material_id, materialId)),
      db.select({ id: quizzes.id, passing_score: quizzes.passing_score }).from(quizzes).where(eq(quizzes.material_id, materialId))
    ]);

    if (!material[0]) return c.json({ error: "Material not found" }, 404);

    const totalAll = studentsList.length;
    const totalByMajor = new Map();
    studentsList.forEach((s) => {
      totalByMajor.set(s.major, (totalByMajor.get(s.major) || 0) + 1);
    });

    const engaged = new Set(activityRows.map((r) => r.student_id));
    const quizStudents = new Set(quizRows.map((r) => r.student_id));
    const totalStudents = !material[0].major_target || material[0].major_target === "Semua" ? totalAll : (totalByMajor.get(material[0].major_target) || 0);

    let totalScore = 0;
    let attempts = 0;
    let passCount = 0;
    quizRows.forEach((r) => {
      totalScore += r.score;
      attempts += 1;
      if (r.score >= r.passing_score) passCount += 1;
    });
    const avg = attempts > 0 ? Math.round((totalScore / attempts) * 10) / 10 : 0;
    const passRate = attempts > 0 ? Math.round((passCount / attempts) * 100) : 0;
    const progressRate = totalStudents > 0
      ? Math.round((((engaged.size / totalStudents) + (quizStudents.size / totalStudents)) / 2) * 100)
      : 0;

    const quizIdList = quizIds.map((q) => q.id);
    let hardest = [];
    if (quizIdList.length > 0) {
      const results = await db.select().from(question_results).where(inArray(question_results.quiz_id, quizIdList));
      const byQuestion = new Map();
      results.forEach((row) => {
        const entry = byQuestion.get(row.question_id) || { total: 0, correct: 0 };
        entry.total += 1;
        if (row.is_correct) entry.correct += 1;
        byQuestion.set(row.question_id, entry);
      });

      const questionIds = Array.from(byQuestion.keys());
      const [quizQuestions, bankQuestions] = await Promise.all([
        db.select({ id: questions.id, question_text: questions.question_text }).from(questions).where(inArray(questions.id, questionIds)),
        db.select({ id: question_bank.id, question_text: question_bank.question_text }).from(question_bank).where(inArray(question_bank.id, questionIds))
      ]);
      const textMap = new Map([...quizQuestions, ...bankQuestions].map((q) => [q.id, q.question_text]));

      hardest = questionIds.map((id) => {
        const stats = byQuestion.get(id);
        const correctRate = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
        return {
          question_id: id,
          question_text: textMap.get(id) || "(Soal tidak ditemukan)",
          correct_rate: correctRate,
          attempts: stats.total
        };
      }).sort((a, b) => a.correct_rate - b.correct_rate).slice(0, 5);
    }

    return c.json({
      material_id: material[0].id,
      title: material[0].title,
      progress_rate: progressRate,
      average_score: avg,
      pass_rate: passRate,
      active_students: engaged.size,
      total_students: totalStudents,
      hardest_questions: hardest
    });
  } catch (e: any) {
    console.error(e);
    return c.json({ error: e.message || String(e) }, 500);
  }
});

export default app;
