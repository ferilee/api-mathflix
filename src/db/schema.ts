import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// Students Table
export const students = sqliteTable("students", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  nisn: text("nisn").notNull().unique(),
  full_name: text("full_name").notNull(),
  major: text("major").notNull(),
  grade_level: integer("grade_level").notNull(),
  school: text("school").default("Unknown"),
  teacher_id: text("teacher_id"),
  teacher_name: text("teacher_name"),
  password_hash: text("password_hash"),
  login_count: integer("login_count").notNull().default(0),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Teachers Table
export const teachers = sqliteTable("teachers", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  nip: text("nip").notNull().unique(),
  full_name: text("full_name").notNull(),
  school: text("school").notNull(),
  status: text("status").notNull().default("approved"),
  password_hash: text("password_hash"),
  login_count: integer("login_count").notNull().default(0),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Audit Logs Table
export const audit_logs = sqliteTable("audit_logs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entity_id: text("entity_id").notNull(),
  summary: text("summary"),
  actor_id: text("actor_id").notNull(),
  actor_name: text("actor_name").notNull(),
  actor_role: text("actor_role").notNull(),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Materials Table
export const materials = sqliteTable("materials", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description"), // Short description for cards/hero
  content: text("content").notNull(),
  major_target: text("major_target"), // Optional
  target_grade: integer("target_grade"), // Optional
  teacher_name: text("teacher_name").default("Feri Dwi Hermawan"),
  created_by: text("created_by"),
  embedded_tool_url: text("embedded_tool_url"), // GeoGebra or Desmos URL (legacy - kept for backward compatibility)
  tool_type: text("tool_type"), // 'geogebra', 'desmos', 'generic' (legacy - kept for backward compatibility)
  is_featured: integer("is_featured", { mode: "boolean" }).default(false),
  image_url: text("image_url"), // Background image URL for card display
  // Per-stage embed tools
  discover_tool_type: text("discover_tool_type"),
  discover_tool_url: text("discover_tool_url"),
  explore_tool_type: text("explore_tool_type"),
  explore_tool_url: text("explore_tool_url"),
  launch_tool_type: text("launch_tool_type"),
  launch_tool_url: text("launch_tool_url"),
  transform_tool_type: text("transform_tool_type"),
  transform_tool_url: text("transform_tool_url"),
  assess_tool_type: text("assess_tool_type"),
  assess_tool_url: text("assess_tool_url"),
});

// Quizzes Table
export const quizzes = sqliteTable("quizzes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  material_id: text("material_id")
    .notNull()
    .references(() => materials.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  passing_score: integer("passing_score").notNull(),
  style: text("style").default("millionaire"), // 'millionaire' | 'classic'
  image_url: text("image_url"), // Background image URL for card display
  created_by: text("created_by"),
  use_bank: integer("use_bank", { mode: "boolean" }).default(false),
  question_count: integer("question_count").default(10),
  difficulty_mix: text("difficulty_mix", { mode: "json" })
    .$type<{ easy?: number; medium?: number; hard?: number }>(),
});

// Questions Table
// options stored as JSON string. Drizzle doesn't have native JSON for SQLite but we can use mode: 'json' with textual storage if using 'text' with { mode: 'json' } in some drivers,
// but for standard sqlite-core text, we'll serialize/deserialize manually or rely on Drizzle's helpers if available.
// Actually, with 'text', we can specify { mode: 'json' } to let Drizzle handle parsing.
// Question Bank (Global)
export const question_bank = sqliteTable("question_bank", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  material_id: text("material_id").references(() => materials.id, { onDelete: "set null" }),
  question_text: text("question_text").notNull(),
  question_type: text("question_type").notNull(),
  options: text("options", { mode: "json" }).$type<string[]>().notNull(),
  correct_answer: text("correct_answer").notNull(),
  difficulty: text("difficulty").notNull(),
  tags: text("tags", { mode: "json" }).$type<string[]>().default([]),
  image_url: text("image_url"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const questions = sqliteTable("questions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  quiz_id: text("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  question_text: text("question_text").notNull(),
  question_type: text("question_type").notNull(), // 'multiple_choice' | 'essay'
  options: text("options", { mode: "json" }).$type<string[]>().notNull(), // JSON array of strings
  correct_answer: text("correct_answer").notNull(),
});

// Quiz Results Table
export const quiz_results = sqliteTable("quiz_results", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  student_id: text("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  quiz_id: text("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  score: integer("score").notNull(),
  submitted_at: integer("submitted_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Announcements Table
// Quiz Question Results (for analytics)
export const question_results = sqliteTable("question_results", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  quiz_id: text("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  question_id: text("question_id").notNull(),
  student_id: text("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  is_correct: integer("is_correct", { mode: "boolean" }).notNull(),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const announcements = sqliteTable("announcements", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  content: text("content").notNull(),
  target_all: integer("target_all", { mode: "boolean" }).default(true),
  target_grades: text("target_grades", { mode: "json" })
    .$type<number[]>()
    .default([]),
  target_majors: text("target_majors", { mode: "json" })
    .$type<string[]>()
    .default([]),
  target_cohorts: text("target_cohorts", { mode: "json" })
    .$type<string[]>()
    .default([]),
  attachments: text("attachments", { mode: "json" })
    .$type<
      Array<{
        type: "image" | "pdf" | "file" | "link";
        url: string;
        name?: string;
        size?: number;
      }>
    >()
    .default([]),
  is_pinned: integer("is_pinned", { mode: "boolean" }).default(false),
  priority: text("priority").default("normal"),
  created_by: text("created_by"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  rubric: text("rubric", { mode: "json" })
    .$type<
      Array<{
        id: string;
        title: string;
        description?: string;
        max_score: number;
      }>
    >(),
});


// Announcement Reads
export const announcement_reads = sqliteTable("announcement_reads", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  announcement_id: text("announcement_id")
    .notNull()
    .references(() => announcements.id, { onDelete: "cascade" }),
  student_id: text("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  read_at: integer("read_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Posts Table (Discussions)
export const posts = sqliteTable("posts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  content: text("content").notNull(),
  author_id: text("author_id").notNull(), // Can be student ID or 'admin'
  author_name: text("author_name").notNull(),
  author_role: text("author_role").notNull(), // 'student' | 'admin' | 'guru'
  is_locked: integer("is_locked", { mode: "boolean" }).default(false),
  embed_code: text("embed_code"), // Optional HTML embed code (iframe, etc)
  category: text("category").default("Umum"),
  tags: text("tags", { mode: "json" }).$type<string[]>().default([]),
  solved_comment_id: text("solved_comment_id"),
  last_activity_at: integer("last_activity_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Comments Table
// Discussion Likes
export const discussion_likes = sqliteTable("discussion_likes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  post_id: text("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  user_id: text("user_id").notNull(),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Discussion Follows (for notifications)
export const discussion_follows = sqliteTable("discussion_follows", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  post_id: text("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  user_id: text("user_id").notNull(),
  last_read_at: integer("last_read_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const comments = sqliteTable("comments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  post_id: text("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  author_id: text("author_id").notNull(),
  author_name: text("author_name").notNull(),
  author_role: text("author_role").notNull(),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Cohorts Table
export const cohorts = sqliteTable("cohorts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  created_by: text("created_by"),
});

// Cohort Members Table
export const cohort_members = sqliteTable("cohort_members", {
  cohort_id: text("cohort_id")
    .notNull()
    .references(() => cohorts.id, { onDelete: "cascade" }),
  student_id: text("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
});

// Assignments Table
export const assignments = sqliteTable("assignments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description").notNull(),
  due_date: integer("due_date", { mode: "timestamp" }).notNull(),
  target_grade: integer("target_grade"), // 10, 11, 12
  target_major: text("target_major"), // 'RPL', 'TKJ', etc.
  created_by: text("created_by"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Assignment Targets Table
export const assignment_targets = sqliteTable("assignment_targets", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  assignment_id: text("assignment_id")
    .notNull()
    .references(() => assignments.id, { onDelete: "cascade" }),
  cohort_id: text("cohort_id").references(() => cohorts.id, {
    onDelete: "cascade",
  }),
  student_id: text("student_id").references(() => students.id, {
    onDelete: "cascade",
  }),
});

// Relationships
export const materialsRelations = relations(materials, ({ one }) => ({
  quiz: one(quizzes, {
    fields: [materials.id],
    references: [quizzes.material_id],
  }),
}));

export const questionBankRelations = relations(question_bank, ({ one }) => ({
  material: one(materials, {
    fields: [question_bank.material_id],
    references: [materials.id],
  }),
}));

export const questionResultsRelations = relations(question_results, ({ one }) => ({
  quiz: one(quizzes, {
    fields: [question_results.quiz_id],
    references: [quizzes.id],
  }),
  student: one(students, {
    fields: [question_results.student_id],
    references: [students.id],
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

export const discussionLikesRelations = relations(discussion_likes, ({ one }) => ({
  post: one(posts, {
    fields: [discussion_likes.post_id],
    references: [posts.id],
  }),
}));

export const discussionFollowsRelations = relations(discussion_follows, ({ one }) => ({
  post: one(posts, {
    fields: [discussion_follows.post_id],
    references: [posts.id],
  }),
}));

export const announcementReadsRelations = relations(announcement_reads, ({ one }) => ({
  announcement: one(announcements, {
    fields: [announcement_reads.announcement_id],
    references: [announcements.id],
  }),
  student: one(students, {
    fields: [announcement_reads.student_id],
    references: [students.id],
  }),
}));

export const announcementsRelations = relations(announcements, ({ many }) => ({
  reads: many(announcement_reads),
}));

export const postsRelations = relations(posts, ({ many }) => ({
  comments: many(comments),
  likes: many(discussion_likes),
  follows: many(discussion_follows),
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

export const assignmentTargetsRelations = relations(
  assignment_targets,
  ({ one }) => ({
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
  }),
);

// Reflections Table (Journal)
export const reflections = sqliteTable("reflections", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  student_id: text("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  mood: text("mood"), // 'happy', 'neutral', 'confused'
  topic: text("topic"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const reflectionsRelations = relations(reflections, ({ one }) => ({
  student: one(students, {
    fields: [reflections.student_id],
    references: [students.id],
  }),
}));

// Badges Table
export const badges = sqliteTable("badges", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(), // emoji or url
  criteria_type: text("criteria_type").notNull(), // 'score', 'count_reflection', 'count_quiz'
  criteria_value: integer("criteria_value").notNull(),
});

// Student Badges (Join Table)
export const student_badges = sqliteTable("student_badges", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  student_id: text("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  badge_id: text("badge_id")
    .notNull()
    .references(() => badges.id, { onDelete: "cascade" }),
  earned_at: integer("earned_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
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
export const assignment_submissions = sqliteTable("assignment_submissions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  assignment_id: text("assignment_id")
    .notNull()
    .references(() => assignments.id, { onDelete: "cascade" }),
  student_id: text("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  submission_url: text("submission_url"), // Link to Google Drive/Docs
  submission_note: text("submission_note"),
  submitted_at: integer("submitted_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  grade: integer("grade"), // 0-100
  feedback: text("feedback"),
  rubric_scores: text("rubric_scores", { mode: "json" })
    .$type<
      Array<{
        rubric_id: string;
        score: number;
        comment?: string;
      }>
    >(),
});

// Student Activity Log (Session-based)
export const student_activity = sqliteTable("student_activity", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  student_id: text("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  material_id: text("material_id")
    .notNull()
    .references(() => materials.id, { onDelete: "cascade" }),
  started_at: integer("started_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  ended_at: integer("ended_at", { mode: "timestamp" }),
  duration_seconds: integer("duration_seconds"),
});

export const studentActivityRelations = relations(student_activity, ({ one }) => ({
  student: one(students, {
    fields: [student_activity.student_id],
    references: [students.id],
  }),
  material: one(materials, {
    fields: [student_activity.material_id],
    references: [materials.id],
  }),
}));

export const assignmentSubmissionsRelations = relations(
  assignment_submissions,
  ({ one }) => ({
    assignment: one(assignments, {
      fields: [assignment_submissions.assignment_id],
      references: [assignments.id],
    }),
    student: one(students, {
      fields: [assignment_submissions.student_id],
      references: [students.id],
    }),
  }),
);
