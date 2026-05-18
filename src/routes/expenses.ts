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
        splits: {
          include: {
            expense: false,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const userIds = [...new Set(expenses.flatMap(e => e.splits.map(s => s.userId)))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, displayName: true },
    });
    const userMap = Object.fromEntries(users.map(u => [u.id, u.displayName]));

    const result = expenses.map(e => ({
      ...e,
      splits: e.splits.map(s => ({
        ...s,
        displayName: userMap[s.userId] ?? '未知成員',
      })),
    }));

    res.json(result);
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

router.delete('/:expenseId', authMiddleware, async (req: any, res: Response) => {
  try {
    const expense = await prisma.expense.findUnique({
      where: { id: req.params.expenseId },
    });

    if (!expense) return res.status(404).json({ error: '找不到費用' });
    if (expense.paidById !== req.userId) {
      return res.status(403).json({ error: '只有墊付者可以刪除' });
    }

    await prisma.expense.delete({ where: { id: req.params.expenseId } });
    res.json({ message: '已刪除' });
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