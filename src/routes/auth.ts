import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { db } from "../db";
import { students, teachers } from "../db/schema";
import { eq } from "drizzle-orm";

const app = new Hono();

const studentLoginSchema = z.object({
  nisn: z.string().min(1),
  password: z.string().optional(),
});

const studentSetPasswordSchema = z.object({
  nisn: z.string().min(1),
  password: z.string().min(6),
});

const studentResetPasswordSchema = z.object({
  nisn: z.string().min(1),
  password: z.string().min(6).optional(),
});

const teacherLoginSchema = z.object({
  nip: z.string().min(1),
  password: z.string().optional(),
});

const teacherSetPasswordSchema = z.object({
  nip: z.string().min(1),
  password: z.string().min(6),
});

const teacherResetPasswordSchema = z.object({
  nip: z.string().min(1),
  password: z.string().min(6).optional(),
});

const adminLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const toStudentUser = (student: any) => ({
  id: student.id,
  nisn: student.nisn,
  full_name: student.full_name,
  major: student.major,
  grade_level: student.grade_level,
  school: student.school,
  role: "student" as const,
});

const toTeacherUser = (teacher: any) => ({
  id: teacher.id,
  nip: teacher.nip,
  full_name: teacher.full_name,
  school: teacher.school,
  role: "guru" as const,
});

const hashPassword = async (password: string) =>
  Bun.password.hash(password, { algorithm: "bcrypt" });

const verifyPassword = async (password: string, hash: string) =>
  Bun.password.verify(password, hash);

const MAX_PASSWORDLESS_LOGINS = Number(process.env.MAX_PASSWORDLESS_LOGINS || 5);

const generateTempPassword = (length = 10) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let result = "";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i += 1) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
};

app.post("/student/login", zValidator("json", studentLoginSchema), async (c) => {
  const { nisn, password } = c.req.valid("json");
  const student = await db.query.students.findFirst({
    where: eq(students.nisn, nisn),
  });

  if (!student) {
    return c.json({ error: "NISN tidak ditemukan.", code: "NOT_FOUND" }, 404);
  }

  if (!student.password_hash) {
    const currentCount = Number(student.login_count || 0);
    if (currentCount < MAX_PASSWORDLESS_LOGINS) {
      await db
        .update(students)
        .set({ login_count: currentCount + 1 })
        .where(eq(students.id, student.id));
      return c.json({
        user: toStudentUser({ ...student, login_count: currentCount + 1 }),
      });
    }
    return c.json(
      {
        error: "Silakan buat password baru.",
        code: "PASSWORD_SETUP_REQUIRED",
        user: toStudentUser(student),
      },
      409,
    );
  }

  if (!password || password.length === 0) {
    return c.json({ error: "Password diperlukan.", code: "PASSWORD_REQUIRED" }, 401);
  }

  const ok = await verifyPassword(password, student.password_hash);
  if (!ok) {
    return c.json({ error: "Password salah.", code: "INVALID_CREDENTIALS" }, 401);
  }

  return c.json({ user: toStudentUser(student) });
});

app.post(
  "/student/set-password",
  zValidator("json", studentSetPasswordSchema),
  async (c) => {
    const { nisn, password } = c.req.valid("json");
    const student = await db.query.students.findFirst({
      where: eq(students.nisn, nisn),
    });

    if (!student) {
      return c.json({ error: "NISN tidak ditemukan.", code: "NOT_FOUND" }, 404);
    }

    if (student.password_hash) {
      return c.json(
        { error: "Password sudah dibuat.", code: "PASSWORD_ALREADY_SET" },
        409,
      );
    }

    const finalPassword =
      password && password.trim().length >= 6
        ? password.trim()
        : generateTempPassword();
    const passwordHash = await hashPassword(finalPassword);
    const updated = await db
      .update(students)
      .set({ password_hash: passwordHash })
      .where(eq(students.id, student.id))
      .returning();

    return c.json({ user: toStudentUser(updated[0]), temp_password: finalPassword });
  },
);

app.post(
  "/student/reset-password",
  zValidator("json", studentResetPasswordSchema),
  async (c) => {
    const { nisn, password } = c.req.valid("json");
    const student = await db.query.students.findFirst({
      where: eq(students.nisn, nisn),
    });

    if (!student) {
      return c.json({ error: "NISN tidak ditemukan.", code: "NOT_FOUND" }, 404);
    }

    const finalPassword =
      password && password.trim().length >= 6
        ? password.trim()
        : generateTempPassword();
    const passwordHash = await hashPassword(finalPassword);
    const updated = await db
      .update(students)
      .set({ password_hash: passwordHash })
      .where(eq(students.id, student.id))
      .returning();

    return c.json({ user: toStudentUser(updated[0]), temp_password: finalPassword });
  },
);

