// ── Add near your other route imports ──
import leaderboardRoutes from './routes/leaderboard.js';
import numbersRoutes from './routes/numbers.js';
import apiV1Routes from './routes/api-v1.js';

// ── Mount routes (add after your existing app.use() calls) ──
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/numbers', numbersRoutes);
app.use('/api/v1', apiV1Routes);
