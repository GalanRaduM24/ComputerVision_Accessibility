# Vision Assistant: AI-Powered Environmental Accessibility

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React Native](https://img.shields.io/badge/React%20Native-Expo-61DAFB?logo=react&logoColor=white)](https://reactnative.dev/)
[![OpenAI](https://img.shields.io/badge/AI-OpenAI%20Vision%20%26%20Audio-412991?logo=openai&logoColor=white)](https://openai.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An intelligent, voice-first assistive mobile application built with **React Native (Expo)** and **OpenAI GPT-4 Vision**. Designed specifically for visually impaired users, the application continuously interprets the physical environment through the device camera and delivers low-latency, real-time auditory scene descriptions and object localization.

---

## Architecture Overview

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                     Voice & Accessibility Input                          │
│  • Continuous Hotword Detection ("Hey...")                               │
│  • Intent Extraction & Voice Query Routing                               │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │ triggers
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      Device Vision & Frame Capture                       │
│  • High-Resolution Live Camera Stream (Expo Camera)                      │
│  • Frame Preprocessing, Encoding & Aspect Ratio Optimization             │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │ payload
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     Multimodal AI Reasoning Engine                       │
│  • OpenAI GPT-4 Vision: Spatial Analysis & Object Localization           │
│  • Contextual Prompt Engineering for Accessibility Guidance              │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │ natural language response
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       Text-to-Speech Audio Output                        │
│  • Real-time Audio Guidance & Directional Haptic Cues                     │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

- **Hands-Free Voice Activation**: Continuous audio monitoring for hotwords ("Hey") allowing fully hands-free operation.
- **Real-Time Scene Interpretation**: Generates comprehensive natural language summaries of the immediate surroundings, obstacles, and navigation paths.
- **Targeted Object Localization**: Ask specifically for items (e.g. "find my keys", "where is the door") with spatial guidance relative to the user.
- **Haptic & Visual Accessibility State**: Haptic feedback cues and high-contrast status indicators tailored for low-vision workflows.

---

## Voice Commands

| Command | Action |
|:---|:---|
| `"Hey"` | Activates listening mode |
| `"Hey, what's in front of me"` | Initiates full scene analysis and describes environment |
| `"Hey, find [item]"` | Targets specific object and describes relative direction/distance |
| `"Hey, resume"` | Re-enables automated continuous scanning mode |

---

## Project Structure

```text
my-app/
├── app/
│   ├── (tabs)/
│   │   ├── camera.tsx         # Main camera interface & continuous vision loop
│   │   ├── explore.tsx        # Secondary exploration tools
│   │   └── index.tsx          # Initial entry point & accessibility setup
│   └── _layout.tsx            # Global navigation & audio/haptic providers
├── components/                # Reusable accessible UI components
├── constants/                 # Theme colors, styling tokens, and hotword constants
├── hooks/                     # Custom React hooks (voice recognition, permissions)
├── config.plugin.js           # Expo native configuration plugins
└── package.json               # Project dependencies and run scripts
```

---

## Getting Started

### Prerequisites
- Node.js 18.x or higher
- npm or yarn
- OpenAI API Key (with GPT-4 Vision access)
- Expo Go app installed on your physical iOS/Android device

### Installation & Configuration

1. **Clone the repository**:
   ```bash
   git clone https://github.com/GalanRaduM24/ComputerVision_Accessibility.git
   cd ComputerVision_Accessibility/my-app
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure API credentials**:
   Copy the configuration template and insert your OpenAI API key:
   ```bash
   cp config.template.ts config.ts
   ```
   In `config.ts`:
   ```typescript
   export const config = {
     openaiApiKey: 'your-openai-api-key-here'
   };
   ```

4. **Start the development server**:
   ```bash
   npx expo start
   ```
   Scan the QR code with your mobile device via **Expo Go** (Android) or the **Camera** app (iOS).
