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
    const polls = await prisma.poll.findMany({
      where: { tripId: req.params.tripId },
      include: {
        options: {
          include: { votes: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(polls);
  } catch {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

router.post('/:tripId', authMiddleware, async (req: any, res: Response) => {
  try {
    const { title, options, closesAt } = req.body;
    const tripId = req.params.tripId;

    if (!title || !options?.length) {
      return res.status(400).json({ error: '請填寫標題和選項' });
    }

    const poll = await prisma.poll.create({
      data: {
        tripId,
        title,
        closesAt: closesAt ? new Date(closesAt) : null,
        createdBy: req.userId,
        options: {
          create: options.map((label: string) => ({ label })),
        },
      },
      include: {
        options: { include: { votes: true } },
      },
    });

    res.json(poll);
  } catch {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

router.post('/vote/:optionId', authMiddleware, async (req: any, res: Response) => {
  try {
    const existing = await prisma.pollVote.findFirst({
      where: {
        pollOptionId: req.params.optionId,
        userId: req.userId,
      },
    });

    if (existing) {
      return res.status(400).json({ error: '你已經投過票了' });
    }

    const vote = await prisma.pollVote.create({
      data: {
        pollOptionId: req.params.optionId,
        userId: req.userId,
      },
    });

    res.json(vote);
  } catch {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

export default router;