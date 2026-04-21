import express from "express";
import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";

import { db } from "../db/index.js";
import {
  classes,
  departments,
  enrollments,
  subjects,
  user,
} from "../db/schema/index.js";

const router = express.Router();

// Get all departments with optional search and pagination
router.get("/", async (req, res) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;

    const currentPage = Math.max(1, +page);
    const limitPerPage = Math.max(1, +limit);
    const offset = (currentPage - 1) * limitPerPage;

    const filterConditions = [];

    if (search) {
      filterConditions.push(
        or(
          ilike(departments.name, `%${search}%`),
          ilike(departments.code, `%${search}%`),
        ),
      );
    }

    const whereClause =
      filterConditions.length > 0 ? and(...filterConditions) : undefined;

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(departments)
      .where(whereClause);

    const totalCount = countResult[0]?.count ?? 0;

    const departmentsList = await db
      .select({
        ...getTableColumns(departments),
        totalSubjects: sql<number>`count(${subjects.id})`,
      })
      .from(departments)
      .leftJoin(subjects, eq(departments.id, subjects.departmentId))
      .where(whereClause)
      .groupBy(departments.id)
      .orderBy(desc(departments.createdAt))
      .limit(limitPerPage)
      .offset(offset);

    res.status(200).json({
      data: departmentsList,
      pagination: {
        page: currentPage,
        limit: limitPerPage,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitPerPage),
      },
    });
  } catch (error) {
    console.error("GET /departments error:", error);
    res.status(500).json({ error: "Failed to fetch departments" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { code, name, description } = req.body;

    const [createdDepartment] = await db
      .insert(departments)
      .values({ code, name, description })
      .returning({ id: departments.id });

    if (!createdDepartment) throw Error;

    res.status(201).json({ data: createdDepartment });
  } catch (error) {
    console.error("POST /departments error:", error);
    res.status(500).json({ error: "Failed to create department" });
  }
});

// Get department details with counts
router.get("/:id", async (req, res) => {
  try {
    const departmentId = Number(req.params.id);

    if (!Number.isFinite(departmentId)) {
      return res.status(400).json({ error: "Invalid department id" });
    }

    const [department] = await db
      .select()
      .from(departments)
      .where(eq(departments.id, departmentId));

    if (!department) {
      return res.status(404).json({ error: "Department not found" });
    }

    const [subjectsCount, classesCount, enrolledStudentsCount] =
      await Promise.all([
        db
          .select({ count: sql<number>`count(*)` })
          .from(subjects)
          .where(eq(subjects.departmentId, departmentId)),
        db
          .select({ count: sql<number>`count(${classes.id})` })
          .from(classes)
          .leftJoin(subjects, eq(classes.subjectId, subjects.id))
          .where(eq(subjects.departmentId, departmentId)),
        db
          .select({ count: sql<number>`count(distinct ${user.id})` })
          .from(user)
          .leftJoin(enrollments, eq(user.id, enrollments.studentId))
          .leftJoin(classes, eq(enrollments.classId, classes.id))
          .leftJoin(subjects, eq(classes.subjectId, subjects.id))
          .where(
            and(
              eq(user.role, "student"),
              eq(subjects.departmentId, departmentId),
            ),
          ),
      ]);

    res.status(200).json({
      data: {
        department,
        totals: {
          subjects: subjectsCount[0]?.count ?? 0,
          classes: classesCount[0]?.count ?? 0,
          enrolledStudents: enrolledStudentsCount[0]?.count ?? 0,
        },
      },
    });
  } catch (error) {
    console.error("GET /departments/:id error:", error);
    res.status(500).json({ error: "Failed to fetch department details" });
  }
});

export default router;
