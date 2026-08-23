import { Router } from 'express';
import authRoutes from './auth.routes.js';
import subjectRoutes from './subject.routes.js';
import assignmentRoutes from './assignment.routes.js';
import statsRoutes from './stats.routes.js';
import settingsRoutes from './settings.routes.js';
import exportRoutes from './export.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/subjects', subjectRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/stats', statsRoutes);
router.use('/settings', settingsRoutes);
router.use('/export', exportRoutes);

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;
