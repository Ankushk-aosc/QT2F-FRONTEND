# Deployment Architecture

## Current State
This repository contains a standard Next.js 15 application. 

## Deployment Target
Because it relies heavily on Next.js API Routes (Serverless Functions) to act as a Backend-For-Frontend (BFF), the ideal deployment targets are:
1. **Vercel:** Native support for App Router and Serverless API functions.
2. **Azure Static Web Apps (with managed Functions):** Since the stack leans heavily into Microsoft (Fluent UI, MSAL, Fabric), Azure is a logical enterprise target.
3. **Docker / Azure App Service:** Running as a standalone Node.js server. (See [38-docker.md](38-docker.md)).

## Build Process
To deploy this application:
1. `npm install`
2. `npm run build` (Compiles React components, bundles BFF routes).
3. `npm run start` (Runs the Node.js server to serve the frontend and proxy the APIs).
