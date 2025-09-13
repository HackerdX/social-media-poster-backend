#!/bin/bash

# Social Media Poster - Complete Setup Script
echo "🚀 Setting up Social Media Poster Application..."

# Create main project directory
echo "📁 Creating project structure..."
mkdir -p social-media-poster
cd social-media-poster

# Create backend structure
mkdir -p services

# Initialize backend package.json
echo "📦 Initializing backend..."
cat > package.json << 'EOF'
{
  "name": "social-media-poster",
  "version": "1.0.0",
  "description": "Social media multi-platform posting app",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "client": "cd client && npm start",
    "build": "cd client && npm run build",
    "both": "concurrently \"npm run dev\" \"npm run client\""
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "twitter-api-v2": "^1.15.1",
    "node-linkedin": "^0.5.6",
    "fb": "^2.0.0",
    "axios": "^1.5.0",
    "helmet": "^7.0.0",
    "express-rate-limit": "^6.10.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "concurrently": "^8.2.2"
  },
  "keywords": [
    "social-media",
    "posting",
    "twitter",
    "linkedin",
    "facebook",
    "automation"
  ],
  "author": "Your Name",
  "license": "MIT"
}
EOF

# Create .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
client/node_modules/

# Environment variables
.env

# Logs
*.log
npm-debug.log*

# Build outputs
client/build/
dist/

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Temporary files
*.tmp
*.temp
EOF

# Create environment template
cat > .env.example << 'EOF'
# Environment Variables for Social Media Poster

# Server Configuration
PORT=5000
NODE_ENV=development

# Twitter API Credentials (Get from https://developer.twitter.com/)
TWITTER_API_KEY=your_twitter_api_key_here
TWITTER_API_SECRET=your_twitter_api_secret_here
TWITTER_ACCESS_TOKEN=your_twitter_access_token_here
TWITTER_ACCESS_TOKEN_SECRET=your_twitter_access_token_secret_here

# LinkedIn API Credentials (Get from https://www.linkedin.com/developers/)
LINKEDIN_ACCESS_TOKEN=your_linkedin_access_token_here
LINKEDIN_PERSON_ID=your_linkedin_person_id_here

# Facebook API Credentials (Get from https://developers.facebook.com/)
FACEBOOK_ACCESS_TOKEN=your_facebook_access_token_here
FACEBOOK_PAGE_ID=your_facebook_page_id_here
EOF

echo "⚙️ Installing backend dependencies..."
npm install

echo "⚛️ Creating React frontend..."
npx create-react-app client

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd client
npm install axios
cd ..

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Copy your API credentials to .env file"
echo "2. Copy the service files to services/ directory"
echo "3. Copy server.js to root directory" 
echo "4. Copy React components to client/src/"
echo "5. Run the application with: npm run both"
echo ""
echo "🔗 Useful commands:"
echo "  npm run dev     - Start backend only"
echo "  npm run client  - Start frontend only" 
echo "  npm run both    - Start both servers"
echo "  npm run build   - Build for production"