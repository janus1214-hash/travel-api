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
    const { title, destination, startDate, endDate, status, coverImage } = req.body;

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
        coverImage: coverImage ?? null,
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

router.patch('/:id', authMiddleware, async (req: any, res: Response) => {
  try {
    const { title, destination, startDate, endDate, coverImage } = req.body;
    const tripId = req.params.id;

    const member = await prisma.tripMember.findFirst({
      where: { tripId, userId: req.userId },
    });
    if (!member) return res.status(403).json({ error: '你不是此行程的成員' });

    const trip = await prisma.trip.update({
      where: { id: tripId },
      data: {
        ...(title && { title }),
        ...(destination && { destination }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(coverImage !== undefined && { coverImage }),
      },
    });

    res.json(trip);
  } catch {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

router.patch('/:id/status', authMiddleware, async (req: any, res: Response) => {
  try {
    const { status } = req.body;
    const tripId = req.params.id;

    const validStatuses = ['draft', 'planning', 'confirmed', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: '無效的狀態' });
    }

    const member = await prisma.tripMember.findFirst({
      where: { tripId, userId: req.userId },
    });
    if (!member) return res.status(403).json({ error: '你不是此行程的成員' });

    const trip = await prisma.trip.update({
      where: { id: tripId },
      data: { status },
    });

    res.json(trip);
  } catch {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

router.delete('/:id', authMiddleware, async (req: any, res: Response) => {
  try {
    const tripId = req.params.id;

    const member = await prisma.tripMember.findFirst({
      where: { tripId, userId: req.userId, role: 'owner' },
    });
    if (!member) return res.status(403).json({ error: '只有建立者可以刪除行程' });

    await prisma.trip.delete({ where: { id: tripId } });

    res.json({ message: '行程已刪除' });
  } catch {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

router.post('/:id/invite', authMiddleware, async (req: any, res: Response) => {
  try {
    const { email } = req.body;
    const tripId = req.params.id;

    const member = await prisma.tripMember.findFirst({
      where: { tripId, userId: req.userId },
    });
    if (!member) return res.status(403).json({ error: '你不是此行程的成員' });

    const invitee = await prisma.user.findUnique({ where: { email } });
    if (!invitee) return res.status(404).json({ error: '找不到此 Email 的使用者' });

    const existing = await prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: invitee.id } },
    });
    if (existing) return res.status(400).json({ error: '該使用者已是成員' });

    await prisma.tripMember.create({
      data: { tripId, userId: invitee.id, role: 'member' },
    });

    res.json({ message: '邀請成功' });
  } catch {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

router.delete('/:id/members/:userId', authMiddleware, async (req: any, res: Response) => {
  try {
    const { id: tripId, userId } = req.params;

    const requester = await prisma.tripMember.findFirst({
      where: { tripId, userId: req.userId },
    });
    if (!requester || requester.role !== 'owner') {
      return res.status(403).json({ error: '只有建立者可以移除成員' });
    }

    if (userId === req.userId) {
      return res.status(400).json({ error: '不能移除自己' });
    }

    await prisma.tripMember.deleteMany({
      where: { tripId, userId },
    });

    res.json({ message: '成員已移除' });
  } catch {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

export default router;