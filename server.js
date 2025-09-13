const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const ReelGenerator = require('./services/reelGenerator');
const { postToInstagram, postToYouTube, postToTelegram } = require('./services/videoServices');
require('dotenv').config();

// Test if env variables are loaded
console.log('🔍 Environment check:');
console.log('OPENAI_API_KEY loaded:', process.env.OPENAI_API_KEY ? '✅ Yes' : '❌ No');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.set('trust proxy', true);
app.use(helmet());
app.use(cors());

// In-memory storage for reel drafts (use Redis in production)
const reelDrafts = new Map();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Initialize reel generator
const reelGenerator = new ReelGenerator();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  trustProxy: true        // explicitly trust the X-Forwarded-For header
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Import social media services
const { postToTwitter } = require('./services/twitterService');
const { postToLinkedIn } = require('./services/linkedinService');
const { postToFacebook } = require('./services/facebookService');
//const { postToWhatsApp } = require('./services/whatsappService');

// Step 1: Generate reel preview for user approval
app.post('/api/generate-reel-preview', upload.single('video'), async (req, res) => {
  try {

    const styleSettings = req.body.styleSettings
    ? JSON.parse(req.body.styleSettings)
    : null;

    console.log('📥 Received preview request:', {
      jobUpdate: req.body.jobUpdate?.substring(0, 100),
      platforms: req.body.platforms,
      style: req.body.style,
      hasFile: !!req.file
    });

    const { jobUpdate, platforms, style = 'professional' } = req.body;
    console.log(jobUpdate, platforms, style);
    // Validate input
    if (!jobUpdate || jobUpdate.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Job update content is required'
      });
    }

    const selectedPlatforms = platforms ? platforms.split(',') : ['instagram', 'youtube', 'facebook', 'telegram'];
    const draftId = `draft_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    console.log('🎬 Generating reel preview for approval...');

    let videoData;
    let previewData;

    if (req.file) {
      // User uploaded their own video
      console.log('📹 Processing uploaded video:', req.file.originalname);
      
      // Generate AI content for the uploaded video
      const aiContent = await reelGenerator.generateJobReelContent(jobUpdate);
      
      videoData = {
        videoPath: req.file.path,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        content: aiContent,
        isUploaded: true
      };

      // Create preview thumbnail from uploaded video
      previewData = await reelGenerator.generateVideoPreview(req.file.path, aiContent);
      
    } else {
      // Generate AI-powered reel preview
      console.log('🤖 Generating AI-powered reel preview...');
      videoData = await reelGenerator.generateJobReelPreview(jobUpdate, style, styleSettings);
      previewData = videoData.preview;
    }

    // Store draft for later approval/editing
    reelDrafts.set(draftId, {
      jobUpdate,
      platforms: selectedPlatforms,
      videoData,
      createdAt: new Date(),
      status: 'pending_approval'
    });

    res.json({
      success: true,
      message: 'Reel preview generated successfully',
      draftId,
      preview: {
        content: videoData.content,
        originalText: jobUpdate, 
        thumbnailUrl: previewData.thumbnailUrl,
        videoPreviewUrl: previewData.videoPreviewUrl,
        duration: previewData.duration,
        style: style,
        isUploaded: videoData.isUploaded || false
      },
      platformPreviews: {
        instagram: {
          caption: `${videoData.content.title}\n\n${videoData.content.hashtags}`,
          format: 'Vertical Reel (9:16)',
          maxDuration: '90 seconds'
        },
        youtube: {
          title: `${videoData.content.title} #Shorts`,
          description: `${jobUpdate}\n\n${videoData.content.hashtags}`,
          format: 'YouTube Shorts',
          maxDuration: '60 seconds'
        },
        facebook: {
          caption: `${jobUpdate}\n\n📹 Check out our latest job update!\n\n${videoData.content.hashtags}`,
          format: 'Video Post',
          crossPost: 'Also posted as reel'
        },
        telegram: {
          caption: `${jobUpdate}\n\n${videoData.content.hashtags}`,
          format: 'Video Message',
          fileSize: videoData.fileSize ? `${(videoData.fileSize / 1024 / 1024).toFixed(2)} MB` : 'Generated'
        }
      },
      suggestions: [
        'Add more specific job requirements',
        'Include salary range if applicable',
        'Add company benefits',
        'Mention application deadline',
        'Include location details'
      ],
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });

  } catch (error) {
     console.error('❌ DETAILED ERROR in reel preview:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    console.error('Reel preview generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate reel preview',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Step 2: User edits/modifies the reel content
app.put('/api/edit-reel-draft/:draftId', async (req, res) => {
  try {
    const { draftId } = req.params;
    const { 
      title, 
      hook, 
      points, 
      cta, 
      hashtags, 
      script, 
      style,
      platforms,
      customChanges 
    } = req.body;

    if (!reelDrafts.has(draftId)) {
      return res.status(404).json({
        success: false,
        error: 'Draft not found or expired'
      });
    }

    const draft = reelDrafts.get(draftId);
    
    console.log('✏️ User editing reel draft:', draftId);

    // Update content based on user changes
    const updatedContent = {
      ...draft.videoData.content,
      ...(title && { title }),
      ...(hook && { hook }),
      ...(points && { points }),
      ...(cta && { cta }),
      ...(hashtags && { hashtags }),
      ...(script && { script })
    };

    // Regenerate video with new content if not user uploaded
    let updatedVideoData = draft.videoData;
    if (!draft.videoData.isUploaded) {
      console.log('🔄 Regenerating video with user changes...');
      updatedVideoData = await reelGenerator.createJobReelWithCustomContent(
        draft.jobUpdate, 
        updatedContent, 
        style || 'professional'
      );
    } else {
      // For uploaded videos, just update the content metadata
      updatedVideoData.content = updatedContent;
    }

    // Update draft
    draft.videoData = updatedVideoData;
    draft.platforms = platforms || draft.platforms;
    draft.lastModified = new Date();
    draft.customChanges = customChanges;
    draft.status = 'modified';

    reelDrafts.set(draftId, draft);

    // Generate new preview
    const newPreview = await reelGenerator.generateVideoPreview(
      updatedVideoData.videoPath, 
      updatedContent
    );

    res.json({
      success: true,
      message: 'Reel draft updated successfully',
      draftId,
      updatedPreview: {
        content: updatedContent,
        thumbnailUrl: newPreview.thumbnailUrl,
        videoPreviewUrl: newPreview.videoPreviewUrl,
        lastModified: draft.lastModified
      },
      changes: {
        applied: Object.keys(req.body).filter(key => req.body[key] !== undefined),
        customChanges: customChanges || []
      }
    });

  } catch (error) {
    console.error('Reel edit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update reel draft',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Step 3: User approves and posts the reel
app.post('/api/approve-and-post-reel/:draftId', async (req, res) => {
  try {
    const { draftId } = req.params;
    const { finalApproval = true, scheduledTime } = req.body;

    if (!reelDrafts.has(draftId)) {
      return res.status(404).json({
        success: false,
        error: 'Draft not found or expired'
      });
    }

    const draft = reelDrafts.get(draftId);
    
    if (!finalApproval) {
      return res.status(400).json({
        success: false,
        error: 'Final approval required to post reel'
      });
    }

    console.log('✅ User approved reel, posting to platforms:', draft.platforms);

    // If scheduled for later
    if (scheduledTime) {
      const scheduleTime = new Date(scheduledTime);
      if (scheduleTime <= new Date()) {
        return res.status(400).json({
          success: false,
          error: 'Scheduled time must be in the future'
        });
      }

      // Store for scheduled posting (implement with cron job or queue)
      draft.status = 'scheduled';
      draft.scheduledTime = scheduleTime;
      reelDrafts.set(draftId, draft);

      return res.json({
        success: true,
        message: `Reel scheduled for posting at ${scheduleTime.toLocaleString()}`,
        draftId,
        status: 'scheduled',
        scheduledTime: scheduleTime
      });
    }

    // Post immediately
    draft.status = 'posting';
    reelDrafts.set(draftId, draft);

    const results = {
      instagram: { success: false, error: null },
      youtube: { success: false, error: null },
      facebook: { success: false, error: null },
      telegram: { success: false, error: null }
    };

    const promises = [];
    const { videoData, platforms } = draft;

    // Post to selected platforms
    if (platforms.includes('instagram')) {
      promises.push(
        postToInstagram(videoData.videoPath, `${videoData.content.title}\n\n${videoData.content.hashtags}`)
          .then((result) => {
            results.instagram = { success: true, ...result };
            console.log('✅ Instagram Reel posted successfully');
          })
          .catch(err => {
            results.instagram.error = err.message;
            console.error('❌ Instagram Reel failed:', err.message);
          })
      );
    }

    if (platforms.includes('youtube')) {
      promises.push(
        postToYouTube(videoData.videoPath, videoData.content.title, `${draft.jobUpdate}\n\n${videoData.content.hashtags}`)
          .then((result) => {
            results.youtube = { success: true, ...result };
            console.log('✅ YouTube Shorts posted successfully');
          })
          .catch(err => {
            results.youtube.error = err.message;
            console.error('❌ YouTube Shorts failed:', err.message);
          })
      );
    }

    if (platforms.includes('facebook')) {
      promises.push(
        postToFacebook(`${draft.jobUpdate}\n\n📹 Check out our latest job update reel!\n\n${videoData.content.hashtags}`)
          .then((result) => {
            results.facebook = { success: true, ...result };
            console.log('✅ Facebook post with reel link successful');
          })
          .catch(err => {
            results.facebook.error = err.message;
            console.error('❌ Facebook post failed:', err.message);
          })
      );
    }

    if (platforms.includes('telegram')) {
      promises.push(
        postToTelegram(videoData.videoPath, `${draft.jobUpdate}\n\n${videoData.content.hashtags}`)
          .then((result) => {
            results.telegram = { success: true, ...result };
            console.log('✅ Telegram video posted successfully');
          })
          .catch(err => {
            results.telegram.error = err.message;
            console.error('❌ Telegram video failed:', err.message);
          })
      );
    }

    // Wait for all posts to complete
    await Promise.allSettled(promises);

    // Update draft status
    draft.status = 'posted';
    draft.results = results;
    draft.postedAt = new Date();
    reelDrafts.set(draftId, draft);

    // Calculate success rate
    const successCount = Object.values(results).filter(r => r.success).length;
    const totalPlatforms = platforms.length;

    // Clean up draft after 7 days (implement with cleanup job)
    setTimeout(() => {
      reelDrafts.delete(draftId);
    }, 7 * 24 * 60 * 60 * 1000);

    res.json({
      success: successCount > 0,
      message: `Job reel posted to ${successCount}/${totalPlatforms} platforms successfully`,
      draftId,
      results,
      summary: {
        totalPlatforms,
        successCount,
        failedCount: totalPlatforms - successCount,
        successRate: `${((successCount / totalPlatforms) * 100).toFixed(1)}%`
      },
      posted_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Reel posting error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to post approved reel',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get draft details for review
app.get('/api/reel-draft/:draftId', (req, res) => {
  try {
    const { draftId } = req.params;
    
    if (!reelDrafts.has(draftId)) {
      return res.status(404).json({
        success: false,
        error: 'Draft not found or expired'
      });
    }

    const draft = reelDrafts.get(draftId);
    
    res.json({
      success: true,
      draft: {
        id: draftId,
        jobUpdate: draft.jobUpdate,
        platforms: draft.platforms,
        content: draft.videoData.content,
        status: draft.status,
        createdAt: draft.createdAt,
        lastModified: draft.lastModified,
        isUploaded: draft.videoData.isUploaded || false
      }
    });

  } catch (error) {
    console.error('Get draft error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve draft',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// List all user drafts
app.get('/api/reel-drafts', (req, res) => {
  try {
    const drafts = Array.from(reelDrafts.entries()).map(([id, draft]) => ({
      id,
      jobUpdate: draft.jobUpdate.substring(0, 100) + (draft.jobUpdate.length > 100 ? '...' : ''),
      platforms: draft.platforms,
      status: draft.status,
      createdAt: draft.createdAt,
      lastModified: draft.lastModified,
      isUploaded: draft.videoData.isUploaded || false
    })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      drafts,
      total: drafts.length
    });

  } catch (error) {
    console.error('List drafts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve drafts'
    });
  }
});

// Delete draft
app.delete('/api/reel-draft/:draftId', (req, res) => {
  try {
    const { draftId } = req.params;
    
    if (!reelDrafts.has(draftId)) {
      return res.status(404).json({
        success: false,
        error: 'Draft not found'
      });
    }

    reelDrafts.delete(draftId);
    
    res.json({
      success: true,
      message: 'Draft deleted successfully'
    });

  } catch (error) {
    console.error('Delete draft error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete draft'
    });
  }
});

// Main posting endpoint
app.post('/api/post', async (req, res) => {
  try {
    const { message } = req.body;
    
    // Validate input
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }
    
    if (message.length > 20000) {
      return res.status(400).json({
        success: false,
        error: 'Message exceeds 20,000 character limit'
      });
    }

    console.log('Posting message to all platforms:', message.substring(0, 100) + '...');
    
    const results = {
      twitter: { success: false, error: null },
      linkedin: { success: false, error: null },
      facebook: { success: false, error: null },
      whatsapp: { success: false, error: null }
    };

    // Post to all platforms simultaneously
    const promises = [
      postToTwitter(message).then(() => {
        results.twitter.success = true;
        console.log('✅ Twitter post successful');
      }).catch(err => {
        results.twitter.error = err.message;
        console.error('❌ Twitter post failed:', err.message);
      }),
      
      postToLinkedIn(message).then(() => {
        results.linkedin.success = true;
        console.log('✅ LinkedIn post successful');
      }).catch(err => {
        results.linkedin.error = err.message;
        console.error('❌ LinkedIn post failed:', err.message);
      }),
      
      postToFacebook(message).then(() => {
        results.facebook.success = true;
        console.log('✅ Facebook post successful');
      }).catch(err => {
        results.facebook.error = err.message;
        console.error('❌ Facebook post failed:', err.message);
      }),
      
    //   postToWhatsApp(message).then(() => {
    //     results.whatsapp.success = true;
    //     console.log('✅ WhatsApp message successful');
    //   }).catch(err => {
    //     results.whatsapp.error = err.message;
    //     console.error('❌ WhatsApp message failed:', err.message);
    //   })
    ];

    // Wait for all posts to complete
    await Promise.allSettled(promises);
    
    // Calculate success rate
    const successCount = Object.values(results).filter(r => r.success).length;
    const totalPlatforms = Object.keys(results).length;
    
    res.json({
      success: successCount > 0,
      message: `Posted to ${successCount}/${totalPlatforms} platforms successfully`,
      results,
      posted_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Social Media Poster API is running!',
    platforms: ['Twitter', 'LinkedIn', 'Facebook', 'WhatsApp'],
    max_characters: 20000
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Something went wrong!'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 POST /api/post - Main posting endpoint`);
  console.log(`🔍 GET /api/health - Health check`);
  console.log(`🧪 GET /api/test - Test endpoint`);
});

module.exports = app;