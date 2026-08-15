import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../db';
import { AuthRequest } from '../middleware/auth';
import { addPublishJob, retryPlatformPublish } from '../services/queue';
import { runCleanup } from '../services/cleanup';

/**
 * Get all posts with their media and publish logs
 */
export async function getPosts(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const posts = await prisma.post.findMany({
      where: { userId },
      include: {
        media: true,
        logs: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return res.json(posts);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch posts' });
  }
}

/**
 * Get a single post by ID
 */
export async function getPostById(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const post = await prisma.post.findFirst({
      where: { id, userId },
      include: {
        media: true,
        logs: true,
      },
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    return res.json(post);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch post details' });
  }
}

/**
 * Create a new post and upload video
 */
export async function createPost(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  if (!req.file) {
    return res.status(400).json({ error: 'Video file is required' });
  }

  const { title, description, caption, scheduledAt, platforms } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  // Parse platforms (expecting comma-separated or array)
  let parsedPlatforms: ('FACEBOOK' | 'YOUTUBE')[] = [];
  try {
    if (typeof platforms === 'string') {
      parsedPlatforms = JSON.parse(platforms);
    } else if (Array.isArray(platforms)) {
      parsedPlatforms = platforms;
    }
  } catch (e) {
    parsedPlatforms = [];
  }

  if (parsedPlatforms.length === 0) {
    // Cleanup the uploaded file since post creation failed
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(400).json({ error: 'Select at least one platform (Facebook or YouTube)' });
  }

  // Check scheduling date
  let scheduledDate: Date | null = null;
  if (scheduledAt) {
    scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Invalid scheduled date' });
    }
    if (scheduledDate <= new Date()) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Scheduled time must be in the future' });
    }
  }

  try {
    // 1. Create Post record
    const postStatus = scheduledDate ? 'SCHEDULED' : 'PUBLISHING';
    const post = await prisma.post.create({
      data: {
        userId,
        title,
        description: description || '',
        caption: caption || '',
        status: postStatus,
        scheduledAt: scheduledDate,
      },
    });

    // 2. Create Media record
    const host = req.get('host') || 'localhost:5000';
    const protocol = req.protocol || 'http';
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    const media = await prisma.media.create({
      data: {
        postId: post.id,
        storageKey: req.file.path,
        mediaUrl: `${protocol}://${host}/api/posts/media/${post.id}`,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        expiresAt,
        status: 'ACTIVE',
      },
    });

    // 3. Queue job or Schedule job
    const delayMs = scheduledDate ? scheduledDate.getTime() - Date.now() : 0;
    
    // Initialize PublishLogs in status PENDING or SCHEDULED
    for (const p of parsedPlatforms) {
      await prisma.publishLog.create({
        data: {
          postId: post.id,
          platform: p,
          status: scheduledDate ? 'FAILED' : 'PUBLISHING', // 'FAILED' serves as placeholder for scheduled jobs
          errorMessage: scheduledDate ? 'Awaiting scheduled time' : null,
        },
      });
    }

    // Add to publishing queue
    await addPublishJob(post.id, parsedPlatforms, delayMs);

    return res.status(201).json({
      message: scheduledDate ? 'Post scheduled successfully' : 'Publishing started in background',
      post: {
        ...post,
        media: [media],
      },
    });
  } catch (error: any) {
    console.error('Create post error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({ error: 'Failed to create post. ' + error.message });
  }
}

/**
 * Retry publishing for a single failed platform log
 */
export async function retryLog(req: AuthRequest, res: Response) {
  const { logId } = req.body;
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  if (!logId) {
    return res.status(400).json({ error: 'Log ID is required' });
  }

  try {
    const log = await prisma.publishLog.findUnique({
      where: { id: logId },
      include: {
        post: {
          include: { media: true },
        },
      },
    });

    if (!log || log.post.userId !== userId) {
      return res.status(404).json({ error: 'Publish log not found or access denied' });
    }

    if (log.status !== 'FAILED') {
      return res.status(400).json({ error: 'Only failed logs can be retried' });
    }

    // Update log status to publishing
    await prisma.publishLog.update({
      where: { id: logId },
      data: { status: 'PUBLISHING', errorMessage: null },
    });

    // Trigger queue job
    await retryPlatformPublish(log.postId, log.platform as any);

    return res.json({ message: `Retrying publishing to ${log.platform} in the background` });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to trigger retry' });
  }
}

/**
 * Stream the uploaded video file
 */
export async function serveMedia(req: AuthRequest, res: Response) {
  const { postId } = req.params;

  try {
    const media = await prisma.media.findFirst({
      where: { postId },
    });

    if (!media) {
      return res.status(404).json({ error: 'Media file not found' });
    }

    if (!fs.existsSync(media.storageKey)) {
      return res.status(404).json({ error: 'Physical video file is missing or has expired' });
    }

    const stat = fs.statSync(media.storageKey);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Support HTML5 video streaming range requests
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(media.storageKey, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': media.mimeType,
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': media.mimeType,
      };
      res.writeHead(200, head);
      fs.createReadStream(media.storageKey).pipe(res);
    }
  } catch (error) {
    return res.status(500).json({ error: 'Error streaming media' });
  }
}

/**
 * Get dashboard storage stats
 */
export async function getStorageStats(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Fetch all active media belonging to user posts
    const activeMedia = await prisma.media.findMany({
      where: {
        status: 'ACTIVE',
        post: { userId },
      },
    });

    const videoCount = activeMedia.length;
    const totalBytes = activeMedia.reduce((sum, m) => sum + m.fileSize, 0);
    const totalGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);

    // Find the oldest media expiring next
    let oldestExpiryDays: string | null = null;
    if (videoCount > 0) {
      const now = Date.now();
      const minExpiry = Math.min(...activeMedia.map((m) => m.expiresAt.getTime()));
      const diffMs = minExpiry - now;
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      oldestExpiryDays = diffDays > 0 ? `${diffDays} day(s)` : 'today';
    }

    return res.json({
      videoCount,
      totalGB,
      oldestExpiryDays,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch storage stats' });
  }
}

/**
 * Manually trigger cleanup job (Admin only)
 */
export async function triggerManualCleanup(req: AuthRequest, res: Response) {
  try {
    const deletedCount = await runCleanup();
    return res.json({ message: `Manual cleanup complete. Deleted ${deletedCount} media file(s).` });
  } catch (error: any) {
    return res.status(500).json({ error: 'Manual cleanup failed: ' + error.message });
  }
}
