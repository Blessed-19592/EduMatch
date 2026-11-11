import express from 'express';
import { z } from 'zod';

import { requireStudent } from '../middleware/requireRole.js';

import {
  getStudentPortfolios,
  createPortfolio,
  updatePortfolio,
  deletePortfolio
} from '../services/portfolioService.js';

import { AppError } from '../utils/AppError.js';

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

const safeUrl = z.string().url().refine((value) => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}, 'Only HTTP and HTTPS URLs are allowed.');

const portfolioSchema = z.object({
  title: z.string().trim().min(2).max(150),

  description: z.string().trim().max(2000).nullable().optional(),

  evidenceType: z.enum(evidenceTypes),

  evidenceUrl: safeUrl,

  repositoryUrl: safeUrl.nullable().optional(),

  liveDemoUrl: safeUrl.nullable().optional()
}).strict();

const uuidSchema = z.string().uuid();

const validatePortfolio = (req, res, next) => {
  const result = portfolioSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      message: 'Invalid portfolio information.',
      errors: result.error.issues
    });
  }

  req.validatedBody = result.data;
  next();
};

const validatePortfolioId = (req, res, next) => {
  const result = uuidSchema.safeParse(req.params.portfolioId);

  if (!result.success) {
    return res.status(400).json({
      message: 'Invalid portfolio ID.'
    });
  }

  next();
};

// GET /api/students/me/portfolios
router.get('/me/portfolios', async (req, res, next) => {
  try {
    const portfolios = await getStudentPortfolios(
      req.session.user.userId
    );

    res.json({ portfolios });
  } catch (error) {
    next(error);
  }
});

// POST /api/students/me/portfolios
router.post(
  '/me/portfolios',
  validatePortfolio,
  async (req, res, next) => {
    try {
      const portfolio = await createPortfolio(
        req.session.user.userId,
        req.validatedBody
      );

      res.status(201).json({
        message: 'Portfolio created successfully.',
        portfolio
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/students/me/portfolios/:portfolioId
router.patch(
  '/me/portfolios/:portfolioId',
  validatePortfolioId,
  validatePortfolio,
  async (req, res, next) => {
    try {
      const portfolio = await updatePortfolio(
        req.session.user.userId,
        req.params.portfolioId,
        req.validatedBody
      );

      res.json({
        message: 'Portfolio updated successfully.',
        portfolio
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/students/me/portfolios/:portfolioId
router.delete(
  '/me/portfolios/:portfolioId',
  validatePortfolioId,
  async (req, res, next) => {
    try {
      const result = await deletePortfolio(
        req.session.user.userId,
        req.params.portfolioId
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;