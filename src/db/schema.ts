import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// Students Table
export const students = sqliteTable('students', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  nisn: text('nisn').notNull().unique(),
  full_name: text('full_name').notNull(),
  major: text('major').notNull(),
  grade_level: integer('grade_level').notNull(),
});

// Materials Table
export const materials = sqliteTable('materials', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  description: text('description'), // Short description for cards/hero
  content: text('content').notNull(),
  major_target: text('major_target'), // Optional
  teacher_name: text('teacher_name').default('Feri Dwi Hermawan'),
  is_featured: integer('is_featured', { mode: 'boolean' }).default(false),
});

// Quizzes Table
export const quizzes = sqliteTable('quizzes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  material_id: text('material_id').notNull().references(() => materials.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  passing_score: integer('passing_score').notNull(),
});

// Questions Table
// options stored as JSON string. Drizzle doesn't have native JSON for SQLite but we can use mode: 'json' with textual storage if using 'text' with { mode: 'json' } in some drivers, 
// but for standard sqlite-core text, we'll serialize/deserialize manually or rely on Drizzle's helpers if available.
// Actually, with 'text', we can specify { mode: 'json' } to let Drizzle handle parsing.
export const questions = sqliteTable('questions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  quiz_id: text('quiz_id').notNull().references(() => quizzes.id, { onDelete: 'cascade' }),
  question_text: text('question_text').notNull(),
  question_type: text('question_type').notNull(), // 'multiple_choice' | 'essay'
  options: text('options', { mode: 'json' }).$type<string[]>().notNull(), // JSON array of strings
  correct_answer: text('correct_answer').notNull(),
});

// Quiz Results Table
export const quiz_results = sqliteTable('quiz_results', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  student_id: text('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  quiz_id: text('quiz_id').notNull().references(() => quizzes.id, { onDelete: 'cascade' }),
  score: integer('score').notNull(),
  submitted_at: integer('submitted_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Announcements Table
export const announcements = sqliteTable('announcements', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  content: text('content').notNull(),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Relationships
export const materialsRelations = relations(materials, ({ one }) => ({
  quiz: one(quizzes, {
    fields: [materials.id],
    references: [quizzes.material_id],
  }),
}));

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  material: one(materials, {
    fields: [quizzes.material_id],
    references: [materials.id],
  }),
  questions: many(questions),
  results: many(quiz_results),
}));

export const questionsRelations = relations(questions, ({ one }) => ({
  quiz: one(quizzes, {
    fields: [questions.quiz_id],
    references: [quizzes.id],
  }),
}));

export const studentsRelations = relations(students, ({ many }) => ({
  quiz_results: many(quiz_results),
}));

export const quizResultsRelations = relations(quiz_results, ({ one }) => ({
  student: one(students, {
    fields: [quiz_results.student_id],
    references: [students.id],
  }),
  quiz: one(quizzes, {
    fields: [quiz_results.quiz_id],
    references: [quizzes.id],
  }),
}));
