const axios = require('axios');

const postToWhatsApp = async (message) => {
  try {
    // Check if credentials are available
    if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
      throw new Error('WhatsApp API credentials not configured');
    }

    if (!process.env.WHATSAPP_RECIPIENT_NUMBER) {
      throw new Error('WhatsApp recipient number not configured');
    }

    // WhatsApp Cloud API endpoint
    const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    
    // Prepare the message data
    const messageData = {
      messaging_product: "whatsapp",
      to: process.env.WHATSAPP_RECIPIENT_NUMBER,
      type: "text",
      text: {
        body: message
      }
    };

    // Make the API request
    const response = await axios.post(url, messageData, {
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ WhatsApp message sent successfully:', response.data.messages[0].id);
    return {
      success: true,
      platform: 'WhatsApp',
      messageId: response.data.messages[0].id,
      recipient: process.env.WHATSAPP_RECIPIENT_NUMBER
    };

  } catch (error) {
    console.error('❌ WhatsApp posting error:', error.response?.data || error.message);
    
    // Handle specific WhatsApp API errors
    if (error.response?.status === 400) {
      const errorCode = error.response.data?.error?.code;
      if (errorCode === 131026) {
        throw new Error('WhatsApp: Message undeliverable - recipient may have blocked business number');
      } else if (errorCode === 131047) {
        throw new Error('WhatsApp: Re-engagement message - recipient hasn\'t messaged you in 24+ hours');
      } else if (errorCode === 131051) {
        throw new Error('WhatsApp: Unsupported message type for recipient');
      }
    } else if (error.response?.status === 401) {
      throw new Error('WhatsApp: Invalid access token or expired token');
    } else if (error.response?.status === 403) {
      throw new Error('WhatsApp: Insufficient permissions or phone number not verified');
    }
    
    throw new Error(`WhatsApp: ${error.response?.data?.error?.message || error.message}`);
  }
};

module.exports = {
  postToWhatsApp
};