const axios = require('axios');
const OpenAI = require('openai');
const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs').promises;
const path = require('path');

// Fix OpenAI import - try both import methods
let openai = null;
try {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 20) {
    // Try the new import method first
    try {
      const OpenAI = require('openai').default || require('openai');
      openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      console.log('✅ OpenAI initialized successfully (new method)');
    } catch (importError) {
      // Fallback to old import method
      const { OpenAI } = require('openai');
      openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      console.log('✅ OpenAI initialized successfully (fallback method)');
    }
  } else {
    console.log('⚠️ OpenAI API key not valid (length check failed), using fallback');
  }
} catch (error) {
  console.log('⚠️ OpenAI initialization failed, using fallback:', error.message);
}

class ReelGenerator {
  constructor() {
    this.outputDir = './generated_reels';
    this.templatesDir = './reel_templates';
    this.ensureDirectories();
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
      await fs.mkdir(this.templatesDir, { recursive: true });
    } catch (error) {
      console.log('Directories already exist');
    }
  }

  // services/jobReelGenerator.js

async generateJobReelContent(jobUpdate) {
  try {
    console.log('🎬 Parsing structured job update...');
    
    // Parse the structured job format
    const parsedJob = this.parseJobUpdate(jobUpdate);
    
    // If OpenAI is available, enhance the parsed content
    if (openai && typeof openai.chat?.completions?.create === 'function') {
      try {
        const prompt = `Enhance this job posting for a reel video:
        ${JSON.stringify(parsedJob)}
        v
        Create engaging social media content with:
        1. A catchy hook (max 30 characters)
        2. Call-to-action text
        3. Relevant hashtags
        
        Keep the original job details intact. Return JSON with: hook, cta, hashtags`;

        const response = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 500
        });

        const aiEnhancement = JSON.parse(response.choices[0].message.content);
        return {
          ...parsedJob,
          hook: aiEnhancement.hook,
          cta: aiEnhancement.cta,
          hashtags: aiEnhancement.hashtags
        };
      } catch (error) {
        console.error('❌ OpenAI enhancement failed, using parsed content:', error.message);
      }
    }
    
    // Return parsed content with fallback enhancements
    return {
      ...parsedJob,
      hook: "🚨 Job Alert!",
      cta: "Apply Now 👆",
      hashtags: "#jobs #career #government #hiring #jobsearch"
    };
    
  } catch (error) {
    console.error('Error parsing job content:', error);
    return this.generateFallbackContent(jobUpdate);
  }
}

// New method to parse the structured job format
// services/jobReelGenerator.js

parseJobUpdate(jobUpdate) {
  // 1. Normalize: insert a newline before every bullet marker
  const normalized = jobUpdate
    .replace(/🔹/g, '\n🔹')    // split at bullets
    .replace(/📢/g, '\n📢')    // ensure job alert also starts a line
    .trim();

  // 2. Split into lines
  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);

  const parsed = {
    title: '',
    organization: '',
    postName: '',
    vacancies: '',
    qualification: '',
    lastDate: '',
    notificationLink: '',
    applyLink: '',
    socialLinks: [],
    rawText: jobUpdate
  };

  // 3. Process each line
  lines.forEach(line => {
    const clean = line.replace(/🔹|📢|✨|👉/g, '').trim();
    if (clean.startsWith('𝐉𝐎𝐁') || clean.toUpperCase().startsWith('JOB ALERT')) {
      // Split by dash-like characters, also supporting different dash types
      const parts = clean.split(/[-–—]/); // split on hyphen, en dash, em dash
      // The date is expected after the dash
      parsed.title = parts.length > 1 ? parts[1].trim() : clean.trim();
    } else if (/^Organization:/i.test(clean)) {
      parsed.organization = clean.split(':').slice(1).join(':').trim();
    } else if (/^Post Name:/i.test(clean)) {
      parsed.postName = clean.split(':').slice(1).join(':').trim();
    } else if (/^Vacancies:/i.test(clean)) {
      parsed.vacancies = clean.split(':').slice(1).join(':').trim();
    } else if (/^Qualification:/i.test(clean)) {
      parsed.qualification = clean.split(':').slice(1).join(':').trim();
    } else if (/^Last Date:/i.test(clean)) {
      parsed.lastDate = clean.split(':').slice(1).join(':').trim();
    } else if (/^(Notification link|Notification Link):/i.test(clean)) {
      parsed.notificationLink = this.extractUrl(clean);
    } else if (/^Apply Link:/i.test(clean)) {
      parsed.applyLink = this.extractUrl(clean);
    } else if (/https?:\/\//i.test(clean)) {
      // capture any other URLs as social links
      const url = this.extractUrl(clean);
      if (url) parsed.socialLinks.push(url);
    }
  });

  return parsed;
}


