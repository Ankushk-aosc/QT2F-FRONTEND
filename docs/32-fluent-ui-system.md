# Fluent UI System

## Location
- `components/ui/*`
- `layout.tsx`

## Functionality
The entire application UI uses **Fluent UI React v9**. 
The repository wraps almost every Fluent UI component inside `components/ui/` (e.g., `ui/Button.tsx`, `ui/Card.tsx`) to enforce standard styles, margins, and icons rather than using raw Fluent UI components in the tabs directly.

The `FluentProvider` is injected at the root `layout.tsx` level, applying the `webLightTheme` globally.
