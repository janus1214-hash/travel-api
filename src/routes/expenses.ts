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

router.get('/:tripId', authMiddleware, async (req: any, res: Response) => {
  try {
    const expenses = await prisma.expense.findMany({
      where: { tripId: req.params.tripId },
      include: {
        paidBy: { select: { id: true, displayName: true } },
        splits: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(expenses);
  } catch {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

router.post('/:tripId', authMiddleware, async (req: any, res: Response) => {
  try {
    const { title, amount, category, memberIds } = req.body;
    const tripId = req.params.tripId;

    if (!title || !amount || !memberIds?.length) {
      return res.status(400).json({ error: '請填寫所有欄位' });
    }

    const share = amount / memberIds.length;

    const expense = await prisma.expense.create({
      data: {
        tripId,
        title,
        amount,
        category: category ?? 'other',
        paidById: req.userId,
        splits: {
          create: memberIds.map((userId: string) => ({ userId, share })),
        },
      },
      include: {
        paidBy: { select: { id: true, displayName: true } },
        splits: true,
      },
    });

    res.json(expense);
  } catch {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

router.patch('/split/:splitId/pay', authMiddleware, async (req: any, res: Response) => {
  try {
    const split = await prisma.expenseSplit.update({
      where: { id: req.params.splitId },
      data: { isPaid: true },
    });
    res.json(split);
  } catch {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

export default router;