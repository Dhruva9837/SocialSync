import fs from 'fs';
import cron from 'node-cron';
import prisma from '../db';

/**
 * Perform cleanup of all media records that are expired.
 * Deletes physical video files from the disk and removes database Media records.
 */
export async function runCleanup(): Promise<number> {
  console.log('[Cleanup] Starting automated media cleanup...');
  const now = new Date();

  try {
    const expiredMedia = await prisma.media.findMany({
      where: {
        expiresAt: {
          lte: now,
        },
      },
    });

    console.log(`[Cleanup] Found ${expiredMedia.length} expired media record(s).`);

    let deletedCount = 0;
    for (const media of expiredMedia) {
      // 1. Delete physical file if it exists locally
      if (fs.existsSync(media.storageKey)) {
        try {
          fs.unlinkSync(media.storageKey);
          console.log(`[Cleanup] Deleted physical file: ${media.storageKey}`);
        } catch (fileErr) {
          console.error(`[Cleanup] Error deleting physical file ${media.storageKey}:`, fileErr);
        }
      } else {
        console.log(`[Cleanup] Physical file not found on disk, skipping unlink: ${media.storageKey}`);
      }

      // 2. Remove database reference
      await prisma.media.delete({
        where: { id: media.id },
      });
      console.log(`[Cleanup] Removed Media database record: ${media.fileName} (ID: ${media.id})`);
      deletedCount++;
    }

    console.log(`[Cleanup] Finished media cleanup. Deleted ${deletedCount} record(s).`);
    return deletedCount;
  } catch (error) {
    console.error('[Cleanup] Error running media cleanup:', error);
    throw error;
  }
}

// Register the daily background cron job (runs every day at midnight)
cron.schedule('0 0 * * *', () => {
  runCleanup().catch((err) => console.error('[Cleanup Cron Error]', err));
});
