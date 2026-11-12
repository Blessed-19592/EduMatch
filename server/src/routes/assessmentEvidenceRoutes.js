
import {
  createSelfReportedAssessment
} from '../services/assessmentEvidenceService.js';
import express from 'express';
import { z } from 'zod';

import { requireStudent } from '../middleware/requireRole.js';

import {
  getStudentAssessments,
  getAssessmentEvidence,
  createAssessmentEvidence,
  deleteAssessmentEvidence

} from '../services/assessmentEvidenceService.js';

const router = express.Router();

router.use(requireStudent);

const evidenceTypes = [
  'github_repository',
  'documentation',
  'live_demo',
  'design_portfolio',
  'research',
  'video_presentation',
  'other'
];
const safeUrl = z
  .string()
  .url()
  .max(2048, 'URL must not exceed 2048 characters.')
  .refine(
    (value) => {
      try {
        const parsedUrl = new URL(value);

        return (
          ['http:', 'https:'].includes(parsedUrl.protocol) &&
          Boolean(parsedUrl.hostname)
        );
      } catch {
        return false;
      }
    },
    'Only valid HTTP and HTTPS URLs are allowed.'
  );

const evidenceSchema = z.object({
  portfolioId: z.string().uuid().nullable().optional(),

  evidenceType: z.enum(evidenceTypes),

  title: z.string().trim().min(2).max(150),

  description: z.string().trim().max(2000).nullable().optional(),

  evidenceUrl: safeUrl.nullable().optional()
}).strict().refine(
  (data) => data.portfolioId || data.evidenceUrl,
  {
    message: 'Provide a portfolio item or an evidence URL.',
    path: ['evidenceUrl']
  }
);

const createAssessmentSchema = z.object({
  skillId: z.string().uuid('Invalid skill ID.')
}).strict();


const validateUuid = (req, res, next) => {
  const ids = [
    req.params.assessmentId,
    req.params.evidenceId
  ].filter(Boolean);

  if (ids.some((id) => !z.string().uuid().safeParse(id).success)) {
    return res.status(400).json({
      message: 'Invalid resource ID.'
    });
  }

  next();
};

// GET /api/students/me/assessments
router.get('/me/assessments', async (req, res, next) => {
  try {
    const assessments = await getStudentAssessments(
      req.session.user.userId
    );

    res.json({ assessments });
  } catch (error) {
    next(error);
  }
});

// POST /api/students/me/assessments
router.post('/me/assessments', async (req, res, next) => {
  try {
    const validation = createAssessmentSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        message: 'Invalid assessment data.',
        errors: validation.error.flatten()
      });
    }

    const result = await createSelfReportedAssessment(
      req.session.user.userId,
      validation.data.skillId
    );

    return res.status(result.alreadyExists ? 200 : 201).json({
      message: result.alreadyExists
        ? 'Self-reported assessment already exists.'
        : 'Self-reported assessment created successfully.',
      ...result
    });
  } catch (error) {
    next(error);
  }
});


// GET /api/students/me/assessments/:assessmentId/evidence
router.get(
  '/me/assessments/:assessmentId/evidence',
  validateUuid,
  async (req, res, next) => {
    try {
      const evidence = await getAssessmentEvidence(
        req.session.user.userId,
        req.params.assessmentId
      );

      res.json({ evidence });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/students/me/assessments/:assessmentId/evidence
router.post(
  '/me/assessments/:assessmentId/evidence',
  validateUuid,
  async (req, res, next) => {
    try {
      const parsed = evidenceSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          message: 'Invalid evidence information.',
          errors: parsed.error.issues
        });
      }

      const evidence = await createAssessmentEvidence(
        req.session.user.userId,
        req.params.assessmentId,
        parsed.data
      );

      res.status(201).json({
        message: 'Assessment evidence submitted successfully.',
        evidence
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/students/me/evidence/:evidenceId
router.delete(
  '/me/evidence/:evidenceId',
  validateUuid,
  async (req, res, next) => {
    try {
      const result = await deleteAssessmentEvidence(
        req.session.user.userId,
        req.params.evidenceId
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;