app.post("/guru/login", zValidator("json", teacherLoginSchema), async (c) => {
  const { nip, password } = c.req.valid("json");
  const teacher = await db.query.teachers.findFirst({
    where: eq(teachers.nip, nip),
  });

  if (!teacher) {
    return c.json({ error: "NIP tidak ditemukan.", code: "NOT_FOUND" }, 404);
  }

  if (teacher.status === "pending") {
    return c.json(
      { error: "Akun guru masih menunggu konfirmasi.", code: "STATUS_PENDING" },
      403,
    );
  }

  if (teacher.status === "rejected") {
    return c.json(
      { error: "Permintaan guru ditolak.", code: "STATUS_REJECTED" },
      403,
    );
  }

  if (!teacher.password_hash) {
    const currentCount = Number(teacher.login_count || 0);
    if (currentCount < MAX_PASSWORDLESS_LOGINS) {
      await db
        .update(teachers)
        .set({ login_count: currentCount + 1 })
        .where(eq(teachers.id, teacher.id));
      return c.json({
        user: toTeacherUser({ ...teacher, login_count: currentCount + 1 }),
      });
    }
    return c.json(
      {
        error: "Silakan buat password baru.",
        code: "PASSWORD_SETUP_REQUIRED",
        user: toTeacherUser(teacher),
      },
      409,
    );
  }

  if (!password || password.length === 0) {
    return c.json({ error: "Password diperlukan.", code: "PASSWORD_REQUIRED" }, 401);
  }

  const ok = await verifyPassword(password, teacher.password_hash);
  if (!ok) {
    return c.json({ error: "Password salah.", code: "INVALID_CREDENTIALS" }, 401);
  }

  return c.json({ user: toTeacherUser(teacher) });
});

app.post(
  "/guru/set-password",
  zValidator("json", teacherSetPasswordSchema),
  async (c) => {
    const { nip, password } = c.req.valid("json");
    const teacher = await db.query.teachers.findFirst({
      where: eq(teachers.nip, nip),
    });

    if (!teacher) {
      return c.json({ error: "NIP tidak ditemukan.", code: "NOT_FOUND" }, 404);
    }

    if (teacher.status === "pending") {
      return c.json(
        { error: "Akun guru masih menunggu konfirmasi.", code: "STATUS_PENDING" },
        403,
      );
    }

    if (teacher.status === "rejected") {
      return c.json(
        { error: "Permintaan guru ditolak.", code: "STATUS_REJECTED" },
        403,
      );
    }

    if (teacher.password_hash) {
      return c.json(
        { error: "Password sudah dibuat.", code: "PASSWORD_ALREADY_SET" },
        409,
      );
    }

    const finalPassword =
      password && password.trim().length >= 6
        ? password.trim()
        : generateTempPassword();
    const passwordHash = await hashPassword(finalPassword);
    const updated = await db
      .update(teachers)
      .set({ password_hash: passwordHash })
      .where(eq(teachers.id, teacher.id))
      .returning();

    return c.json({ user: toTeacherUser(updated[0]), temp_password: finalPassword });
  },
);

app.post(
  "/guru/reset-password",
  zValidator("json", teacherResetPasswordSchema),
  async (c) => {
    const { nip, password } = c.req.valid("json");
    const teacher = await db.query.teachers.findFirst({
      where: eq(teachers.nip, nip),
    });

    if (!teacher) {
      return c.json({ error: "NIP tidak ditemukan.", code: "NOT_FOUND" }, 404);
    }

    if (teacher.status === "pending") {
      return c.json(
        { error: "Akun guru masih menunggu konfirmasi.", code: "STATUS_PENDING" },
        403,
      );
    }

    if (teacher.status === "rejected") {
      return c.json(
        { error: "Permintaan guru ditolak.", code: "STATUS_REJECTED" },
        403,
      );
    }

    const finalPassword =
      password && password.trim().length >= 6
        ? password.trim()
        : generateTempPassword();
    const passwordHash = await hashPassword(finalPassword);
    const updated = await db
      .update(teachers)
      .set({ password_hash: passwordHash })
      .where(eq(teachers.id, teacher.id))
      .returning();

    return c.json({ user: toTeacherUser(updated[0]), temp_password: finalPassword });
  },
);

app.post("/admin/login", zValidator("json", adminLoginSchema), async (c) => {
  const { username, password } = c.req.valid("json");
  const adminUser = process.env.ADMIN_USERNAME || "ferilee";
  const adminPass = process.env.ADMIN_PASSWORD || "F3r!-lee";

  if (username !== adminUser || password !== adminPass) {
    return c.json({ error: "Username atau password salah." }, 401);
  }

  return c.json({ user: { username: adminUser, role: "admin" as const } });
});

export default app;
