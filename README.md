# Tableau to Microsoft Fabric Autonomous Migration Platform

A production-ready enterprise application for autonomous migration from Tableau to Microsoft Fabric, built with Next.js 15, TypeScript, and Fluent UI v9.

## 🚀 Tech Stack

- **Framework**: Next.js 15 (App Router) with React 19
- **UI Library**: Fluent UI v9 (Microsoft Design System) - **Exclusively**
- **State Management**: Zustand
- **Language**: TypeScript 5 (Strict Mode)
- **HTTP Client**: Custom Fetch-based client with interceptors
- **Testing**: Vitest + Testing Library
- **Styling**: Tailwind CSS v4

## 📁 Project Structure

```
tableau-fabric-migration/
│
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # Root layout with FluentProvider
│   ├── page.tsx                      # Landing page (auth redirect)
│   ├── globals.css                   # Global styles
│   │
│   ├── (auth)/
│   │   └── signin/
│   │       └── page.tsx              # Email authentication
│   │
│   └── (protected)/
│       ├── layout.tsx                # Protected layout
│       └── dashboard/
│           └── page.tsx              # Main dashboard
│
├── components/
│   ├── ui/                           # Fluent UI wrapper components
│   │   ├── Button.tsx                # Button wrapper
│   │   ├── Input.tsx                 # Input wrapper
│   │   ├── Card.tsx                  # Card components
│   │   ├── Table.tsx                 # Table components
│   │   ├── Accordion.tsx             # Accordion components
│   │   ├── Badge.tsx                 # Badge component
│   │   ├── Tabs.tsx                  # Tab components
│   │   ├── Dropdown.tsx              # Dropdown components
│   │   ├── Menu.tsx                  # Menu components
│   │   └── index.ts                  # Central exports
│   │
│   ├── layout/
│   │   ├── TopNavigation.tsx         # Top nav with user menu
│   │   └── LeftSidebar.tsx           # Stats sidebar
│   │
│   └── tabs/
│       ├── MigrationTab.tsx          # Workbook selection
│       ├── MonitoringTab.tsx         # Real-time logs
│       ├── ResultTab.tsx             # Agent results (horizontal tabs)
│       └── RunHistoryTab.tsx         # Historical runs
│
├── services/                         # Service layer
│   ├── http.client.ts                # HTTP client
│   ├── api.config.ts                 # API configuration
│   └── http.client.test.ts           # HTTP tests
│
├── features/                         # Feature modules
│   ├── auth/
│   │   ├── auth.service.ts           # Auth service
│   │   ├── auth.types.ts             # Auth types
│   │   └── auth.test.ts              # Auth tests
│   │
│   └── dashboard/
│       ├── dashboard.service.ts      # Dashboard service
│       ├── dashboard.types.ts        # Dashboard types
│       └── dashboard.test.ts         # Dashboard tests
│
├── stores/                           # Zustand stores
│   ├── store.types.ts                # Type definitions
│   ├── auth.store.ts                 # Auth state
│   ├── ui.store.ts                   # UI state
│   ├── dashboard.store.ts            # Migration state
│   └── index.ts                      # Store exports
│
├── hooks/
│   └── useAuth.ts                    # Auth hook
│
├── lib/
│   └── constants.ts                  # Constants
│
├── vitest.config.ts                  # Vitest configuration
├── vitest.setup.ts                   # Test setup
└── package.json
```

## ✨ Features

### 1. Authentication System
- **Email-based login** with localStorage persistence
- **Protected routes** with automatic redirects
- **User profile** with avatar and initials
- **Logout** from dropdown menu

### 2. Migration Tab
- Site selection dropdown
- Project selection (filtered by site)
- Multi-select workbook selection
- "Start Processing" button
- **Auto-switches to Monitoring tab** on start

### 3. Monitoring Agent Tab
- **Real-time log streaming**
- **6-Agent workflow tracking**:
  1. Assessment Agent
  2. Parsing Agent
  3. Mapping Agent
  4. Data Layer Agent
  5. Generation Agent
  6. Validation Agent
- Color-coded severity badges
- Auto-scroll to latest logs
- Timestamp and context for each log

### 4. Result Tab (Horizontal Sub-Tabs)
- **Dropdown selector** for completed workbooks
- **6 horizontal sub-tabs** for each agent:
  
  #### Assessment Tab
  - Total workbooks: 45
  - Dashboards: 12
  - Calculated fields: 28
  - LOD expressions: 12
  - Data sources: SQL Server, Snowflake, Excel, CSV
  - Extracts: 5 extracts, 2.40 GB, 6 parameters
  - Complexity analysis with score
  - Estimated effort hours

  #### Parsing Tab
  - Workbooks processed
  - Calculations extracted
  - Relationships identified
  - Datasources analyzed
  - Error count

  #### Mapping Tab
  - Total mappings
  - Direct mappings
  - Custom mappings
  - Unmapped functions
  - Conversion rules table

  #### Data Layer Tab
  - Models generated
  - Relationships created
  - Measures created
  - Tables created
  - Dataflows created

  #### Generation Tab
  - Reports generated
  - Dashboards created
  - Visuals created
  - Pages created
  - Generation status

  #### Validation Tab
  - Total checks: 52
  - Passed: 48
  - Failed: 2
  - Warnings: 2
  - Data accuracy percentage
  - Visual accuracy percentage
  - Issues list with severity badges

