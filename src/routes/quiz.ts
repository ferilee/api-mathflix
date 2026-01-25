import { Hono } from 'hono';
import { db } from '../db';
import { quizzes, questions, quiz_results, question_bank, question_results } from '../db/schema';
import { eq, inArray, or, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const app = new Hono();

const buildBankQuestions = async (quiz, studentId) => {
    const count = quiz.question_count || 10;
    const mix = quiz.difficulty_mix || {};
    const target = {
        easy: mix.easy ?? Math.floor(count * 0.4),
        medium: mix.medium ?? Math.floor(count * 0.4),
        hard: mix.hard ?? Math.max(0, count - Math.floor(count * 0.4) - Math.floor(count * 0.4)),
    };

    const candidates = await db.select().from(question_bank)
        .where(or(eq(question_bank.material_id, quiz.material_id), isNull(question_bank.material_id)));

    const byDifficulty = {
        easy: candidates.filter((q) => q.difficulty === 'easy'),
        medium: candidates.filter((q) => q.difficulty === 'medium'),
        hard: candidates.filter((q) => q.difficulty === 'hard'),
    };

    const seed = studentId ? `${studentId}_${quiz.id}` : `${quiz.id}_anon`;
    const pick = (list, n, offset) => {
        if (n <= 0) return [];
        const shuffled = shuffleWithSeed(list, seed + offset);
        return shuffled.slice(0, n);
    };

    let selected = [
        ...pick(byDifficulty.easy, target.easy, '_e'),
        ...pick(byDifficulty.medium, target.medium, '_m'),
        ...pick(byDifficulty.hard, target.hard, '_h'),
    ];

    if (selected.length < count) {
        const remaining = candidates.filter((q) => !selected.find((s) => s.id === q.id));
        selected = selected.concat(pick(remaining, count - selected.length, '_r'));
    }

    return shuffleWithSeed(selected, seed + '_final');
};
const shuffleWithSeed = (items, seed) => {
    let s = seed.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const rand = () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

// Schemas
const quizSchema = z.object({
    material_id: z.string(),
    title: z.string().min(1),
    passing_score: z.number().int().min(0).max(100),
    style: z.string().optional(),
    image_url: z.string().optional(),
    created_by: z.string().optional(),
    use_bank: z.boolean().optional(),
    question_count: z.number().int().min(1).max(100).optional(),
    difficulty_mix: z.object({ easy: z.number().int().min(0).optional(), medium: z.number().int().min(0).optional(), hard: z.number().int().min(0).optional() }).optional(),
});

const questionSchema = z.object({
    question_text: z.string().min(1),
    question_type: z.string(), // multiple_choice, essay, multiple_answer, true_false, short_answer, matching
    options: z.array(z.string()),
    correct_answer: z.string().min(1),
});

const submitQuizSchema = z.object({
    student_id: z.string().uuid(),
    quiz_id: z.string().uuid(),
    answers: z.array(z.object({
        question_id: z.string().uuid(),
        user_answer: z.string(),
    })),
});

// GET /quizzes - List all quizzes
app.get('/', async (c) => {
    const allQuizzes = await db.select().from(quizzes);
    return c.json(allQuizzes);
});

// GET /quizzes/:id - Get single quiz with questions
app.get('/:id', async (c) => {
    const quizId = c.req.param('id');
    const studentId = c.req.header('X-Student-ID');
    const quiz = await db.select().from(quizzes).where(eq(quizzes.id, quizId));

    if (quiz.length === 0) {
        return c.json({ error: 'Quiz not found' }, 404);
    }

    const quizData = quiz[0];

    // Fetch questions for this quiz
    let quizQuestions = await db.select().from(questions).where(eq(questions.quiz_id, quizId));

    if (quizData.use_bank) {
        quizQuestions = await buildBankQuestions(quizData, studentId);
    }

    return c.json({
        ...quizData,
        questions: quizQuestions
    });
});

// POST /quizzes - Create a quiz header
app.post('/', zValidator('json', quizSchema), async (c) => {
    const body = c.req.valid('json');
    const result = await db.insert(quizzes).values({
        ...body,
        use_bank: body.use_bank ?? false,
        question_count: body.question_count ?? 10,
        difficulty_mix: body.difficulty_mix || null
    }).returning();
    return c.json(result[0], 201);
});


// PUT /quizzes/:id - Update quiz header
app.put('/:id', zValidator('json', quizSchema.partial()), async (c) => {
    const quizId = c.req.param('id');
    const body = c.req.valid('json');
    const result = await db.update(quizzes).set(body).where(eq(quizzes.id, quizId)).returning();
    if (result.length === 0) {
        return c.json({ error: 'Quiz not found' }, 404);
    }
    return c.json(result[0]);
});

// DELETE /quizzes/:id - Delete a quiz
app.delete('/:id', async (c) => {
    const quizId = c.req.param('id');
    const result = await db.delete(quizzes).where(eq(quizzes.id, quizId)).returning();

    if (result.length === 0) {
        return c.json({ error: 'Quiz not found' }, 404);
    }

    return c.json({ message: 'Quiz deleted successfully', id: quizId });
});

// POST /quizzes/:id/questions - Add questions to a quiz
app.post('/:id/questions', zValidator('json', z.union([questionSchema, z.array(questionSchema)])), async (c) => {
    const quizId = c.req.param('id');
    const body = c.req.valid('json');

    const questionsData = Array.isArray(body) ? body : [body];
    const dataToInsert = questionsData.map(q => ({
        ...q,
        quiz_id: quizId,
    }));

    const result = await db.insert(questions).values(dataToInsert).returning();
    return c.json(result, 201);
});

// GET /materials/:materialId/quiz - Get quiz associated with a specific material (include questions)
// Note: This matches the requirement "Get the quiz associated with a specific material". 
// Since strict REST might suggest this belongs in materials route, but the requirement put it under "Quizzes" section or as a special endpoint.
// I will implement it here effectively as `GET /quizzes/material/:materialId` or similar to keep it clean, 
// OR simpler: strictly follow the path requested: `GET /materials/:materialId/quiz` -> this should logically be in materials or index. 
// However, I can mount this router at /api or similar. 
// The user asked for "GET /materials/:materialId/quiz". I'll put it here but I need to be careful with routing.
// Actually, it's better to put this specific handler where I mount the routes. 
// For now, I'll add a specific route `/material/:materialId` to this file, and mount it accordingly or handle it in index.
// Let's stick to `GET /material/:materialId` within this router (which will be mounted at /quizzes? No, that doesn't match the path).
// I will implement it as `GET /by-material/:materialId` here and alias it, or just handle it. 
// Wait, the requirement says "GET /materials/:materialId/quiz". 
// I will implement it in `src/routes/materials.ts` or add a special route in `index.ts`. 
// Actually, let's put it in `src/routes/quiz.ts` but the path will need to be adjusted if mounted under `/quizzes`.
// If I mount this router at `/quizzes`, then `GET /quizzes/material/:materialId` works.
// BUT the requirement is `GET /materials/:materialId/quiz`. 
// I will add this logic to `materials.ts` instead to respect RESTful nesting, OR I'll add it here and the user can mount it at root or I handle the path logic.
// Let's double check the prompt requirements ("API Endpoints Requirements").
// 2. Quizzes: ... `GET /materials/:materialId/quiz`.
// I will implement this in `src/routes/materials.ts` as it starts with `/materials`.

// POST /submit-quiz - Submit quiz and auto-grade
app.post('/submit-quiz', zValidator('json', submitQuizSchema), async (c) => {
    const { student_id, quiz_id, answers } = c.req.valid('json');

    const questionIds = answers.map((a) => a.question_id);

    // 1. Fetch questions from quiz-specific and bank tables
    const [quizQuestions, bankQuestions] = await Promise.all([
        db.select().from(questions).where(inArray(questions.id, questionIds)),
        db.select().from(question_bank).where(inArray(question_bank.id, questionIds))
    ]);

    const allQuestions = [...quizQuestions, ...bankQuestions];

    if (allQuestions.length === 0) {
        return c.json({ error: 'Quiz has no questions or not found' }, 404);
    }

    // 2. Calculate Score
    let correctCount = 0;
    const questionMap = new Map(allQuestions.map(q => [q.id, q.correct_answer]));

    for (const ans of answers) {
        const correctAnswer = questionMap.get(ans.question_id) || '';
        if (correctAnswer && correctAnswer.trim().toLowerCase() === ans.user_answer.trim().toLowerCase()) {
            correctCount++;
        }
    }

    const totalQuestions = answers.length || allQuestions.length;
    const score = Math.round((correctCount / totalQuestions) * 100);

    // 3. Save result
    const result = await db.insert(quiz_results).values({
        student_id,
        quiz_id,
        score,
    }).returning();

    const answerRows = answers.map((ans) => {
        const correctAnswer = questionMap.get(ans.question_id) || '';
        const isCorrect = correctAnswer && correctAnswer.trim().toLowerCase() === ans.user_answer.trim().toLowerCase();
        return {
            quiz_id,
            question_id: ans.question_id,
            student_id,
            is_correct: Boolean(isCorrect)
        };
    });

    if (answerRows.length > 0) {
        await db.insert(question_results).values(answerRows);
    }

    // 4. Return result
    return c.json({
        message: 'Quiz submitted successfully',
        score: score,
        total_questions: totalQuestions,
        correct_answers: correctCount,
        result_id: result[0]?.id
    });
});

export default app;
