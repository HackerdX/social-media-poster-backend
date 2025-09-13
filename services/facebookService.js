const axios = require('axios');

const postToFacebook = async (message) => {
  try {
    // Check if credentials are available
    if (!process.env.FACEBOOK_ACCESS_TOKEN || !process.env.FACEBOOK_PAGE_ID) {
      throw new Error('Facebook access token or page ID not configured');
    }

    // Facebook Graph API endpoint for posting to a page (updated to latest version)
    const url = `https://graph.facebook.com/v18.0/${process.env.FACEBOOK_PAGE_ID}/feed`;
    
    // Prepare the post data
    const postData = {
      message: message,
      access_token: process.env.FACEBOOK_ACCESS_TOKEN
    };

    // Make the API request
    const response = await axios.post(url, postData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Facebook post successful:', response.data.id);
    return {
      success: true,
      platform: 'Facebook',
      postId: response.data.id,
      url: `https://facebook.com/${response.data.id}`
    };

  } catch (error) {
    console.error('❌ Facebook posting error:', error.response?.data || error.message);
    
    // Handle specific Facebook API errors
    if (error.response?.status === 400) {
      const errorCode = error.response.data?.error?.code;
      if (errorCode === 190) {
        throw new Error('Facebook: Access token expired or invalid');
      } else if (errorCode === 200) {
        throw new Error('Facebook: Insufficient permissions for this action');
      } else if (errorCode === 368) {
        throw new Error('Facebook: Content violates Facebook policies');
      }
    } else if (error.response?.status === 403) {
      throw new Error('Facebook: Account restricted or insufficient permissions');
    }
    
    throw new Error(`Facebook: ${error.response?.data?.error?.message || error.message}`);
  }
};

module.exports = {
  postToFacebook
};