const { TwitterApi } = require('twitter-api-v2');

// Initialize Twitter client
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

const postToTwitter = async (message) => {
  try {
    // Check if credentials are available
    if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_ACCESS_TOKEN) {
      throw new Error('Twitter API credentials not configured');
    }

    // Twitter has a character limit, so we might need to truncate or create a thread
    let tweetText = message;
    
    // If message is too long for a single tweet, truncate and add indication
    if (message.length > 280) {
      tweetText = message.substring(0, 276) + '...';
      console.log('⚠️ Twitter message truncated due to character limit');
    }

    // Post the tweet - make sure you use 'twitterClient' not 'client'
    const tweet = await twitterClient.v2.tweet(tweetText);
    
    console.log('✅ Twitter post successful:', tweet.data.id);
    return {
      success: true,
      platform: 'Twitter',
      postId: tweet.data.id,
      url: `https://twitter.com/user/status/${tweet.data.id}`
    };

  } catch (error) {
    console.error('❌ Twitter posting error:', error);
    throw new Error(`Twitter: ${error.message}`);
  }
};

module.exports = {
  postToTwitter
};
