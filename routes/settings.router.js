import express from 'express';
import { getSettings, updateSettings } from './settings.controller.js';
import { verifyToken } from '../middlewares/jwt.middleware.js';

const router = express.Router();

router.get('/', verifyToken, getSettings);
router.put('/', verifyToken, updateSettings);

export default router;
