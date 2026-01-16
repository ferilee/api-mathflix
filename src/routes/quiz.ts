import { Hono } from 'hono';
import { db } from '../db';
import { quizzes, questions, quiz_results } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const app = new Hono();

// Schemas
const quizSchema = z.object({
    material_id: z.string().uuid(),
    title: z.string().min(1),
    passing_score: z.number().int().min(0).max(100),
});

const questionSchema = z.object({
    question_text: z.string().min(1),
    question_type: z.enum(['multiple_choice', 'essay']),
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
    const quiz = await db.select().from(quizzes).where(eq(quizzes.id, quizId));

    if (quiz.length === 0) {
        return c.json({ error: 'Quiz not found' }, 404);
    }

    // Fetch questions for this quiz
    const quizQuestions = await db.select().from(questions).where(eq(questions.quiz_id, quizId));

    return c.json({
        ...quiz[0],
        questions: quizQuestions
    });
});

// POST /quizzes - Create a quiz header
app.post('/', zValidator('json', quizSchema), async (c) => {
    const body = c.req.valid('json');
    const result = await db.insert(quizzes).values(body).returning();
    return c.json(result[0], 201);
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

    // 1. Fetch all questions for this quiz to get correct answers
    const quizQuestions = await db.select().from(questions).where(eq(questions.quiz_id, quiz_id));

    if (quizQuestions.length === 0) {
        return c.json({ error: 'Quiz has no questions or not found' }, 404);
    }

    // 2. Calculate Score
    let correctCount = 0;
    // Create a map for faster lookup
    const questionMap = new Map(quizQuestions.map(q => [q.id, q.correct_answer]));

    for (const ans of answers) {
        const correctAnswer = questionMap.get(ans.question_id);
        if (correctAnswer && correctAnswer.trim().toLowerCase() === ans.user_answer.trim().toLowerCase()) {
            correctCount++;
        }
    }

    const totalQuestions = quizQuestions.length;
    const score = Math.round((correctCount / totalQuestions) * 100);

    // 3. Save result
    const result = await db.insert(quiz_results).values({
        student_id,
        quiz_id,
        score,
    }).returning();

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
