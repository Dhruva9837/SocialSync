import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { authenticate, authorize } from './middleware/auth';
import { upload } from './middleware/upload';

// Import controllers
import { login, getUsers, createUser, deleteUser } from './controllers/auth';
import {
  getFacebookUrl,
  getYouTubeUrl,
  handleFacebookCallback,
  handleYouTubeCallback,
  getConnectedAccounts,
  disconnectAccount,
} from './controllers/oauth';
import {
  getPosts,
  getPostById,
  createPost,
  retryLog,
  serveMedia,
  getStorageStats,
  triggerManualCleanup,
} from './controllers/posts';

const app = express();
const PORT = process.env.PORT || 5000;

// Rate limiting: max 150 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Configure CORS for Next.js development server
app.use(
  cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  })
);

app.use(express.json());

// ----------------------------------------------------
// Routes
// ----------------------------------------------------

// 1. Authentication
app.post('/api/auth/login', login);

// 2. Admin operations
app.get('/api/admin/users', authenticate, authorize(['ADMIN']), getUsers);
app.post('/api/admin/users', authenticate, authorize(['ADMIN']), createUser);
app.delete('/api/admin/users/:id', authenticate, authorize(['ADMIN']), deleteUser);
app.post('/api/admin/cleanup', authenticate, authorize(['ADMIN']), triggerManualCleanup);

// 3. Social Account OAuth
app.get('/api/oauth/facebook/url', authenticate, getFacebookUrl);
app.get('/api/oauth/youtube/url', authenticate, getYouTubeUrl);
app.post('/api/oauth/facebook/callback', authenticate, handleFacebookCallback);
app.post('/api/oauth/youtube/callback', authenticate, handleYouTubeCallback);
app.get('/api/oauth/accounts', authenticate, getConnectedAccounts);
app.delete('/api/oauth/accounts/:id', authenticate, disconnectAccount);

// 4. Posts, Scheduling & Publishing
app.get('/api/posts', authenticate, getPosts);
app.get('/api/posts/stats', authenticate, getStorageStats);
app.get('/api/posts/:id', authenticate, getPostById);
app.post('/api/posts', authenticate, upload.single('video'), createPost);
app.post('/api/posts/retry', authenticate, retryLog);

// 5. Video Media Streaming (HTML5 Range compatible)
app.get('/api/posts/media/:postId', serveMedia);

// Start Express Server
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`SocialSync Backend running on: http://localhost:${PORT}`);
  console.log(`Environment:                  ${process.env.NODE_ENV || 'development'}`);
  console.log(`Mock Mode:                    ${process.env.MOCK_MODE || 'false'}`);
  console.log(`==================================================`);
});
