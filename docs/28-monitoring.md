# Monitoring Module

## Location
- `components/tabs/MonitoringTab.tsx`

## Functionality
The Monitoring Tab provides a real-time HUD (Heads Up Display) of the Semantic Kernel execution. 
It uses fluent UI progress bars (`ProgressBar`) and layout grids to render the states tracked in `stores/agent.store.ts`.

It updates automatically via the `setInterval` loop fetching `/api/monitoring-logs`. As agents complete, checkmarks appear. When an agent requires human-in-the-loop validation (e.g., Parsing or Mapping), this tab unlocks the respective sub-tab for the user to switch to.
