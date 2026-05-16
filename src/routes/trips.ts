import { Router, Request, Response } from 'express';
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

router.get('/', authMiddleware, async (req: any, res: Response) => {
  try {
    const members = await prisma.tripMember.findMany({
      where: { userId: req.userId },
      include: { trip: true },
    });
    const trips = members.map((m) => m.trip);
    res.json(trips);
  } catch {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

router.post('/', authMiddleware, async (req: any, res: Response) => {
  try {
    const { title, destination, startDate, endDate, status } = req.body;

    if (!title || !startDate || !endDate) {
      return res.status(400).json({ error: '請填寫必要欄位' });
    }

    const trip = await prisma.trip.create({
      data: {
        title,
        destination,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: status ?? 'draft',
        createdBy: req.userId,
        members: {
          create: { userId: req.userId, role: 'owner' },
        },
      },
    });

    res.json(trip);
  } catch {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

router.get('/:id', authMiddleware, async (req: any, res: Response) => {
  try {
    const trip = await prisma.trip.findUnique({
      where: { id: req.params.id },
      include: { members: { include: { user: true } } },
    });

    if (!trip) return res.status(404).json({ error: '找不到行程' });

    res.json(trip);
  } catch {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

export default router;