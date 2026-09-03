import { Response } from 'express';
import { google } from 'googleapis';
import axios from 'axios';
import prisma from '../db';
import { AuthRequest } from '../middleware/auth';
import { encrypt, decrypt } from '../services/encryption';

const MOCK_MODE = process.env.MOCK_MODE === 'true';

// Google configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || '';

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

// Facebook configuration
const FACEBOOK_CLIENT_ID = process.env.FACEBOOK_CLIENT_ID || '';
const FACEBOOK_CLIENT_SECRET = process.env.FACEBOOK_CLIENT_SECRET || '';
const FACEBOOK_REDIRECT_URI = process.env.FACEBOOK_REDIRECT_URI || '';

/**
 * Get OAuth login URL for YouTube
 */
export async function getYouTubeUrl(req: AuthRequest, res: Response) {
  const originUrl = req.headers.origin || req.headers.referer || process.env.FRONTEND_URL || 'http://localhost:3000';
  const frontendUrl = String(originUrl).replace(/\/+$/, '').split('/accounts')[0];
  
  let redirectUri = `${frontendUrl}/accounts/callback/youtube`;
  if (process.env.GOOGLE_REDIRECT_URI && process.env.GOOGLE_REDIRECT_URI.startsWith('http') && !process.env.GOOGLE_REDIRECT_URI.includes('localhost')) {
    redirectUri = process.env.GOOGLE_REDIRECT_URI;
  }

  if (MOCK_MODE || req.query.mock === 'true' || !GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID') {
    const mockUrl = `${frontendUrl}/accounts/callback/youtube?code=mock_google_oauth_code`;
    return res.json({ url: mockUrl });
  }

  const scopes = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/userinfo.profile'
  ];

  const client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });

  return res.json({ url });
}

/**
 * Get OAuth login URL for Facebook Pages
 */
