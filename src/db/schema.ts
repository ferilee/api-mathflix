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
  embedded_tool_url: text('embedded_tool_url'), // GeoGebra or Desmos URL
  tool_type: text('tool_type'), // 'geogebra', 'desmos', 'generic'
  is_featured: integer('is_featured', { mode: 'boolean' }).default(false),
});

// Quizzes Table
export const quizzes = sqliteTable('quizzes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  material_id: text('material_id').notNull().references(() => materials.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  passing_score: integer('passing_score').notNull(),
  style: text('style').default('millionaire'), // 'millionaire' | 'classic'
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

// Posts Table (Discussions)
export const posts = sqliteTable('posts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  content: text('content').notNull(),
  author_id: text('author_id').notNull(), // Can be student ID or 'admin'
  author_name: text('author_name').notNull(),
  author_role: text('author_role').notNull(), // 'student' | 'admin' | 'guru'
  is_locked: integer('is_locked', { mode: 'boolean' }).default(false),
  poll_options: text('poll_options', { mode: 'json' }).$type<{ text: string }[]>(), // Optional JSON array for polls
  embed_code: text('embed_code'), // Optional HTML embed code (iframe, etc)
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Comments Table
export const comments = sqliteTable('comments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  post_id: text('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  author_id: text('author_id').notNull(),
  author_name: text('author_name').notNull(),
  author_role: text('author_role').notNull(),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});


// Cohorts Table
export const cohorts = sqliteTable('cohorts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
});

// Cohort Members Table
export const cohort_members = sqliteTable('cohort_members', {
  cohort_id: text('cohort_id').notNull().references(() => cohorts.id, { onDelete: 'cascade' }),
  student_id: text('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
});

// Assignments Table
export const assignments = sqliteTable('assignments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  description: text('description').notNull(),
  due_date: integer('due_date', { mode: 'timestamp' }).notNull(),
  target_grade: integer('target_grade'), // 10, 11, 12
  target_major: text('target_major'), // 'RPL', 'TKJ', etc.
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Assignment Targets Table
export const assignment_targets = sqliteTable('assignment_targets', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  assignment_id: text('assignment_id').notNull().references(() => assignments.id, { onDelete: 'cascade' }),
  cohort_id: text('cohort_id').references(() => cohorts.id, { onDelete: 'cascade' }),
  student_id: text('student_id').references(() => students.id, { onDelete: 'cascade' }),
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
  cohorts: many(cohort_members),
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


// Poll Votes Table
export const poll_votes = sqliteTable('poll_votes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  post_id: text('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  student_id: text('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  option_index: integer('option_index').notNull(), // Index of the selected option in poll_options array
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const pollVotesRelations = relations(poll_votes, ({ one }) => ({
  post: one(posts, {
    fields: [poll_votes.post_id],
    references: [posts.id],
  }),
  student: one(students, {
    fields: [poll_votes.student_id],
    references: [students.id],
  }),
}));

export const postsRelations = relations(posts, ({ many }) => ({
  comments: many(comments),
  votes: many(poll_votes),
}));


export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, {
    fields: [comments.post_id],
    references: [posts.id],
  }),
}));

export const cohortsRelations = relations(cohorts, ({ many }) => ({
  members: many(cohort_members),
}));

export const cohortMembersRelations = relations(cohort_members, ({ one }) => ({
  cohort: one(cohorts, {
    fields: [cohort_members.cohort_id],
    references: [cohorts.id],
  }),
  student: one(students, {
    fields: [cohort_members.student_id],
    references: [students.id],
  }),
}));

export const assignmentsRelations = relations(assignments, ({ many }) => ({
  targets: many(assignment_targets),
}));

export const assignmentTargetsRelations = relations(assignment_targets, ({ one }) => ({
  assignment: one(assignments, {
    fields: [assignment_targets.assignment_id],
    references: [assignments.id],
  }),
  cohort: one(cohorts, {
    fields: [assignment_targets.cohort_id],
    references: [cohorts.id],
  }),
  student: one(students, {
    fields: [assignment_targets.student_id],
    references: [students.id],
  }),
}));

// Reflections Table (Journal)
export const reflections = sqliteTable('reflections', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  student_id: text('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  mood: text('mood'), // 'happy', 'neutral', 'confused'
  topic: text('topic'),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const reflectionsRelations = relations(reflections, ({ one }) => ({
  student: one(students, {
    fields: [reflections.student_id],
    references: [students.id],
  }),
}));

// Badges Table
export const badges = sqliteTable('badges', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description').notNull(),
  icon: text('icon').notNull(), // emoji or url
  criteria_type: text('criteria_type').notNull(), // 'score', 'count_reflection', 'count_quiz'
  criteria_value: integer('criteria_value').notNull(),
});

// Student Badges (Join Table)
export const student_badges = sqliteTable('student_badges', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  student_id: text('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  badge_id: text('badge_id').notNull().references(() => badges.id, { onDelete: 'cascade' }),
  earned_at: integer('earned_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const studentBadgesRelations = relations(student_badges, ({ one }) => ({
  student: one(students, {
    fields: [student_badges.student_id],
    references: [students.id],
  }),
  badge: one(badges, {
    fields: [student_badges.badge_id],
    references: [badges.id],
  }),
}));

// Assignment Submissions Table
export const assignment_submissions = sqliteTable('assignment_submissions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  assignment_id: text('assignment_id').notNull().references(() => assignments.id, { onDelete: 'cascade' }),
  student_id: text('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  submission_url: text('submission_url'), // Link to Google Drive/Docs
  submission_note: text('submission_note'),
  submitted_at: integer('submitted_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  grade: integer('grade'), // 0-100
  feedback: text('feedback'),
});

export const assignmentSubmissionsRelations = relations(assignment_submissions, ({ one }) => ({
  assignment: one(assignments, {
    fields: [assignment_submissions.assignment_id],
    references: [assignments.id],
  }),
  student: one(students, {
    fields: [assignment_submissions.student_id],
    references: [students.id],
  }),
}));
