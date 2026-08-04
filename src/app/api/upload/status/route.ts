// Durable two-phase upload status polled by the /upload client. The status
// logic lives in ../route.ts (GET) — this mount point is what the client
// actually polls at /api/upload/status?uploadId=... (previously missing, so
// every poll 404'd and surfaced as "Upload processing was lost").
export { GET } from '../route';