import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const router = Router();
const prisma = new PrismaClient();

const authMiddleware = (req: any, res: Response, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: '未登入' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Token 無效' });
  }
};

// 取得行程所有天數和活動
router.get('/:tripId', authMiddleware, async (req: any, res: Response) => {
  try {
    const days = await prisma.tripDay.findMany({
      where: { tripId: req.params.tripId },
      include: {
        activities: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { dayNumber: 'asc' },
    });
    res.json(days);
  } catch {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// 建立天數
router.post('/:tripId/days', authMiddleware, async (req: any, res: Response) => {
  try {
    const { dayNumber, date, note } = req.body;
    const tripId = req.params.tripId;

    const day = await prisma.tripDay.create({
      data: { tripId, dayNumber, date, note },
      include: { activities: true },
    });

    res.json(day);
  } catch {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// 新增活動
router.post('/days/:dayId/activities', authMiddleware, async (req: any, res: Response) => {
  try {
    const { title, location, startTime, note } = req.body;

    if (!title) return res.status(400).json({ error: '請填寫活動名稱' });

    const count = await prisma.activity.count({
      where: { tripDayId: req.params.dayId },
    });

    const activity = await prisma.activity.create({
      data: {
        tripDayId: req.params.dayId,
        title,
        location,
        startTime,
        note,
        sortOrder: count,
      },
    });

    res.json(activity);
  } catch {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// 刪除活動
router.delete('/activities/:id', authMiddleware, async (req: any, res: Response) => {
  try {
    await prisma.activity.delete({ where: { id: req.params.id } });
    res.json({ message: '已刪除' });
  } catch {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

export default router;