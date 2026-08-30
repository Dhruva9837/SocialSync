import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import prisma from '../db';
import { publishToFacebook, publishToYouTube } from './publishers';

const USE_REDIS = process.env.USE_REDIS === 'true';
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

const QUEUE_NAME = 'social-publish-queue';

let realQueue: Queue | null = null;
let realWorker: Worker | null = null;

// Initialize connection options if Redis is enabled
const redisConnection = USE_REDIS
  ? new IORedis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      maxRetriesPerRequest: null,
    })
  : null;

/**
 * Interface for our publishing job payload
 */
interface PublishJobData {
  postId: string;
  platforms: ('FACEBOOK' | 'YOUTUBE')[];
}

/**
 * Worker execution logic that publishes to chosen platforms
 */
async function executePublishingJob(postId: string, platforms: ('FACEBOOK' | 'YOUTUBE')[]) {
  console.log(`[Queue] Processing publishing job for Post: ${postId}, Platforms: ${platforms.join(', ')}`);

  // Update Post Status
  await prisma.post.update({
    where: { id: postId },
    data: { status: 'PUBLISHING' },
  });

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { media: true, user: true },
  });

  if (!post) {
    console.error(`[Queue] Post not found: ${postId}`);
    return;
  }

  const media = post.media.find((m) => m.status === 'ACTIVE');
  if (!media) {
    console.error(`[Queue] Active media not found for post: ${postId}`);
    await prisma.post.update({
      where: { id: postId },
      data: { status: 'FAILED' },
    });
    // Create logs for each target platform stating media not found
    for (const platform of platforms) {
      await prisma.publishLog.create({
        data: {
          postId,
          platform,
          status: 'FAILED',
          errorMessage: 'Active video file not found in database metadata.',
        },
      });
    }
    return;
  }

  // Process each platform independently
  const results = await Promise.all(
    platforms.map(async (platform) => {
      // Find connected social account for this user and platform (or fallback to any connected account in workspace)
      let account = await prisma.socialAccount.findFirst({
        where: {
          userId: post.userId,
          platform,
          status: 'CONNECTED',
        },
      });

      if (!account) {
        account = await prisma.socialAccount.findFirst({
          where: {
            platform,
            status: 'CONNECTED',
          },
        });
      }

      // Upsert a pending PublishLog
      let log = await prisma.publishLog.findFirst({
        where: { postId, platform },
      });

      if (log) {
        log = await prisma.publishLog.update({
          where: { id: log.id },
          data: { status: 'PUBLISHING', errorMessage: null },
        });
      } else {
        log = await prisma.publishLog.create({
          data: { postId, platform, status: 'PUBLISHING' },
        });
      }

      if (!account) {
        await prisma.publishLog.update({
          where: { id: log.id },
          data: {
            status: 'FAILED',
            errorMessage: `No connected ${platform} account found. Please connect your account first.`,
          },
        });
        return false;
      }

      try {
        if (platform === 'FACEBOOK') {
          const res = await publishToFacebook({
            encryptedAccessToken: account.accessToken,
            pageId: account.accountId,
            videoPath: media.storageKey,
            title: post.title,
            caption: post.caption,
          });

          await prisma.publishLog.update({
            where: { id: log.id },
            data: {
              status: res.status,
              platformPostId: res.platformPostId || null,
              platformUrl: res.platformUrl || null,
              errorMessage: res.errorMessage || null,
              publishedAt: res.status === 'PUBLISHED' ? new Date() : null,
            },
          });

          return res.status === 'PUBLISHED';
        } else {
          // YOUTUBE
          const res = await publishToYouTube({
            encryptedAccessToken: account.accessToken,
            encryptedRefreshToken: account.refreshToken,
            videoPath: media.storageKey,
            title: post.title,
            description: post.description,
            visibility: 'public', // default visibility. Can expand in future.
          });

          await prisma.publishLog.update({
            where: { id: log.id },
            data: {
              status: res.status,
              platformPostId: res.platformPostId || null,
              platformUrl: res.platformUrl || null,
              errorMessage: res.errorMessage || null,
              publishedAt: res.status === 'PUBLISHED' ? new Date() : null,
            },
          });

          return res.status === 'PUBLISHED';
        }
      } catch (err: any) {
        await prisma.publishLog.update({
          where: { id: log.id },
          data: {
            status: 'FAILED',
            errorMessage: err.message || 'Unknown processing error',
          },
        });
        return false;
      }
    })
  );

  // Determine final overall post status
  const allSucceeded = results.every((r) => r === true);
  await prisma.post.update({
    where: { id: postId },
    data: {
      status: allSucceeded ? 'COMPLETED' : 'FAILED',
    },
  });

  console.log(`[Queue] Finished job for Post ${postId}. Status: ${allSucceeded ? 'COMPLETED' : 'FAILED'}`);
}

