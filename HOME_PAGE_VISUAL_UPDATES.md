# Home Page Visual Updates

## Changes Made

### 1. Terminal Design Updates
- **Removed terminal header** - No more red/yellow/green buttons to match existing terminal
- **Changed background** - Now uses `#1a1a1a` to match existing terminal
- **Updated colors**:
  - Text: `#f0f0f0` (light gray) instead of green
  - Prompt: `#888` (gray) to match existing terminal
  - Removed all green (`#0f0`) colors
- **Changed prompt symbol** - Now uses `>` instead of `$`
- **Updated cursor** - Block cursor with proper blink animation matching existing terminal

### 2. Text Size
- **Base font size**: 4em (4x larger)
- **Responsive scaling**:
  - 1200px and below: 3em
  - 900px and below: 2.5em
  - 768px and below: 2em
  - 480px and below: 1.5em
- **Option text**: Scaled to 0.5em of base for readability
- **ASCII art**: Scaled to 0.8em of base
- **Terminal hint**: Scaled to 0.3em of base

### 3. Layout Improvements
- **Larger container**: 95% width, 90vh height
- **More padding**: 40px for better spacing with large text
- **Centered ASCII art**
- **Better option spacing**: Larger padding and margins

### 4. AboutPage Overflow Fix
- **Fixed height**: Set to 100vh instead of min-height
- **Added overflow-y**: auto on both page and content area
- **Content scrolling**: Limited content area height to `calc(100vh - 300px)`
- **Updated colors**: Matching the terminal theme (no more green)
- **Subtle button**: Gray background instead of bright green

## Visual Consistency
- All colors now match the existing terminal component
- Consistent use of `#f0f0f0` for text
- Gray (`#888`) for prompts and secondary elements
- Dark backgrounds (`#0a0a0a` and `#1a1a1a`)
- Subtle hover effects with transparency

## Responsive Design
- Text scales appropriately on all screen sizes
- ASCII art hidden on very small screens (< 480px)
- Terminal takes up most of the viewport
- Proper overflow handling at all sizes