// Helper method to extract URLs
extractUrl(text) {
  const urlMatch = text.match(/https?:\/\/[^\s\]]+/);
  return urlMatch ? urlMatch[0] : '';
}

// Add a helper to wrap text into lines fitting a given character limit
wrapSvgText(text, maxCharsPerLine = 24) {
  const words = text.split(' ');
  const lines = [];
  let line = '';

  for (const word of words) {
    if ((line + ' ' + word).trim().length <= maxCharsPerLine) {
      line = (line + ' ' + word).trim();
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// This method creates a preview object for a job reel
async generateJobReelPreview(jobUpdate, style = 'professional') {
  try {
    console.log('🎬 Generating job reel content...');
    let content = await this.generateJobReelContent(jobUpdate);
    if (!content || typeof content.title !== 'string') {
      console.warn('⚠️ generateJobReelContent returned invalid content, using fallback');
      content = this.generateFallbackContent(jobUpdate);
    }

    console.log('🎨 Creating preview...' );
    const postOrgLines = this.wrapSvgText(content.organization, 40);
    const postNameLines = this.wrapSvgText(content.postName, 40);
    const qualificationLines = this.wrapSvgText(content.qualification, 40);
    console.log(content)

    const thumbnailSvg = `
      <svg width="300" height="400" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#667eea;stop-opacity:1"/>
            <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        <text x="140" y="30" font-family="Arial" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle">
          ${content.hook}
        </text>
        <text x="150" y="50" font-family="Arial" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle">
          ${content.title}
        </text>
        ${postOrgLines.map((line, i) => `
          <text x="150" y="${80 + i * 20}" font-family="Arial" font-size="12" fill="#ffffff" text-anchor="middle">
            ${i === 0 ? '🏢 ' : ''}
            ${line}
          </text>
        `).join('')}
        ${postNameLines.map((line, i) => `
          <text x="150" y="${130 + i*20}" font-family="Arial" font-size="12" fill="#ffffff" text-anchor="middle">
            ${i === 0 ? '🎓 ' : ''}
            ${line}
          </text>
        `).join('')}
        <text x="150" y="${140 + postNameLines.length*20}" font-family="Arial" font-size="12" fill="#ffffff" text-anchor="middle">
          🔢 Vacancies: ${content.vacancies}
        </text>
        <text x="150" y="${170 + postNameLines.length*20}" font-family="Arial" font-size="12" fill="#ffffff" text-anchor="middle">
          📅 Last Date: ${content.lastDate}
        </text>
        ${qualificationLines.map((line, i) => `
          <text x="150" y="${200 + postNameLines.length*20 + i*20}" font-family="Arial" font-size="12" fill="#ffffff" text-anchor="middle">
            ${i === 0 ? '🎓 ' : ''}
            ${line}
          </text>
        `).join('')}
        <text x="150" y="${230 + postNameLines.length*20 + qualificationLines.length*20}" font-family="Arial" font-size="12" fill="#ffffff" text-anchor="middle">
          ${content.cta}
        </text>
        <text x="150" y="${250 + postNameLines.length*20 + qualificationLines.length*20}" font-family="Arial" font-size="10" fill="#cccccc" text-anchor="middle">
          ${content.hashtags}
        </text>
        <text x="150" y="370" font-family="Arial" font-size="8" fill="#ffffff" text-anchor="middle">
          Links in description
        </text>
      </svg>
    `;

    // Build preview object
    const preview = {
      thumbnailUrl: `data:image/svg+xml;base64,${Buffer.from(thumbnailSvg).toString('base64')}`,
      videoPreviewUrl: './placeholder-preview.mp4', // placeholder for actual preview
      duration: 15
    };

    // Return content, a mock video path, and the preview metadata
    return {
      content,
      videoPath: `${this.outputDir}/job_reel_${Date.now()}.mp4`,
      preview,
      style
    };

  } catch (error) {
    console.error('❌ Error creating job reel preview:', error);
    throw new Error(`generateJobReelPreview failed: ${error.message}`);
  }
}

  /**
 * Generates default reel content when AI fails or isn’t configured.
 * @param {string} jobUpdate - The raw job update text.
 * @returns {object} content with keys: title, hook, points, cta, hashtags, script
 */
generateFallbackContent(jobUpdate) {
  // Normalize to lowercase for parsing
  console.log(jobUpdate);
  const text = jobUpdate;

  // Attempt to extract a salary (e.g., "$100k")
  const salaryMatch = jobUpdate.match(/\$[\d,]+k?/i);
  const salary = salaryMatch ? salaryMatch[0] : '';

  // Attempt to extract a company name after common keywords
  let company = '';
  [' at ', ' for ', ' with '].some(keyword => {
    const idx = text.indexOf(keyword);
    if (idx !== -1) {
      company = jobUpdate.substring(idx + keyword.length).split(/[\s,.-]/)[0];
      return true;
    }
    return false;
  });

  // Guess a job title from common roles
  const roles = ['engineer', 'developer', 'manager', 'analyst', 'designer', 'specialist'];
  let jobTitle = roles.find(r => text.includes(r)) || 'Position';
  jobTitle = jobTitle.charAt(0).toUpperCase() + jobTitle.slice(1);

  return {
    title: company
      ? `${jobTitle} at ${company}!`
      : `New ${jobTitle} Opportunity!`,
    hook: salary
      ? `💰 ${salary} Job Alert!`
      : '🚀 Job Alert!',
    points: [
      '✨ Exciting opportunity',
      '💼 Great career move',
      '📈 Professional growth',
      '🎯 Apply today'
    ],
    cta: 'Apply Now 👆',
    hashtags:
      '#jobs #career #hiring #opportunity #jobsearch #employment #work #newjob #careers #jobupdate',
    script: `Exciting job update: ${jobUpdate}. This is a great opportunity for career advancement. Apply now and take your career to the next level!`
  };
}

  // Create video using HTML5 Canvas (simplified version)
  async createJobReelVideo(jobUpdate, outputFileName) {
    try {
      console.log('🎬 Generating job reel content...');
      const content = await this.generateJobReelContent(jobUpdate);

      console.log('🎨 Creating video frames...');
      const frames = await this.generateVideoFrames(content, jobUpdate);

      console.log('🎵 Generating video with frames...');
      const videoPath = await this.combineFramesToVideo(frames, outputFileName, content.script);

      return {
        videoPath,
        content,
        duration: 15 // 15 seconds for reels
      };
    } catch (error) {
      console.error('Error creating job reel:', error);
      throw error;
    }
  }

  async generateVideoFrames(content, jobUpdate) {
    const frames = [];
    const width = 1080;
    const height = 1920;
    
    // Frame 1: Job Alert Title (0-3 seconds)
    const titleFrame = await this.createFrame({
      width, height,
      background: '#1a1a2e',
      title: content.title || '📢 JOB ALERT',
      subtitle: content.hook || '🚨 New Opportunity!',
      style: 'title'
    });
  
    // Frame 2: Job Details (3-8 seconds)
    const detailsFrame = await this.createFrame({
      width, height,
      background: '#16213e',
      title: content.postName || 'Position Available',
      subtitle: `🏢 ${content.organization}\n💼 ${content.vacancies} Vacancies\n📅 Last Date: ${content.lastDate}`,
      style: 'details'
    });
    
    // Frame 3: Qualification (8-12 seconds)
    const qualFrame = await this.createFrame({
      width, height,
      background: '#0f3460',
      title: '📚 Qualification Required',
      subtitle: content.qualification || 'Check notification for details',
      style: 'qualification'
    });
    
    // Frame 4: Call to Action (12-15 seconds)
    const ctaFrame = await this.createFrame({
      width, height,
      background: '#2d1b69',
      title: content.cta || 'Apply Now!',
      subtitle: `${content.hashtags}\n\n🔗 Links in description`,
      style: 'cta'
    });

    return [
      { frame: titleFrame, duration: 3 },
      { frame: detailsFrame, duration: 5 },
      { frame: qualFrame, duration: 4 },
      { frame: ctaFrame, duration: 3 }
    ];
  }


  async createFrame({ width, height, background, title, subtitle, style }) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    // Add gradient overlay
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(255,255,255,0.1)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Title text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    if (style === 'title') {
      ctx.font = 'bold 70px Arial';
      const titleLines = this.wrapText(ctx, title, width - 100);
      titleLines.forEach((line, index) => {
        ctx.fillText(line, width / 2, 400 + (index * 80));
      });
      
      // Hook text
      ctx.font = 'bold 50px Arial';
      ctx.fillStyle = '#ffdd44';
      const hookLines = this.wrapText(ctx, subtitle, width - 100);
      hookLines.forEach((line, index) => {
        ctx.fillText(line, width / 2, 600 + (index * 60));
      });
      
    } else if (style === 'details') {
      ctx.font = 'bold 60px Arial';
      const titleLines = this.wrapText(ctx, title, width - 100);
      titleLines.forEach((line, index) => {
        ctx.fillText(line, width / 2, 300 + (index * 70));
      });
      
      // Details text
      ctx.font = '40px Arial';
      ctx.fillStyle = '#cccccc';
      const detailLines = subtitle.split('\n');
      detailLines.forEach((line, index) => {
        ctx.fillText(line, width / 2, 600 + (index * 50));
      });
      
    } else if (style === 'qualification') {
      ctx.font = 'bold 55px Arial';
      ctx.fillText(title, width / 2, 350);
      
      ctx.font = '35px Arial';
      ctx.fillStyle = '#cccccc';
      const qualLines = this.wrapText(ctx, subtitle, width - 150);
      qualLines.forEach((line, index) => {
        ctx.fillText(line, width / 2, 500 + (index * 45));
      });
      
    } else if (style === 'cta') {
      ctx.font = 'bold 80px Arial';
      ctx.fillStyle = '#ff6b6b';
      ctx.fillText(title, width / 2, 400);
      
      ctx.font = '30px Arial';
      ctx.fillStyle = '#ffffff';
      const ctaLines = subtitle.split('\n');
      ctaLines.forEach((line, index) => {
        ctx.fillText(line, width / 2, 600 + (index * 40));
      });
    }

    return canvas.toBuffer('image/png');
  }


  wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + " " + word).width;
      if (width < maxWidth) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  }

  async combineFramesToVideo(frames, outputFileName, voiceScript) {
    // For a real implementation, you'd use FFmpeg to combine frames
    // This is a simplified version that saves the first frame as a placeholder
    const outputPath = path.join(this.outputDir, `${outputFileName}.mp4`);
    
    // In a real implementation, you would:
    // 1. Use FFmpeg to create video from frames
    // 2. Add text-to-speech for voiceover
    // 3. Add background music
    // 4. Apply transitions between frames
    
    console.log('📹 Video generation (simplified):', {
      outputPath,
      frames: frames.length,
      voiceScript,
      note: 'Real implementation would use FFmpeg + TTS'
    });

    // For now, save the first frame as a static image
    await fs.writeFile(outputPath.replace('.mp4', '.png'), frames[0].frame);
    
    // Return a mock video path - in real implementation this would be the actual MP4
    return outputPath;
  }

  // Generate multiple reel variations
  async generateReelVariations(jobUpdate, count = 3) {
    const variations = [];
    
    for (let i = 0; i < count; i++) {
      const fileName = `job_reel_${Date.now()}_${i + 1}`;
      const reel = await this.createJobReelVideo(jobUpdate, fileName);
      variations.push({
        ...reel,
        fileName,
        variation: i + 1
      });
    }
    
    return variations;
  }
}

module.exports = ReelGenerator;