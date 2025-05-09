# Vision Assistant App

A React Native application that uses the device's camera and OpenAI's Vision API to provide audio descriptions of surroundings. The app features voice commands for accessibility and is designed primarily for visually impaired users.

https://github-production-user-asset-6210df.s3.amazonaws.com/119741950/433049317-81a3aaa0-9826-43e8-adfb-956f6129322a.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAVCODYLSA53PQK4ZA%2F20250509%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20250509T215351Z&X-Amz-Expires=300&X-Amz-Signature=40e4acfc43dbdf94fb8c5e0e5fd1f258971dc02cdbbabb4f75c125700872378c&X-Amz-SignedHeaders=host

## Setup Instructions

1. Clone the repository
   ```
   git clone <repository-url>
   cd <repository-directory>
   ```

2. Install dependencies
   ```
   cd my-app
   npm install
   ```

3. Set up configuration files
   - Create a `config.ts` file in the `my-app` directory using the template:
     ```
     cp my-app/config.template.ts my-app/config.ts
     ```
   - Edit `my-app/config.ts` and add your OpenAI API key:
     ```typescript
     export const config = {
       openaiApiKey: 'your-openai-api-key-here'
     };
     ```

4. Create a `.env` file (optional)
   - Create a `.env` file in the `my-app` directory:
     ```
     OPENAI_API_KEY=your-openai-api-key-here
     ```

5. Start the application
   ```
   npm start
   ```

## Features

- Voice command recognition with "Hey" wake word
- Scene description mode for general environment analysis
- Task-specific help mode for targeted assistance
- Continuous voice recognition for hands-free operation
- Visual status indicators for accessibility

## Project Structure

- `my-app/app/(tabs)/camera.tsx`: Main camera functionality and voice recognition
- `my-app/components/`: Reusable UI components
- `my-app/constants/`: Application constants
- `my-app/hooks/`: Custom React hooks

## Voice Commands

- Say "Hey" to activate voice recognition
- "Hey, what's in front of me" for general scene description
- "Hey, find [object]" for targeted object detection
- "Hey, resume" to continue analysis mode after an interruption
