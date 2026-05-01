import('apminsight')
  .then(({ default: AgentAPI }) => AgentAPI.config())
  .catch(() => console.log('APM not available in this environment'));

import express from 'express';
import cors from 'cors';
import subjectsRouter from './routes/subjects.js';
import usersRouter from './routes/users.js';
import departmentsRouter from './routes/departments.js';
import classesRouter from './routes/classes.js';
import enrollmentsRouter from './routes/enrollments.js'
import securityMiddleware from './middleware/security.js';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth.js';

const app = express();
const port = 8000;

if (!process.env.FRONTEND_URL) throw new Error('FRONTEND_URL is not set in .env file');

app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
  credentials: true,
}));

app.all('/api/auth/*splat', toNodeHandler(auth));

app.use(express.json());

app.use(securityMiddleware);

app.use('/api/subjects', subjectsRouter);
app.use('/api/users', usersRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/classes', classesRouter);
app.use('/api/enrollments', enrollmentsRouter);

app.get('/', (req, res) => {
  res.send('Backend server is running!');
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});