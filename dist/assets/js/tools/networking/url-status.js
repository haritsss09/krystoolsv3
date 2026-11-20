import { inspectionTool } from '../security/headers.js';

export function urlStatusTool(workspace) {
  return inspectionTool(workspace, 'status');
}