### 5. Run History Tab
- All previous migration runs
- Grouped by site/project
- Overall status indicators
- Expandable accordion with app details
- Timestamps for each run
- Latest runs first

### 6. Left Sidebar (Real-time Stats)
- **Total Selected**: Count
- **Running**: Active migrations
- **Success**: Completed migrations
- **Failed**: Failed migrations
- **Selected Applications** list with status

### 7. Top Navigation
- Settings icon (gear) - opens configuration dialog
- **User avatar dropdown** with:
  - User email
  - Logout option

## 🏗️ Architecture

### Service Layer Pattern
```typescript
// HTTP Client with interceptors
httpClient.get('/api/endpoint')
httpClient.post('/api/endpoint', data)
httpClient.setAuthToken(token)
```

### Feature Modules
```typescript
// Auth Service
authService.login(credentials)
authService.logout()
authService.verifyToken(token)

// Dashboard Service
dashboardService.startMigration(config)
dashboardService.getMigrationStatus(runId)
dashboardService.getMigrationResults(runId)
```

### State Management
```typescript
// Zustand stores
const { isAuthenticated, login, logout } = useAuthStore()
const { activeTab, setActiveTab } = useUIStore()
const { startProcessing, logs } = useDashboardStore()
```

### Fluent UI Components
```typescript
import { Button, Card, Badge } from '@/components/ui'

<Button appearance="primary">Click me</Button>
<Card><CardHeader>Title</CardHeader></Card>
<Badge appearance="filled" color="success">Active</Badge>
```

## 🚀 Getting Started

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
# Open http://localhost:3000
```

### Testing
```bash
npm run test              # Run tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

### Build
```bash
npm run build
npm run start
```

## 📖 Usage Flow

1. **Sign In**: Enter your email → Auto-redirected to dashboard
2. **Configure** (Optional): Click gear icon → Set Tableau connection
3. **Select Migration**:
   - Choose Site
   - Choose Project
   - Select Workbooks (multi-select)
4. **Start Processing**: Click "Start Processing"
5. **Monitor**: Auto-switches to Monitoring tab
   - Watch real-time logs
   - See agent progression
6. **View Results**: Click Result tab
   - Select workbook from dropdown
   - Navigate horizontal tabs for each agent
7. **Check History**: View past runs in Run History

## 🎨 Design System

### Fluent UI v9 Only
- All components from `@fluentui/react-components`
- No other UI libraries (shadcn/radix removed)
- Consistent Microsoft design language

### Color Palette
- **Blue**: `#0078D4` - Primary actions
- **Purple**: `#8B72CC` - Secondary metrics
- **Green**: `#107C10` - Success states
- **Orange**: `#D83B01` - Warning/LOD metrics

### Typography
- Font family: Segoe UI (system font)
- Consistent sizing and weights
- Proper hierarchy

## 🧪 Testing

### Unit Tests
```bash
# Auth service tests
npm run test -- auth.test.ts

# Dashboard service tests
npm run test -- dashboard.test.ts

# HTTP client tests
npm run test -- http.client.test.ts
```

### Coverage
```bash
npm run test:coverage
# Opens HTML report in coverage/index.html
```

## 🔒 Security

- **Token-based auth** with localStorage
- **Protected routes** via middleware
- **HTTP-only patterns** ready for production
- **Input validation** via TypeScript
- **Error boundaries** for graceful failures

## 📊 Agent Processing Flow

```
Start Processing
    ↓
Assessment Agent (2-4s)
    ↓
Parsing Agent (2-4s)
    ↓
Mapping Agent (2-4s)
    ↓
Data Layer Agent (2-4s)
    ↓
Generation Agent (2-4s)
    ↓
Validation Agent (2-4s)
    ↓
Results Generated → Success State
    ↓
Saved to Run History
```

## 📝 API Configuration

Update environment variables (if using real backend):
```env
QLIK_URL=https://qlik.example.com
TABLEAU_API_URL=https://api.example.com
API_BASE_URL=https://api.example.com/api
```

Current setup uses simulated processing with mock data.

## 🤝 Contributing

This is an enterprise migration platform. Follow these guidelines:
- Use TypeScript strict mode
- Write tests for new features
- Follow existing folder structure
- Use Fluent UI components only
- Document complex logic

## 📄 License

Proprietary - Enterprise Use Only

---

**Built with ❤️ using Next.js 15, Fluent UI v9, and TypeScript**
