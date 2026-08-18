import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { tasksRouter } from './routes/tasks.js';

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/tasks', tasksRouter);

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`[server] agent backend listening on :${port}`);
});
