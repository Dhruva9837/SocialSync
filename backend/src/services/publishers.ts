import fs from 'fs';
import { google } from 'googleapis';
import axios from 'axios';
import { decrypt } from './encryption';

const MOCK_MODE = process.env.MOCK_MODE === 'true';

// Google Client Config
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || '';

interface FBPublishParams {
  encryptedAccessToken: string;
  pageId: string;
  videoPath: string;
  title: string;
  caption: string; // Used as description in Facebook
}

interface YTPublishParams {
  encryptedAccessToken: string;
  encryptedRefreshToken?: string | null;
  videoPath: string;
  title: string;
  description: string;
  visibility: 'public' | 'unlisted' | 'private';
}

interface PublishResult {
  status: 'PUBLISHED' | 'FAILED';
  platformPostId?: string;
  platformUrl?: string;
  errorMessage?: string;
}

/**
 * Publish video to a Facebook Page
 */
export async function publishToFacebook(params: FBPublishParams): Promise<PublishResult> {
  const { encryptedAccessToken, pageId, videoPath, title, caption } = params;

  if (MOCK_MODE) {
    // Simulate upload delay
    await new Promise((resolve) => setTimeout(resolve, 3000));
    
    // 5% failure simulation for testing error handling and retry mechanism
    if (caption.toLowerCase().includes('fail facebook')) {
      return {
        status: 'FAILED',
        errorMessage: 'Meta Graph API Error: Media upload failed due to quota limit simulation.',
      };
    }

    const mockVideoId = `fb_vid_${Math.random().toString(36).substr(2, 9)}`;
    return {
      status: 'PUBLISHED',
      platformPostId: mockVideoId,
      platformUrl: `https://www.facebook.com/${pageId}/videos/${mockVideoId}/`,
    };
  }

  try {
    const accessToken = decrypt(encryptedAccessToken);
    if (!fs.existsSync(videoPath)) {
      return { status: 'FAILED', errorMessage: 'Local video file not found on disk' };
    }

    // Prepare FormData for Facebook Graph API
    // Meta Graph API Page Video post endpoint: https://graph.facebook.com/v20.0/{page-id}/videos
    // We use a stream for memory-efficient uploads
    const FormDataClass = require('form-data');
    const form = new FormDataClass();
    form.append('access_token', accessToken);
    form.append('description', caption); // Facebook uses 'description' for post text
    form.append('title', title);
    form.append('source', fs.createReadStream(videoPath));

    const response = await axios.post(
      `https://graph.facebook.com/v20.0/${pageId}/videos`,
      form,
      {
        headers: {
          ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    const videoId = response.data.id;
    if (!videoId) {
      return {
        status: 'FAILED',
        errorMessage: 'Facebook upload succeeded but no video ID was returned.',
      };
    }

    return {
      status: 'PUBLISHED',
      platformPostId: videoId,
      platformUrl: `https://www.facebook.com/${pageId}/videos/${videoId}/`,
    };
  } catch (error: any) {
    console.error('Facebook publish error:', error?.response?.data || error);
    const apiError = error?.response?.data?.error?.message || error.message;
    return {
      status: 'FAILED',
      errorMessage: `Facebook API Error: ${apiError}`,
    };
  }
}

/**
 * Publish video to a YouTube Channel
 */
export async function publishToYouTube(params: YTPublishParams): Promise<PublishResult> {
  const { encryptedAccessToken, encryptedRefreshToken, videoPath, title, description, visibility } = params;

  if (MOCK_MODE) {
    // Simulate upload delay
    await new Promise((resolve) => setTimeout(resolve, 4000));

    // 5% failure simulation for testing error handling and retry mechanism
    if (description.toLowerCase().includes('fail youtube')) {
      return {
        status: 'FAILED',
        errorMessage: 'Google API Error: Quota exceeded or request entity too large simulation.',
      };
    }

    const mockVideoId = `yt_vid_${Math.random().toString(36).substr(2, 9)}`;
    return {
      status: 'PUBLISHED',
      platformPostId: mockVideoId,
      platformUrl: `https://www.youtube.com/watch?v=${mockVideoId}`,
    };
  }

  try {
    const accessToken = decrypt(encryptedAccessToken);
    const refreshToken = encryptedRefreshToken ? decrypt(encryptedRefreshToken) : undefined;

    if (!fs.existsSync(videoPath)) {
      return { status: 'FAILED', errorMessage: 'Local video file not found on disk' };
    }

    const auth = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );

    auth.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken || undefined,
    });

    const youtubeClient = google.youtube({ version: 'v3', auth });

    const media = {
      body: fs.createReadStream(videoPath),
    };

    const response = await youtubeClient.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title,
          description,
          tags: [],
        },
        status: {
          privacyStatus: visibility, // "public" | "unlisted" | "private"
          selfDeclaredMadeForKids: false,
        },
      },
      media,
    });

    const videoId = response.data.id;
    if (!videoId) {
      return {
        status: 'FAILED',
        errorMessage: 'YouTube upload completed but no video ID was returned.',
      };
    }

    return {
      status: 'PUBLISHED',
      platformPostId: videoId,
      platformUrl: `https://www.youtube.com/watch?v=${videoId}`,
    };
  } catch (error: any) {
    console.error('YouTube publish error:', error);
    return {
      status: 'FAILED',
      errorMessage: `YouTube API Error: ${error.message || 'Unknown YouTube API error'}`,
    };
  }
}
