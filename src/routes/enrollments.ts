import { and, eq, getTableColumns, count, ilike } from "drizzle-orm";
import express from "express";
import {
  classes,
  departments,
  enrollments,
  subjects,
  user,
} from "../db/schema/index.js";
import { db } from "../db/index.js";

const router = express.Router();

// FIX 1: enrollments has NO id column — composite PK is (studentId, classId).
// So getEnrollmentDetails must look up by studentId + classId, not by a single id.
const getEnrollmentDetails = async (studentId: string, classId: number) => {
  const [enrollment] = await db
    .select({
      ...getTableColumns(enrollments),
      class: {
        ...getTableColumns(classes),
      },
      subject: {
        ...getTableColumns(subjects),
      },
      department: {
        ...getTableColumns(departments),
      },
      teacher: {
        ...getTableColumns(user),
      },
    })
    .from(enrollments)
    .leftJoin(classes, eq(enrollments.classId, classes.id))
    .leftJoin(subjects, eq(classes.subjectId, subjects.id))
    .leftJoin(departments, eq(subjects.departmentId, departments.id))
    .leftJoin(user, eq(classes.teacherId, user.id))
    .where(
      and(
        eq(enrollments.studentId, studentId),
        eq(enrollments.classId, classId),
      ),
    );

  return enrollment;
};

// Get all enrollments for a student — used by frontend list page
router.get("/student/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    const { search } = req.query;

    if (!studentId)
      return res.status(400).json({ error: "studentId is required" });

    const filterConditions = [eq(enrollments.studentId, studentId)];

    if (search) {
      filterConditions.push(ilike(classes.name, `%${search}%`));
    }

    const results = await db
      .select({
        studentId: enrollments.studentId,
        classId: enrollments.classId,
      })
      .from(enrollments)
      .leftJoin(classes, eq(enrollments.classId, classes.id))
      .where(and(...filterConditions));

    res.status(200).json({ data: results }); // returns [{ studentId, classId }]
  } catch (error) {
    console.error("GET /enrollments/student/:studentId error:", error);
    res.status(500).json({ error: "Failed to fetch enrollments" });
  }
});

// Get enrollment by studentId + classId
router.get("/:studentId/:classId", async (req, res) => {
  try {
    const { studentId } = req.params;
    const classId = parseInt(req.params.classId, 10);

    if (!studentId || isNaN(classId)) {
      return res
        .status(400)
        .json({ error: "Valid studentId and classId are required" });
    }

    const enrollment = await getEnrollmentDetails(studentId, classId);

    if (!enrollment) {
      return res.status(404).json({ error: "Enrollment not found" });
    }

    res.status(200).json({ data: enrollment });
  } catch (error) {
    console.error("GET /enrollments/:studentId/:classId error:", error);
    res.status(500).json({ error: "Failed to fetch enrollment" });
  }
});

// Create enrollment
router.post("/", async (req, res) => {
  try {
    const { classId, studentId } = req.body;

    if (
      !classId ||
      !studentId ||
      typeof studentId !== "string" ||
      !Number.isInteger(classId)
    ) {
      return res.status(400).json({
        error: "classId (integer) and studentId (string) are required",
      });
    }

    const [classRecord] = await db
      .select()
      .from(classes)
      .where(eq(classes.id, classId));
    if (!classRecord) return res.status(404).json({ error: "Class not found" });

    const [row] = await db
      .select({ enrolledCount: count() })
      .from(enrollments)
      .where(eq(enrollments.classId, classId));

    const enrolledCount = row?.enrolledCount ?? 0;

    if (enrolledCount >= classRecord.capacity)
      return res.status(409).json({ error: "Class is at full capacity" });

    const [student] = await db
      .select()
      .from(user)
      .where(eq(user.id, studentId));
    if (!student) return res.status(404).json({ error: "Student not found" });

    const [existingEnrollment] = await db
      .select({ studentId: enrollments.studentId })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.classId, classId),
          eq(enrollments.studentId, studentId),
        ),
      );

    if (existingEnrollment)
      return res
        .status(409)
        .json({ error: "Student already enrolled in this class" });

    await db.insert(enrollments).values({ classId, studentId });

    const enrollment = await getEnrollmentDetails(studentId, classId);
    if (!enrollment)
      return res
        .status(500)
        .json({ error: "Failed to retrieve enrollment after creation" });

    res.status(201).json({ data: enrollment });
  } catch (error) {
    console.error("POST /enrollments error:", error);
    res.status(500).json({ error: "Failed to create enrollment" });
  }
});

// Delete (unenroll) by studentId + classId
router.delete("/:studentId/:classId", async (req, res) => {
  try {
    const { studentId } = req.params;
    const classId = parseInt(req.params.classId, 10);

    if (!studentId || isNaN(classId)) {
      return res
        .status(400)
        .json({ error: "Valid studentId and classId are required" });
    }

    const existing = await getEnrollmentDetails(studentId, classId);
    if (!existing) {
      return res.status(404).json({ error: "Enrollment not found" });
    }

    await db
      .delete(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.classId, classId),
        ),
      );

    res.status(200).json({ message: "Enrollment deleted successfully" });
  } catch (error) {
    console.error("DELETE /enrollments/:studentId/:classId error:", error);
    res.status(500).json({ error: "Failed to delete enrollment" });
  }
});

// Join class by invite code
router.post("/join", async (req, res) => {
  try {
    const { inviteCode, studentId } = req.body;

    if (!inviteCode || !studentId) {
      return res
        .status(400)
        .json({ error: "inviteCode and studentId are required" });
    }

    const [classRecord] = await db
      .select()
      .from(classes)
      .where(eq(classes.inviteCode, inviteCode));

    if (!classRecord) return res.status(404).json({ error: "Class not found" });

    const [student] = await db
      .select()
      .from(user)
      .where(eq(user.id, studentId));

    if (!student) return res.status(404).json({ error: "Student not found" });

    const [existingEnrollment] = await db
      .select({ studentId: enrollments.studentId })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.classId, classRecord.id),
          eq(enrollments.studentId, studentId),
        ),
      );

    if (existingEnrollment)
      return res
        .status(409)
        .json({ error: "Student already enrolled in class" });

    await db.insert(enrollments).values({ classId: classRecord.id, studentId });

    const enrollment = await getEnrollmentDetails(studentId, classRecord.id);

    if (!enrollment)
      return res.status(500).json({ error: "Failed to join class" });

    res.status(201).json({ data: enrollment });
  } catch (error) {
    console.error("POST /enrollments/join error:", error);
    res.status(500).json({ error: "Failed to join class" });
  }
});

export default router;