export async function getFacebookUrl(req: AuthRequest, res: Response) {
  const originUrl = req.headers.origin || req.headers.referer || process.env.FRONTEND_URL || 'http://localhost:3000';
  const frontendUrl = String(originUrl).replace(/\/+$/, '').split('/accounts')[0];
  
  let redirectUri = `${frontendUrl}/accounts/callback/facebook`;
  if (process.env.FACEBOOK_REDIRECT_URI && process.env.FACEBOOK_REDIRECT_URI.startsWith('http') && !process.env.FACEBOOK_REDIRECT_URI.includes('localhost')) {
    redirectUri = process.env.FACEBOOK_REDIRECT_URI;
  }

  if (MOCK_MODE || req.query.mock === 'true' || !FACEBOOK_CLIENT_ID || FACEBOOK_CLIENT_ID === 'YOUR_FACEBOOK_CLIENT_ID') {
    const mockUrl = `${frontendUrl}/accounts/callback/facebook?code=mock_facebook_oauth_code`;
    return res.json({ url: mockUrl });
  }

  // Core scopes for Facebook Pages publishing
  // NOTE: Page-level permissions must first be added to the app in Meta Developer Console
  // → Use Cases / Permissions before requesting them here.
  const rawScopes = ['public_profile', 'pages_show_list', 'pages_manage_posts'];

  const url = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${FACEBOOK_CLIENT_ID}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${rawScopes.join(',')}&response_type=code`;

  return res.json({ url });
}

/**
 * Handle YouTube OAuth Callback
 */
export async function handleYouTubeCallback(req: AuthRequest, res: Response) {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Authorization code is required' });
  }

  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'User context not found' });
  }

  try {
    if (MOCK_MODE) {
      // Mock Channel Detail
      const channelId = 'UCmockchannelId12345';
      const channelName = 'Tech Tips (Mock)';
      
      const encryptedAccess = encrypt('mock_youtube_access_token');
      const encryptedRefresh = encrypt('mock_youtube_refresh_token');

      // Create or update social account reference
      const account = await prisma.socialAccount.upsert({
        where: {
          userId_platform_accountId: {
            userId,
            platform: 'YOUTUBE',
            accountId: channelId,
          },
        },
        update: {
          accountName: channelName,
          accessToken: encryptedAccess,
          refreshToken: encryptedRefresh,
          expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
          status: 'CONNECTED',
        },
        create: {
          userId,
          platform: 'YOUTUBE',
          accountId: channelId,
          accountName: channelName,
          accessToken: encryptedAccess,
          refreshToken: encryptedRefresh,
          expiresAt: new Date(Date.now() + 3600 * 1000),
          status: 'CONNECTED',
        },
      });

      return res.json({ message: 'YouTube channel connected successfully', account });
    }

    // Real Google Auth exchange
    const originUrl = req.headers.origin || req.headers.referer || process.env.FRONTEND_URL || 'http://localhost:3000';
    const frontendUrl = String(originUrl).replace(/\/+$/, '').split('/accounts')[0];
    
    let redirectUri = `${frontendUrl}/accounts/callback/youtube`;
    if (process.env.GOOGLE_REDIRECT_URI && process.env.GOOGLE_REDIRECT_URI.startsWith('http') && !process.env.GOOGLE_REDIRECT_URI.includes('localhost')) {
      redirectUri = process.env.GOOGLE_REDIRECT_URI;
    }

    const client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Fetch Channel Information
    const youtube = google.youtube({ version: 'v3', auth: client });
    const channelRes = await youtube.channels.list({
      part: ['snippet'],
      mine: true,
    });

    const channel = channelRes.data.items?.[0];
    if (!channel || !channel.id || !channel.snippet?.title) {
      return res.status(400).json({ error: 'No YouTube channel found associated with this Google account.' });
    }

    const channelId = channel.id;
    const channelName = channel.snippet.title;
    const encryptedAccess = encrypt(tokens.access_token || '');
    const encryptedRefresh = tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined;
    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : undefined;

    const account = await prisma.socialAccount.upsert({
      where: {
        userId_platform_accountId: {
          userId,
          platform: 'YOUTUBE',
          accountId: channelId,
        },
      },
      update: {
        accountName: channelName,
        accessToken: encryptedAccess,
        ...(encryptedRefresh && { refreshToken: encryptedRefresh }),
        expiresAt,
        status: 'CONNECTED',
      },
      create: {
        userId,
        platform: 'YOUTUBE',
        accountId: channelId,
        accountName: channelName,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh || '',
        expiresAt,
        status: 'CONNECTED',
      },
    });

    return res.json({ message: 'YouTube channel connected successfully', account });
  } catch (error: any) {
    console.error('YouTube OAuth error:', error);
    return res.status(500).json({ error: 'Failed to connect YouTube channel. ' + error.message });
  }
}

/**
 * Handle Facebook OAuth Callback
 */
export async function handleFacebookCallback(req: AuthRequest, res: Response) {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Authorization code is required' });
  }

  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'User context not found' });
  }

  try {
    if (MOCK_MODE) {
      const pageId = 'fb_mock_page_98765';
      const pageName = 'Daily Vlogs (Mock)';
      const encryptedAccess = encrypt('mock_facebook_page_token');

      const account = await prisma.socialAccount.upsert({
        where: {
          userId_platform_accountId: {
            userId,
            platform: 'FACEBOOK',
            accountId: pageId,
          },
        },
        update: {
          accountName: pageName,
          accessToken: encryptedAccess,
          status: 'CONNECTED',
          expiresAt: null, // Facebook page tokens can be infinite/long-lived
        },
        create: {
          userId,
          platform: 'FACEBOOK',
          accountId: pageId,
          accountName: pageName,
          accessToken: encryptedAccess,
          status: 'CONNECTED',
        },
      });

      return res.json({ message: 'Facebook Page connected successfully', account });
    }

    // 1. Exchange auth code for user access token
    const originUrl = req.headers.origin || req.headers.referer || process.env.FRONTEND_URL || 'http://localhost:3000';
    const frontendUrl = String(originUrl).replace(/\/+$/, '').split('/accounts')[0];
    
    let redirectUri = `${frontendUrl}/accounts/callback/facebook`;
    if (process.env.FACEBOOK_REDIRECT_URI && process.env.FACEBOOK_REDIRECT_URI.startsWith('http') && !process.env.FACEBOOK_REDIRECT_URI.includes('localhost')) {
      redirectUri = process.env.FACEBOOK_REDIRECT_URI;
    }

    const tokenUrl = `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${FACEBOOK_CLIENT_ID}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&client_secret=${FACEBOOK_CLIENT_SECRET}&code=${code}`;

    const tokenRes = await axios.get(tokenUrl);
    const userAccessToken = tokenRes.data.access_token;
    const userTokenExpiry = tokenRes.data.expires_in ? new Date(Date.now() + tokenRes.data.expires_in * 1000) : undefined;

    // 2. Exchange for a long-lived user token (optional but recommended, lasts ~60 days)
    const longLivedUrl = `https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${FACEBOOK_CLIENT_ID}&client_secret=${FACEBOOK_CLIENT_SECRET}&fb_exchange_token=${userAccessToken}`;
    const longLivedRes = await axios.get(longLivedUrl);
    const longLivedUserToken = longLivedRes.data.access_token;
    const longLivedUserExpiry = longLivedRes.data.expires_in ? new Date(Date.now() + longLivedRes.data.expires_in * 1000) : undefined;

    // 3. Fetch user's pages and Page Access Tokens
    const pagesUrl = `https://graph.facebook.com/v20.0/me/accounts?access_token=${longLivedUserToken}`;
    const pagesRes = await axios.get(pagesUrl);
    const pagesData = pagesRes.data.data;

    if (!pagesData || pagesData.length === 0) {
      return res.status(400).json({ error: 'No Facebook pages found associated with this Facebook account.' });
    }

    // Connect all pages managed by the user, or connect the primary one
    const connectedAccounts = [];
    for (const page of pagesData) {
      const pageId = page.id;
      const pageName = page.name;
      const pageAccessToken = page.access_token; // This is a long-lived page token!

      const encryptedAccess = encrypt(pageAccessToken);

      const account = await prisma.socialAccount.upsert({
        where: {
          userId_platform_accountId: {
            userId,
            platform: 'FACEBOOK',
            accountId: pageId,
          },
        },
        update: {
          accountName: pageName,
          accessToken: encryptedAccess,
          status: 'CONNECTED',
          expiresAt: longLivedUserExpiry,
        },
        create: {
          userId,
          platform: 'FACEBOOK',
          accountId: pageId,
          accountName: pageName,
          accessToken: encryptedAccess,
          status: 'CONNECTED',
          expiresAt: longLivedUserExpiry,
        },
      });
      connectedAccounts.push(account);
    }

    return res.json({
      message: `Connected ${connectedAccounts.length} Facebook Page(s) successfully`,
      accounts: connectedAccounts,
    });
  } catch (error: any) {
    console.error('Facebook OAuth error:', error?.response?.data || error);
    const errMsg = error?.response?.data?.error?.message || error.message;
    return res.status(500).json({ error: 'Failed to connect Facebook account. ' + errMsg });
  }
}

/**
 * Get connected accounts list for the current user
 */
export async function getConnectedAccounts(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'User context not found' });
  }

  try {
    let accounts = await prisma.socialAccount.findMany({
      where: { userId },
      select: {
        id: true,
        platform: true,
        accountId: true,
        accountName: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    if (accounts.length === 0) {
      accounts = await prisma.socialAccount.findMany({
        where: { status: 'CONNECTED' },
        select: {
          id: true,
          platform: true,
          accountId: true,
          accountName: true,
          status: true,
          expiresAt: true,
          createdAt: true,
        },
      });
    }
    return res.json(accounts);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve social accounts' });
  }
}

/**
 * Disconnect a social account
 */
export async function disconnectAccount(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!id || !userId) {
    return res.status(400).json({ error: 'Invalid request parameters' });
  }

  try {
    const account = await prisma.socialAccount.findFirst({
      where: { id, userId },
    });

    if (!account) {
      return res.status(404).json({ error: 'Social account not found or access denied' });
    }

    await prisma.socialAccount.delete({
      where: { id },
    });

    return res.json({ message: 'Social account disconnected successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to disconnect social account' });
  }
}
