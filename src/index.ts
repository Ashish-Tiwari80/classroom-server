import express from 'express';
import subjectsRouter from './routes/subjects';

const app = express();
const port = 8000;

app.use(express.json());

app.use('/api/subjects', subjectsRouter);

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});