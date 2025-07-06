# W.I.T. Terminal - Industrial UI

A clean, industrial-style workshop terminal interface built with React, TypeScript, and Tailwind CSS.

## Features

- **Industrial Design**: Clean black-on-white blocky interface
- **No Scroll Design**: All content fits within viewport
- **Responsive Layout**: Adapts to different screen sizes
- **Voice Control Interface**: Simulated voice command system
- **Machine & Sensor Management**: Track workshop equipment status
- **Project Tracking**: Monitor ongoing projects

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## Project Structure

```
wit/software/frontend/web/
├── src/
│   ├── App.tsx          # Main application component
│   ├── App.css          # App-specific styles (currently empty)
│   ├── index.css        # Global industrial theme styles
│   └── main.tsx         # Application entry point
├── index.html           # HTML template
├── package.json         # Dependencies and scripts
├── tailwind.config.js   # Tailwind configuration
├── postcss.config.js    # PostCSS configuration
├── vite.config.ts       # Vite configuration
└── tsconfig.json        # TypeScript configuration
```

## Design System

### Colors
- Primary: Black (#000000)
- Background: White (#FFFFFF) and Light Gray (#F3F4F6)
- Status Colors:
  - Active/Online: Black
  - Inactive/Offline: Gray
  - Busy: Yellow
  - Error: Red

### Typography
- Headers: Oswald (bold, uppercase)
- Body: Inter
- Monospace elements: System monospace

### Components
- Blocky borders (2px solid black)
- Sharp corners (no border radius)
- Box shadows for depth (4px offset)
- Hover effects with transform animations

## Key Features Implemented

1. **Fixed Viewport Layout**: Content is contained within viewport height
2. **Grid-based Layouts**: Clean, organized component arrangement
3. **Status Indicators**: Clear visual feedback for equipment states
4. **Responsive Design**: Adapts to mobile and desktop screens
5. **Industrial Aesthetic**: Bold, functional design language