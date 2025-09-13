const axios = require('axios');
const FormData = require('form-data');

const postToInstagram = async (videoPath, caption) => {
  try {
    // Check if credentials are available
    if (!process.env.INSTAGRAM_ACCESS_TOKEN || !process.env.INSTAGRAM_ACCOUNT_ID) {
      throw new Error('Instagram API credentials not configured');
    }

    // Step 1: Create Instagram Reel container
    const containerUrl = `https://graph.facebook.com/v18.0/${process.env.INSTAGRAM_ACCOUNT_ID}/media`;
    
    const containerData = {
      media_type: 'REELS',
      video_url: videoPath, // Must be a publicly accessible URL
      caption: caption,
      access_token: process.env.INSTAGRAM_ACCESS_TOKEN
    };

    const containerResponse = await axios.post(containerUrl, containerData);
    const creationId = containerResponse.data.id;

    // Step 2: Wait for video processing (Instagram needs time to process)
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds

    // Step 3: Publish the Reel
    const publishUrl = `https://graph.facebook.com/v18.0/${process.env.INSTAGRAM_ACCOUNT_ID}/media_publish`;
    
    const publishData = {
      creation_id: creationId,
      access_token: process.env.INSTAGRAM_ACCESS_TOKEN
    };

    const publishResponse = await axios.post(publishUrl, publishData);

    console.log('✅ Instagram Reel posted successfully:', publishResponse.data.id);
    return {
      success: true,
      platform: 'Instagram',
      postId: publishResponse.data.id,
      url: `https://instagram.com/p/${publishResponse.data.id}`
    };

  } catch (error) {
    console.error('❌ Instagram posting error:', error.response?.data || error.message);
    throw new Error(`Instagram: ${error.response?.data?.error?.message || error.message}`);
  }
};

const postToYouTube = async (videoPath, title, description) => {
  try {
    // Check if credentials are available
    if (!process.env.YOUTUBE_API_KEY) {
      throw new Error('YouTube API credentials not configured');
    }

    // YouTube Shorts requirements: <= 60 seconds, #Shorts hashtag
    const shortsTitle = `${title} #Shorts`;
    const shortsDescription = `${description}\n\n#Shorts #JobUpdate #Career`;

    // For actual implementation, you'd use Google APIs Client Library
    // This is a simplified example structure
    const uploadUrl = `https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&key=${process.env.YOUTUBE_API_KEY}`;

    // Note: Actual YouTube upload requires OAuth2 and multipart form data
    // This is a conceptual structure - real implementation needs google-auth-library
    console.log('YouTube Shorts upload would happen here with:', {
      title: shortsTitle,
      description: shortsDescription,
      videoFile: videoPath
    });

    // Placeholder response
    return {
      success: true,
      platform: 'YouTube',
      postId: 'youtube_video_id',
      url: 'https://youtube.com/shorts/video_id'
    };

  } catch (error) {
    console.error('❌ YouTube posting error:', error);
    throw new Error(`YouTube: ${error.message}`);
  }
};

const postToTelegram = async (videoPath, caption) => {
  try {
    // Check if credentials are available
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
      throw new Error('Telegram API credentials not configured');
    }

    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendVideo`;
    
    // Create form data for video upload
    const formData = new FormData();
    formData.append('chat_id', process.env.TELEGRAM_CHAT_ID);
    formData.append('video', videoPath); // Can be URL or file path
    formData.append('caption', caption);
    formData.append('supports_streaming', 'true');

    const response = await axios.post(url, formData, {
      headers: {
        ...formData.getHeaders()
      }
    });

    console.log('✅ Telegram video sent successfully:', response.data.result.message_id);
    return {
      success: true,
      platform: 'Telegram',
      messageId: response.data.result.message_id,
      chatId: process.env.TELEGRAM_CHAT_ID
    };

  } catch (error) {
    console.error('❌ Telegram posting error:', error.response?.data || error.message);
    throw new Error(`Telegram: ${error.response?.data?.description || error.message}`);
  }
};

module.exports = {
  postToInstagram,
  postToYouTube,
  postToTelegram
};