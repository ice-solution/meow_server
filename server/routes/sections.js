const express = require('express');
const { body, validationResult } = require('express-validator');
const { adminKeyAuth } = require('../middleware/adminKeyAuth');
const Section = require('../models/Section');
const { createLogger } = require('../utils/logger');

const router = express.Router();
const log = createLogger('Sections');

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get('/', adminKeyAuth, async (req, res) => {
  log.start('GET /sections', { q: req.query.q, page: req.query.page });
  try {
    const { q = '', page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));

    const query = {};
    const s = String(q || '').trim();
    if (s) {
      const safe = escapeRegex(s);
      query.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } },
        { seasonKey: { $regex: safe, $options: 'i' } },
      ];
    }

    const total = await Section.countDocuments(query);
    const items = await Section.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    log.ok('list sections', { total, page: pageNum });
    res.json({ data: { items, pagination: { current: pageNum, pages: Math.ceil(total / limitNum), total } } });
  } catch (error) {
    log.error('list sections error', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

router.post('/', [
  adminKeyAuth,
  body('name').trim().isLength({ min: 1, max: 80 }).withMessage('名稱必須為 1-80 字'),
  body('description').optional().isString().isLength({ max: 500 }).withMessage('描述最多 500 字'),
  body('seasonKey').optional().isString().isLength({ min: 1, max: 64 }).withMessage('seasonKey 必須為 1-64 字'),
  body('isActive').optional().isBoolean().withMessage('isActive 必須為 true/false'),
], async (req, res) => {
  log.start('POST /sections', { name: req.body.name });
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

    const item = await Section.create({
      name: req.body.name,
      description: req.body.description || '',
      seasonKey: req.body.seasonKey || 'season-1',
      isActive: req.body.isActive !== undefined ? !!req.body.isActive : true,
    });

    log.ok('section created', { id: item._id, name: item.name });
    res.status(201).json({ message: 'Section 已建立', data: { item } });
  } catch (error) {
    log.error('create section error', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

router.put('/:id', [
  adminKeyAuth,
  body('name').optional().trim().isLength({ min: 1, max: 80 }).withMessage('名稱必須為 1-80 字'),
  body('description').optional().isString().isLength({ max: 500 }).withMessage('描述最多 500 字'),
  body('seasonKey').optional().isString().isLength({ min: 1, max: 64 }).withMessage('seasonKey 必須為 1-64 字'),
  body('isActive').optional().isBoolean().withMessage('isActive 必須為 true/false'),
], async (req, res) => {
  log.start('PUT /sections/:id', { id: req.params.id });
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

    const item = await Section.findByIdAndUpdate(
      req.params.id,
      {
        ...(req.body.name !== undefined ? { name: req.body.name } : {}),
        ...(req.body.description !== undefined ? { description: req.body.description } : {}),
        ...(req.body.seasonKey !== undefined ? { seasonKey: req.body.seasonKey } : {}),
        ...(req.body.isActive !== undefined ? { isActive: !!req.body.isActive } : {}),
      },
      { new: true }
    );
    if (!item) return res.status(404).json({ message: 'Section 不存在' });
    log.ok('section updated', { id: item._id });
    res.json({ message: 'Section 已更新', data: { item } });
  } catch (error) {
    log.error('update section error', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

router.delete('/:id', adminKeyAuth, async (req, res) => {
  log.start('DELETE /sections/:id', { id: req.params.id });
  try {
    const item = await Section.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: 'Section 不存在' });
    log.ok('section deleted', { id: req.params.id });
    res.json({ message: 'Section 已刪除' });
  } catch (error) {
    log.error('delete section error', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;
