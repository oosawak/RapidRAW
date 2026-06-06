import { create } from 'zustand';

export interface CollabPoint {
  t: number;
  x: number;
  y: number;
}

export interface CollabStroke {
  color: string;
  points: CollabPoint[];
  source: 'local' | 'remote';
  stroke_id: string;
  timestamp: string;
  tool: 'brush';
  user_id: string;
  width: number;
}

interface CollabState {
  roomId: string;
  localUserId: string;
  strokes: CollabStroke[];
  connectionStatus: 'offline' | 'connecting' | 'online';
  localStrokeCount: number;
  remoteStrokeCount: number;
  setRoomId: (roomId: string) => void;
  setLocalUserId: (userId: string) => void;
  setConnectionStatus: (status: CollabState['connectionStatus']) => void;
  addLocalStroke: (stroke?: Partial<CollabStroke>) => void;
  addRemoteSampleStroke: () => void;
  clearStrokes: () => void;
}

const MAX_STROKES = 24;

const clampLog = (strokes: CollabStroke[]) => strokes.slice(-MAX_STROKES);

const createStrokeId = (prefix: string, seq: number) => prefix + '-' + Date.now() + '-' + seq;

const buildCounts = (strokes: CollabStroke[]) => ({
  localStrokeCount: strokes.filter((item) => item.source === 'local').length,
  remoteStrokeCount: strokes.filter((item) => item.source === 'remote').length,
});

export const useCollabStore = create<CollabState>((set) => ({
  roomId: 'studio-alpha',
  localUserId: 'me',
  strokes: [],
  connectionStatus: 'offline',
  localStrokeCount: 0,
  remoteStrokeCount: 0,

  setRoomId: (roomId) => set({ roomId }),
  setLocalUserId: (localUserId) => set({ localUserId }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  addLocalStroke: (stroke) =>
    set((state) => {
      const seq = state.strokes.length + 1;
      const nextStroke: CollabStroke = {
        color: stroke?.color ?? '#f08c46',
        points:
          stroke?.points ?? [
            { x: 84, y: 120, t: Date.now() },
            { x: 152, y: 88, t: Date.now() + 16 },
            { x: 228, y: 130, t: Date.now() + 32 },
          ],
        source: 'local',
        stroke_id: stroke?.stroke_id ?? createStrokeId('local', seq),
        timestamp: stroke?.timestamp ?? new Date().toISOString(),
        tool: 'brush',
        user_id: stroke?.user_id ?? state.localUserId,
        width: stroke?.width ?? 8,
      };

      const strokes = clampLog([...state.strokes, nextStroke]);
      return { strokes, ...buildCounts(strokes) };
    }),

  addRemoteSampleStroke: () =>
    set((state) => {
      const seq = state.strokes.length + 1;
      const nextStroke: CollabStroke = {
        color: '#74d6ff',
        points: [
          { x: 72, y: 196, t: Date.now() },
          { x: 144, y: 144, t: Date.now() + 16 },
          { x: 208, y: 178, t: Date.now() + 32 },
          { x: 286, y: 102, t: Date.now() + 48 },
        ],
        source: 'remote',
        stroke_id: createStrokeId('remote', seq),
        timestamp: new Date().toISOString(),
        tool: 'brush',
        user_id: 'remote-demo',
        width: 6,
      };

      const strokes = clampLog([...state.strokes, nextStroke]);
      return {
        strokes,
        connectionStatus: 'online',
        ...buildCounts(strokes),
      };
    }),

  clearStrokes: () =>
    set({
      strokes: [],
      localStrokeCount: 0,
      remoteStrokeCount: 0,
    }),
}));