// ----------------------------------------------------
// Redis BullMQ Configuration
// ----------------------------------------------------
if (USE_REDIS && redisConnection) {
  realQueue = new Queue<PublishJobData>(QUEUE_NAME, {
    connection: redisConnection,
  });

  realWorker = new Worker<PublishJobData>(
    QUEUE_NAME,
    async (job: Job<PublishJobData>) => {
      await executePublishingJob(job.data.postId, job.data.platforms);
    },
    { connection: redisConnection }
  );

  realWorker.on('completed', (job: Job<PublishJobData>) => {
    console.log(`[Queue] BullMQ job ${job.id} completed successfully.`);
  });

  realWorker.on('failed', (job: Job<PublishJobData> | undefined, err: Error) => {
    console.error(`[Queue] BullMQ job ${job?.id} failed:`, err);
  });
}

// ----------------------------------------------------
// In-Memory Fallback Queue Configuration (Zero dependencies)
// ----------------------------------------------------
class InMemoryQueue {
  private queue: { data: PublishJobData; scheduledAt: number }[] = [];

  constructor() {
    console.log('[Queue] Initializing In-Memory Fallback Queue.');
    // Start polling loop for scheduled/delayed tasks
    setInterval(() => this.processNext(), 1000);
  }

  public async add(name: string, data: PublishJobData, opts?: { delay?: number }) {
    const delay = opts?.delay || 0;
    const scheduledAt = Date.now() + delay;
    this.queue.push({ data, scheduledAt });
    console.log(`[InMemoryQueue] Enqueued job: ${name} (Post ID: ${data.postId}) scheduled to run in ${delay}ms`);
  }

  private async processNext() {
    const now = Date.now();
    const readyJobIndex = this.queue.findIndex((job: { data: PublishJobData; scheduledAt: number }) => job.scheduledAt <= now);
    
    if (readyJobIndex !== -1) {
      const [{ data }] = this.queue.splice(readyJobIndex, 1);
      try {
        // Execute asynchronously
        executePublishingJob(data.postId, data.platforms);
      } catch (err) {
        console.error('[InMemoryQueue] Error processing job:', err);
      }
    }
  }
}

const inMemoryQueue = !USE_REDIS ? new InMemoryQueue() : null;

/**
 * Add a publishing job to the background queue
 */
export async function addPublishJob(postId: string, platforms: ('FACEBOOK' | 'YOUTUBE')[], delayMs = 0) {
  if (USE_REDIS && realQueue) {
    await realQueue.add(
      `publish-${postId}`,
      { postId, platforms },
      { delay: delayMs }
    );
  } else if (inMemoryQueue) {
    await inMemoryQueue.add(`publish-${postId}`, { postId, platforms }, { delay: delayMs });
  } else {
    // Immediate fallback execution if everything fails
    executePublishingJob(postId, platforms);
  }
}

/**
 * Single platform retry trigger
 */
export async function retryPlatformPublish(postId: string, platform: 'FACEBOOK' | 'YOUTUBE') {
  // Update overall post status to publishing
  await prisma.post.update({
    where: { id: postId },
    data: { status: 'PUBLISHING' },
  });

  // Re-enqueue for background publishing just for this one platform
  await addPublishJob(postId, [platform]);
}
