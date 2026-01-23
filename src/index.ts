import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import studentsRoute from "./routes/students";
import materialsRoute from "./routes/materials";
import quizRoute from "./routes/quiz";
import questionsRoute from "./routes/questions";
import leaderboardRoute from "./routes/leaderboard";
import announcementsRoute from "./routes/announcements";
import discussionsRoute from "./routes/discussions";
import cohortsRoute from "./routes/cohorts";
import assignmentsRoute from "./routes/assignments";
import reflectionsRoute from "./routes/reflections";
import analyticsRoute from "./routes/analytics";
import badgesRoute from "./routes/badges";
import gradingRoute from "./routes/grading";
import uploadRoute from "./routes/upload";
import questionBankRoute from "./routes/questionBank";
import activityRoute from "./routes/activity";
import { ensureBucket } from "./lib/s3";

const app = new Hono();

// Initialize MinIO Bucket
ensureBucket().catch((err) => console.error("MinIO Bucket Init Error:", err));

app.use(
  "/*",
  cors({
    origin: "*", // Allow access from any origin
    allowHeaders: ["Content-Type", "Authorization", "X-Student-ID"],
    allowMethods: ["POST", "GET", "OPTIONS", "DELETE", "PUT"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
);

app.get("/", (c) => {
  return c.text("Hello Micro-Learning API!");
});

app.route("/students", studentsRoute);
app.route("/materials", materialsRoute);
app.route("/quizzes", quizRoute);
app.route("/questions", questionsRoute);
app.route("/leaderboard", leaderboardRoute);
app.route("/announcements", announcementsRoute);
app.route("/discussions", discussionsRoute);
app.route("/cohorts", cohortsRoute);
app.route("/assignments", assignmentsRoute);
app.route("/reflections", reflectionsRoute);
app.route("/analytics", analyticsRoute);
app.route("/badges", badgesRoute);
app.route("/grading", gradingRoute);
app.route("/upload", uploadRoute);
app.route("/question-bank", questionBankRoute);
app.route("/activity", activityRoute);

// Serve static files from uploads directory
app.use("/uploads/*", serveStatic({ root: "./" }));

// Strict /submit-quiz endpoint as requested
app.post("/submit-quiz", async (c) => {
  return c.redirect("/quizzes/submit-quiz", 307);
});


const port = Number(process.env.PORT || process.env.BUN_PORT) || 3000;
if (import.meta.main) {
  const server = Bun.serve({ fetch: app.fetch, port });
  console.log(`API server running on ${server.protocol}://${server.hostname}:${server.port}`);
}

export default app;
