import { and, count, desc, eq, getTableColumns, ilike, sql } from "drizzle-orm";
import express from "express";
import { quizzes, quizAttempts, subjects } from "../db/schema/index.js";
import { db } from "../db/index.js";

const router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_MODEL   = "gemini-3.5-flash";
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

async function callGemini(prompt: string): Promise<string> {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${err}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

function extractJSON<T>(raw: string): T {
  // Strip markdown code fences if present
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned) as T;
}

router.get("/", async (req, res) => {
  try {
    const { search, difficulty, subjectId, page = 1, limit = 10, userId } = req.query;

    const currentPage  = Math.max(1, parseInt(page as string, 10) || 1);
    const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
    const offset       = (currentPage - 1) * limitPerPage;

    const filterConditions = [];

    if (search) {
      filterConditions.push(ilike(quizzes.topic, `%${search}%`));
    }

    if (difficulty && ["easy", "medium", "hard"].includes(String(difficulty))) {
      filterConditions.push(
        eq(quizzes.difficulty, difficulty as "easy" | "medium" | "hard"),
      );
    }

    if (subjectId) {
      filterConditions.push(eq(quizzes.subjectId, Number(subjectId)));
    }

    const whereClause =
      filterConditions.length > 0 ? and(...filterConditions) : undefined;

    const countResult = await db
      .select({ count: count() })
      .from(quizzes)
      .where(whereClause);

    const totalCount = countResult[0]?.count ?? 0;

    const quizzesList = await db
      .select({
        ...getTableColumns(quizzes),
        subject: { ...getTableColumns(subjects) },
      })
      .from(quizzes)
      .leftJoin(subjects, eq(quizzes.subjectId, subjects.id))
      .where(whereClause)
      .orderBy(desc(quizzes.createdAt))
      .limit(limitPerPage)
      .offset(offset);

    let annotated: (typeof quizzesList[number] & {
      userAttempt: { id: number; score: number } | null;
    })[] = quizzesList.map((q) => ({ ...q, userAttempt: null }));
 
    if (userId && quizzesList.length > 0) {
      const quizIds = quizzesList.map((q) => q.id);
      const attempts = await db
        .select({
          id:     quizAttempts.id,
          quizId: quizAttempts.quizId,
          score:  quizAttempts.score,
        })
        .from(quizAttempts)
        .where(
          and(
            eq(quizAttempts.userId, String(userId)),
            sql`${quizAttempts.quizId} = ANY(ARRAY[${sql.join(
              quizIds.map((qid) => sql`${qid}`),
              sql`, `,
            )}]::int[])`,
          ),
        );
 
      const attemptMap = new Map(attempts.map((a) => [a.quizId, a]));
      annotated = quizzesList.map((q) => ({
        ...q,
        userAttempt: attemptMap.get(q.id) ?? null,
      }));
    }

    res.status(200).json({
      data: annotated,
      pagination: {
        total: totalCount,
        page: currentPage,
        limit: limitPerPage,
        totalPages: Math.ceil(totalCount / limitPerPage),
      },
    });
  } catch (e) {
    console.error(`GET /quizzes error: ${e}`);
    res.status(500).json({ error: "Failed to fetch quizzes" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { subjectId, topic, numQuestions, difficulty } = req.body;

    if (!subjectId || !topic || !numQuestions || !difficulty) {
      return res.status(400).json({ error: "subjectId, topic, numQuestions and difficulty are required" });
    }

    const [subject] = await db
      .select({ name: subjects.name })
      .from(subjects)
      .where(eq(subjects.id, Number(subjectId)));

    if (!subject) {
      return res.status(404).json({ error: "Subject not found" });
    }

    const prompt = `
You are an expert quiz creator. Generate a ${difficulty} difficulty quiz on the topic "${topic}" for the subject "${subject.name}".

Create exactly ${numQuestions} multiple-choice questions. Each question must have exactly 4 options.

Return ONLY a valid JSON array with no additional text or markdown, in this exact format:
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Option A",
    "explanation": "Brief explanation of why this is correct."
  }
]

Rules:
- correctAnswer must exactly match one of the options strings
- Questions should be clear, unambiguous, and appropriate for ${difficulty} difficulty
- Vary the position of the correct answer across questions
- Return ONLY the JSON array, nothing else
`.trim();

    const rawResponse = await callGemini(prompt);

    type GeminiQuestion = {
      question: string;
      options: string[];
      correctAnswer: string;
      explanation?: string;
    };

    const questions = extractJSON<GeminiQuestion[]>(rawResponse);

    // Validate basic shape
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("Gemini returned invalid question format");
    }

    const [createdQuiz] = await db
      .insert(quizzes)
      .values({
        subjectId: Number(subjectId),
        topic,
        numQuestions: Number(numQuestions),
        difficulty,
        questions,
      })
      .returning({ id: quizzes.id });

    if (!createdQuiz) throw new Error("Failed to insert quiz");

    res.status(201).json({ id: createdQuiz.id });
  } catch (e) {
    console.error(`POST /quizzes error: ${e}`);
    res.status(500).json({ error: "Failed to create quiz" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const quizId = Number(req.params.id);
    const {userId} = req.query;

    if (!Number.isFinite(quizId)) {
      return res.status(400).json({ error: "Invalid quiz id" });
    }

    const [quiz] = await db
      .select({
        ...getTableColumns(quizzes),
        subject: { ...getTableColumns(subjects) },
      })
      .from(quizzes)
      .leftJoin(subjects, eq(quizzes.subjectId, subjects.id))
      .where(eq(quizzes.id, quizId));

    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    const attemptsCount = await db
      .select({ count: count() })
      .from(quizAttempts)
      .where(eq(quizAttempts.quizId, quizId));

    let userAttempt = null;
    if (userId) {
      const [existing] = await db
        .select()
        .from(quizAttempts)
        .where(
          and(
            eq(quizAttempts.quizId, quizId),
            eq(quizAttempts.userId, String(userId)),
          ),
        )
        .limit(1);
      userAttempt = existing ?? null;
    }

    res.status(200).json({
      data: {
        ...quiz,
        userAttempt,
        totals: {
          attempts: attemptsCount[0]?.count ?? 0,
        },
      },
    });
  } catch (e) {
    console.error(`GET /quizzes/:id error: ${e}`);
    res.status(500).json({ error: "Failed to fetch quiz" });
  }
});

router.post("/:id/analyze", async (req, res) => {
  try {
    const quizId = Number(req.params.id);
    const { answers, score, correct, total, userId } = req.body;

    console.log(`[analyze] quizId=${quizId} userId=${userId} score=${score} correct=${correct}/${total}`);

    if (!Number.isFinite(quizId)) {
      return res.status(400).json({ error: "Invalid quiz id" });
    }
    if (!userId) {
      return res.status(400).json({ error: "userId is required to submit an attempt" });
    }
    if (score === undefined || correct === undefined || total === undefined) {
      return res.status(400).json({ error: "score, correct, and total are required" });
    }
    if (!answers || typeof answers !== "object") {
      return res.status(400).json({ error: "answers object is required" });
    }

    // Block duplicate attempts
    const [existingAttempt] = await db
      .select({ id: quizAttempts.id, analysis: quizAttempts.analysis })
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.quizId, quizId),
          eq(quizAttempts.userId, String(userId)),
        ),
      )
      .limit(1);
 
    if (existingAttempt) {
      return res.status(409).json({
        error: "already_attempted",
        message: "You have already attempted this quiz.",
        attemptId: existingAttempt.id,
        analysis: existingAttempt.analysis,
      });
    }

    // Fetch quiz + questions for context
    const [quiz] = await db
      .select({
        ...getTableColumns(quizzes),
        subject: { name: subjects.name },
      })
      .from(quizzes)
      .leftJoin(subjects, eq(quizzes.subjectId, subjects.id))
      .where(eq(quizzes.id, quizId));

    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    // Build per-question context for Gemini
    type QuizQuestion = {
      question: string;
      options: string[];
      correctAnswer: string;
      explanation?: string;
    };

    const questions = quiz.questions as QuizQuestion[];
    const questionSummary = questions
      .map((q, i) => {
        const selected = answers[i] ?? "(not answered)";
        const isCorrect = selected === q.correctAnswer;
        return `Q${i + 1}: "${q.question}"\n  Selected: "${selected}" | Correct: "${q.correctAnswer}" | ${isCorrect ? "✓ Correct" : "✗ Wrong"}`;
      })
      .join("\n");

    const prompt = `
You are an educational AI tutor. A student just completed a quiz on "${quiz.topic}" (subject: ${quiz.subject?.name}, difficulty: ${quiz.difficulty}).

Score: ${correct}/${total} (${score}%)

Question breakdown:
${questionSummary}

Provide a JSON response ONLY (no markdown, no extra text) in this exact format:
{
  "scoreLabel": "one of: Excellent, Good, Average, Needs Improvement, Poor",
  "overallFeedback": "2-3 sentences of encouraging, constructive overall feedback based on the score and topic",
  "questionFeedback": {
    "0": "brief tip for question 0 (especially if wrong)",
    "1": "brief tip for question 1 (especially if wrong)"
  }
}

Rules:
- scoreLabel: 90-100% = Excellent, 75-89% = Good, 60-74% = Average, 40-59% = Needs Improvement, <40% = Poor
- overallFeedback must be encouraging even if the score is low
- questionFeedback: include a short tip for every question (correct or not), max 20 words each
- Return ONLY the JSON object, nothing else
`.trim();

    const rawAnalysis = await callGemini(prompt);

    type AnalysisResult = {
      scoreLabel: string;
      overallFeedback: string;
      questionFeedback: Record<number, string>;
    };

    const analysis = extractJSON<AnalysisResult>(rawAnalysis);

    // Always persist the attempt
    const [savedAttempt] = await db
      .insert(quizAttempts)
      .values({
        quizId,
        userId: String(userId),
        answers,
        score,
        correctCount: correct,
        totalQuestions: total,
        analysis,
      })
      .returning({ id: quizAttempts.id });
      console.log(`[analyze] saved attempt id=${savedAttempt?.id} for userId=${userId} quizId=${quizId}`);

    res.status(200).json({ ...analysis, attemptId: savedAttempt?.id });
  } catch (e) {
    console.error(`POST /quizzes/:id/analyze error: ${e}`);
    res.status(500).json({ error: "Failed to analyze quiz attempt" });
  }
});

router.get("/:id/attempts", async (req, res) => {
  try {
    const quizId = Number(req.params.id);
    const { page = 1, limit = 10 } = req.query;

    if (!Number.isFinite(quizId)) {
      return res.status(400).json({ error: "Invalid quiz id" });
    }

    const currentPage  = Math.max(1, +page);
    const limitPerPage = Math.max(1, +limit);
    const offset       = (currentPage - 1) * limitPerPage;

    const countResult = await db
      .select({ count: count() })
      .from(quizAttempts)
      .where(eq(quizAttempts.quizId, quizId));

    const totalCount = countResult[0]?.count ?? 0;

    const attempts = await db
      .select()
      .from(quizAttempts)
      .where(eq(quizAttempts.quizId, quizId))
      .orderBy(desc(quizAttempts.createdAt))
      .limit(limitPerPage)
      .offset(offset);

    res.status(200).json({
      data: attempts,
      pagination: {
        page: currentPage,
        limit: limitPerPage,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitPerPage),
      },
    });
  } catch (e) {
    console.error(`GET /quizzes/:id/attempts error: ${e}`);
    res.status(500).json({ error: "Failed to fetch quiz attempts" });
  }
});

export default router;
