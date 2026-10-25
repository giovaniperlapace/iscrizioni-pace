export type RelayRoomStatistics = {
  panelId: string;
  title: string;
  room: string | null;
  capacity: number | null;
  entered: number;
};
export function parseRelayRoomStatistics(value: unknown): RelayRoomStatistics[] | null {
  if (!Array.isArray(value) || !value.every(x => x && typeof x.panelId === "string" && typeof x.title === "string"
    && (x.room === null || typeof x.room === "string")
    && (x.capacity === null || Number.isSafeInteger(x.capacity) && x.capacity >= 0)
    && Number.isSafeInteger(x.entered) && x.entered >= 0)) return null;
  if (new Set(value.map(x => x.panelId)).size !== value.length) return null;
  return value.map(({panelId,title,room,capacity,entered}) => ({panelId,title,room,capacity,entered}));
}
