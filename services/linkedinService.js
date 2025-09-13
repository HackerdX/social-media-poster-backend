const axios = require('axios');

const postToLinkedIn = async (message) => {
  try {
    // Check if credentials are available
    if (!process.env.LINKEDIN_ACCESS_TOKEN) {
      throw new Error('LinkedIn access token not configured');
    }

    // LinkedIn API endpoint for creating posts (v2 API)
    const url = 'https://api.linkedin.com/rest/posts';
    
    // Prepare the post data using the newer LinkedIn API format
    const postData = {
      author: `urn:li:person:${process.env.LINKEDIN_PERSON_ID}`,
      commentary: message,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: []
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false
    };

    // Make the API request with updated headers
    const response = await axios.post(url, postData, {
      headers: {
        'Authorization': `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202308'
      }
    });

    console.log('✅ LinkedIn post successful:', response.data.id || 'Posted');
    return {
      success: true,
      platform: 'LinkedIn',
      postId: response.data.id,
      url: response.data.id ? `https://www.linkedin.com/feed/update/${response.data.id}` : 'Posted successfully'
    };

  } catch (error) {
    console.error('❌ LinkedIn posting error:', error.response?.data || error.message);
    
    // Handle specific LinkedIn API errors
    if (error.response?.status === 401) {
      throw new Error('LinkedIn: Access token expired or invalid');
    } else if (error.response?.status === 403) {
      throw new Error('LinkedIn: Insufficient permissions or rate limit exceeded');
    } else if (error.response?.status === 422) {
      throw new Error('LinkedIn: Invalid post data or content policy violation');
    }
    
    throw new Error(`LinkedIn: ${error.response?.data?.message || error.message}`);
  }
};

module.exports = {
  postToLinkedIn
};