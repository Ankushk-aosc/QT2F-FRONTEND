# Tableau to Fabric Migration Platform - Project Structure

## Overview
Enterprise-grade migration platform built with Next.js 15, TypeScript, and Fluent UI v9.

## Folder Structure

```
├── app/                          # Next.js 15 App Router
│   ├── (auth)/                   # Auth route group
│   │   └── signin/               # Sign-in page
│   ├── (protected)/              # Protected routes
│   │   └── dashboard/            # Main dashboard
│   ├── layout.tsx                # Root layout with Fluent UI Provider
│   ├── page.tsx                  # Landing page with auth redirect
│   └── globals.css               # Global styles
│
├── components/                   # React components
│   ├── ui/                       # Fluent UI wrapper components
│   │   ├── Button.tsx            # Button component wrapper
│   │   ├── Input.tsx             # Input component wrapper
│   │   ├── Card.tsx              # Card components
│   │   ├── Table.tsx             # Table components
│   │   ├── Accordion.tsx         # Accordion components
│   │   ├── Badge.tsx             # Badge component
│   │   ├── Spinner.tsx           # Spinner component
│   │   ├── Dialog.tsx            # Dialog components
│   │   ├── Tabs.tsx              # Tab components
│   │   ├── Dropdown.tsx          # Dropdown components
│   │   ├── Menu.tsx              # Menu components
│   │   ├── Label.tsx             # Label component
│   │   ├── Field.tsx             # Field component
│   │   ├── Divider.tsx           # Divider component
│   │   ├── Avatar.tsx            # Avatar component
│   │   ├── Text.tsx              # Text component
│   │   └── index.ts              # Central export file
│   │
│   ├── layout/                   # Layout components
│   │   ├── TopNavigation.tsx     # Top navigation bar with user menu
│   │   └── LeftSidebar.tsx       # Left sidebar with stats
│   │
│   ├── tabs/                     # Tab content components
│   │   ├── MigrationTab.tsx      # Migration configuration
│   │   ├── MonitoringTab.tsx     # Real-time agent monitoring
│   │   ├── ResultTab.tsx         # Migration results with sub-tabs
│   │   └── RunHistoryTab.tsx     # Historical runs
│   │
│   └── theme-provider.tsx        # Fluent UI theme configuration
│
├── features/                     # Feature modules
│   ├── auth/                     # Authentication feature
│   │   ├── auth.service.ts       # Auth API service
│   │   ├── auth.types.ts         # Auth TypeScript types
│   │   └── auth.test.ts          # Auth unit tests
│   │
│   └── dashboard/                # Dashboard feature
│       ├── dashboard.service.ts  # Dashboard API service
│       ├── dashboard.types.ts    # Dashboard TypeScript types
│       └── dashboard.test.ts     # Dashboard unit tests
│
├── services/                     # Core services
│   ├── http.client.ts            # HTTP client wrapper
│   ├── api.config.ts             # API configuration
│   └── http.client.test.ts       # HTTP client tests
│
├── stores/                       # Zustand state management
│   ├── store.types.ts            # Store type definitions
│   ├── auth.store.ts             # Authentication state
│   ├── ui.store.ts               # UI state (tabs, dialogs)
│   ├── dashboard.store.ts        # Dashboard state (migrations, logs)
│   └── index.ts                  # Store exports
│
├── hooks/                        # Custom React hooks
│   └── useAuth.ts                # Authentication hook
│
├── lib/                          # Utilities
│   └── constants.ts              # Application constants
│
└── package.json                  # Dependencies

```

## Technology Stack

### Core Framework
- **Next.js 15** - App Router with Server Components
- **React 19** - Latest React features
- **TypeScript 5** - Type safety

### UI Library
- **Fluent UI v9** - Microsoft's official design system
  - All components wrapped in `components/ui/`
  - Consistent enterprise UI/UX
  - Full accessibility support

### State Management
- **Zustand** - Lightweight state management
  - Auth store for user authentication
  - UI store for app state
  - Dashboard store for migration data

### HTTP & API
- **Custom HTTP Client** - Fetch API wrapper
  - Request/response interceptors
  - Error handling
  - Timeout management
  - Auth token management

### Testing
- **Vitest** - Unit testing framework
- **Testing Library** - Component testing

## Key Features

### Authentication System
- Email-based authentication
- Token management with localStorage
- Protected routes with middleware
- Auto-redirect on auth state change

### Migration Platform
1. **Migration Tab** - Configure Tableau migration
   - Site URL input
   - Project/Workbook selection
   - Start processing

2. **Monitoring Agent Tab** - Real-time monitoring
   - 6 agent workflow (Assessment → Parsing → Mapping → Data Layer → Generation → Validation)
   - Live log streaming
   - Progress tracking
   - Auto-switch on migration start

3. **Result Tab** - Comprehensive results with horizontal sub-tabs
   - Assessment: Workbooks, dashboards, complexity analysis
   - Parsing: Calculations, relationships, data sources
   - Mapping: Function mappings, conversion rules
   - Data Layer: Models, relationships, measures
   - Generation: Reports, dashboards, visuals
   - Validation: Data accuracy, issues, warnings

4. **Run History Tab** - Historical migrations
   - Previous runs with timestamps
   - Status tracking
   - Quick access to results

### Design System
- Color-coded metrics (blue, purple, green, orange)
- Consistent spacing and typography
- Responsive layouts
- Accessible components

## Development

### Running Tests
```bash
npm run test          # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### Building
```bash
npm run dev           # Development server
npm run build         # Production build
npm run start         # Production server
```

## Architecture Principles

1. **Feature-based structure** - Related code grouped together
2. **Service layer separation** - API calls abstracted from components
3. **Type safety** - Comprehensive TypeScript types
4. **Testability** - Unit tests for services and utilities
5. **Component reusability** - Fluent UI wrappers for consistency
6. **State management** - Zustand for predictable state updates

## Code Style

- **Components**: PascalCase (Button.tsx)
- **Hooks**: camelCase with 'use' prefix (useAuth.ts)
- **Services**: camelCase (auth.service.ts)
- **Types**: PascalCase interfaces (AuthUser)
- **Constants**: UPPER_SNAKE_CASE (API_ENDPOINTS)
```

```json file="" isHidden
