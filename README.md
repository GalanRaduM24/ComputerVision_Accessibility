# Vision Assistant App

A React Native application that uses the device's camera and OpenAI's Vision API to provide audio descriptions of surroundings. The app features voice commands for accessibility and is designed primarily for visually impaired users.

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

## You can access our presentation [here](https://www.canva.com/design/DAGjy1mgwis/slWB7Rl90ZanBv3x0a2hHA/edit).
