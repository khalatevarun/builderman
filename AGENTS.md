# Buildman - Agent Development Guidelines

This document contains guidelines and commands for agentic coding agents working on the Buildman project.

## Project Overview

Buildman is a full-stack web application consisting of:
- **Backend**: Node.js/Express API with TypeScript, OpenAI SDK (OpenRouter) integration
- **Frontend**: React + TypeScript + Vite with Tailwind CSS, Monaco Editor, WebContainer API

## Development Commands

### Backend (Node.js/TypeScript)
```bash
# Development
cd backend && npm run dev

# Build only
cd backend && npm run build

# Production
cd backend && npm start

# Type checking
cd backend && npx tsc --noEmit
```

### Frontend (React/TypeScript/Vite)
```bash
# Development server
cd frontend && npm run dev

# Build for production
cd frontend && npm run build

# Linting
cd frontend && npm run lint

# Preview production build
cd frontend && npm run preview

# Type checking
cd frontend && npx tsc --noEmit
```

### Running Tests
Currently no test framework is configured. When adding tests:
- Backend: Use Jest or Mocha with TypeScript support
- Frontend: Use Vitest (recommended for Vite projects) or Jest with React Testing Library

## Code Style Guidelines

### General Principles
- Use 2 spaces for indentation (consistent across both frontend and backend)
- Follow TypeScript strict mode guidelines
- Prefer explicit types over implicit `any`
- Keep functions small and focused
- Use descriptive variable and function names

### Import Organization
```typescript
// 1. Node.js built-ins
import { Readable, Transform } from 'stream';

// 2. External libraries (alphabetical)
import cors from 'cors';
import express from 'express';
import OpenAI from 'openai';

// 3. Internal modules (relative imports)
import { basePrompt } from './defaults/react';
import { getSystemPrompt } from './prompts';
```

### TypeScript Configuration
- **Backend**: CommonJS modules, ES2016 target, strict mode enabled
- **Frontend**: ES modules, modern target, strict mode enabled
- Always use proper type annotations
- Prefer interfaces over types for object shapes
- Use enums for constants with semantic meaning

### React Component Guidelines
```typescript
// Functional components with TypeScript
interface ComponentProps {
  title: string;
  onAction?: () => void;
}

export function Component({ title, onAction }: ComponentProps) {
  // Hooks at the top
  const [state, setState] = useState<string>('');
  
  // Event handlers
  const handleClick = useCallback(() => {
    onAction?.();
  }, [onAction]);
  
  // Render
  return (
    <div className="p-4">
      <h1>{title}</h1>
    </div>
  );
}
```

### Error Handling
```typescript
// Backend API routes
app.post("/endpoint", async (req, res) => {
  try {
    const result = await someOperation();
    res.json({ data: result });
  } catch (error) {
    console.error('Operation failed:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Frontend async operations
const handleSubmit = async () => {
  try {
    setLoading(true);
    await apiCall(data);
    setSuccess(true);
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Request failed');
  } finally {
    setLoading(false);
  }
};
```

### Naming Conventions
- **Files**: kebab-case for utilities, PascalCase for components
- **Variables**: camelCase, descriptive names
- **Constants**: UPPER_SNAKE_CASE for exported constants
- **Functions**: camelCase, verb-noun pattern (getUserData, handleSubmit)
- **Types/Interfaces**: PascalCase, descriptive names (UserProfile, ApiResponse)

### API Design Patterns
- Use RESTful conventions
- Consistent response format: `{ data: T, error?: string }`
- Proper HTTP status codes
- Request/response validation with TypeScript
- Environment variables for configuration

### Frontend State Management
- Use React hooks for local state
- Prefer custom hooks for complex logic
- Use WebContainer API for code execution
- Monaco Editor for code editing
- Axios for HTTP requests

### Backend Patterns
- Express.js with TypeScript middleware
- OpenAI SDK for AI interactions (OpenRouter-compatible)
- Streaming responses for real-time features
- CORS enabled for frontend communication
- Environment-based configuration

## File Structure Best Practices

### Backend Organization
```
backend/src/
├── index.ts           # Main entry point
├── constants.ts       # Shared constants
├── prompts.ts         # AI prompt templates
├── defaults/          # Default configurations
├── utilities/         # Helper functions
└── types/            # TypeScript definitions
```

### Frontend Organization
```
frontend/src/
├── components/        # Reusable components
├── pages/            # Route components
├── hooks/            # Custom React hooks
├── utility/          # Helper functions
├── types/            # TypeScript definitions
└── steps.ts          # Build step definitions
```

## Security Considerations
- Never commit API keys or secrets
- Use environment variables for sensitive data
- Validate all user inputs
- Implement proper CORS policies
- Sanitize user-generated content

## Performance Guidelines
- Lazy load React components when appropriate
- Use React.memo for expensive components
- Implement proper error boundaries
- Optimize bundle size with dynamic imports
- Use WebContainer's streaming capabilities

## Testing Strategy (When Implemented)
- Unit tests for utility functions
- Integration tests for API endpoints
- Component tests for React components
- E2E tests for critical user flows
- Type checking as first line of defense

## Development Workflow
1. Always run type checker before committing
2. Use linting to maintain code quality
3. Test changes in both development and production builds
4. Follow Git best practices with descriptive commit messages
5. Ensure backward compatibility when making API changes