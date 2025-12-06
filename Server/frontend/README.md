# UITrace Frontend

Web dashboard for the UITrace platform - A comprehensive test automation and visual validation system.

## Features

- **Project Management**: Create and manage test automation projects
- **Script Editor**: Visual editor for creating and modifying test scripts
- **Execution Dashboard**: Real-time monitoring of test executions
- **User Authentication**: JWT-based authentication with OAuth support
- **Dark/Light Theme**: Toggle between dark and light modes
- **Responsive Design**: Mobile-friendly interface

## Technology Stack

- **Framework**: Nuxt.js 3 (Vue 3)
- **Styling**: Tailwind CSS
- **Icons**: Carbon Icons
- **Charts**: Chart.js with Vue-ChartJS
- **State Management**: Pinia
- **TypeScript**: Full TypeScript support
- **Authentication**: JWT with refresh tokens

## Getting Started

### Prerequisites

- Node.js 20.11.0 or higher
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd UITrace/Server/frontend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Project Structure

```
frontend/
├── assets/           # Static assets (CSS, images)
├── components/       # Vue components
├── composables/      # Composable functions
├── layouts/          # Layout components
├── middleware/       # Route middleware
├── pages/            # Page components
├── plugins/          # Nuxt plugins
├── stores/           # Pinia stores
├── types/            # TypeScript type definitions
├── utils/            # Utility functions
└── public/           # Public static files
```

## Key Components

### Pages

- `/` - Dashboard with overview of projects and recent executions
- `/projects` - List and manage projects
- `/scripts` - Create and edit test scripts
- `/executions` - View execution history and results
- `/login` - User authentication

### Components

- `ProjectCard` - Display project information in cards
- `ScriptEditor` - Visual editor for test scripts
- `ExecutionStatus` - Real-time execution status display
- `UserMenu` - User profile and logout menu
- `Modal` - Reusable modal component
- `ConfirmDialog` - Confirmation dialog for actions

## Authentication

The application uses JWT-based authentication with refresh tokens:

1. Users log in with email/password or OAuth providers
2. Access token is stored in cookie with 1-hour expiration
3. Refresh token is stored in cookie with 30-day expiration
4. Tokens are automatically refreshed in the background

## API Integration

The frontend communicates with the backend via RESTful API:

- Base URL configured via `API_BASE_URL` environment variable
- Authentication headers automatically added to requests
- Error handling for unauthorized responses
- Request/response interceptors for logging

## Theme System

- Dark/light mode toggle
- System preference detection
- Theme state persisted in localStorage
- All components support both themes

## Build and Deployment

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

### Generate Static Site

```bash
npm run generate
```

## Environment Variables

See `.env.example` for all available configuration options:

- `API_BASE_URL` - Backend API base URL
- `JWT_SECRET` - JWT signing secret
- OAuth provider credentials (optional)

## Contributing

1. Follow the existing code style and conventions
2. Use TypeScript for all new code
3. Add tests for new features
4. Ensure responsive design
5. Update documentation as needed

## License

This project is licensed under the MIT License.