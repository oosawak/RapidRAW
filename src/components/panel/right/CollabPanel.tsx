import { useMemo } from 'react';
import { CircleSlash2, MessageSquareMore, SignalHigh, User } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import Button from '../../ui/Button';
import Text from '../../ui/Text';
import { TextColors, TextVariants } from '../../../types/typography';
import { useCollabStore } from '../../../store/useCollabStore';

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-surface bg-surface/50 p-3">
      <Text variant={TextVariants.label} color={TextColors.Secondary} className="mb-1">
        {label}
      </Text>
      <Text variant={TextVariants.body} className="font-semibold">
        {value}
      </Text>
    </div>
  );
}

export default function CollabPanel() {
  const {
    roomId,
    localUserId,
    strokes,
    connectionStatus,
    localStrokeCount,
    remoteStrokeCount,
    setLocalUserId,
    addLocalStroke,
    addRemoteSampleStroke,
    clearStrokes,
  } = useCollabStore(
    useShallow((state) => ({
      roomId: state.roomId,
      localUserId: state.localUserId,
      strokes: state.strokes,
      connectionStatus: state.connectionStatus,
      localStrokeCount: state.localStrokeCount,
      remoteStrokeCount: state.remoteStrokeCount,
      setLocalUserId: state.setLocalUserId,
      addLocalStroke: state.addLocalStroke,
      addRemoteSampleStroke: state.addRemoteSampleStroke,
      clearStrokes: state.clearStrokes,
    })),
  );

  const recentFeed = useMemo(
    () =>
      strokes
        .slice(-5)
        .reverse()
        .map((stroke) => ({
          id: stroke.stroke_id,
          user: stroke.user_id,
          source: stroke.source,
          points: stroke.points.length,
          timestamp: stroke.timestamp,
        })),
    [strokes],
  );

  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Text variant={TextVariants.heading} className="mb-1">
            Collaboration
          </Text>
          <Text variant={TextVariants.body} color={TextColors.Secondary}>
            Shared stroke log for local and remote drawing.
          </Text>
        </div>
        <div className="flex items-center gap-2 rounded-md bg-surface px-3 py-2 text-sm text-text-secondary">
          <SignalHigh size={14} />
          {connectionStatus}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Room" value={roomId} />
        <StatCard label="User" value={localUserId} />
        <StatCard label="Local strokes" value={String(localStrokeCount)} />
        <StatCard label="Remote strokes" value={String(remoteStrokeCount)} />
      </div>

      <label className="grid gap-2">
        <Text variant={TextVariants.label} color={TextColors.Secondary}>
          Local user id
        </Text>
        <input
          className="rounded-md border border-surface bg-bg-primary px-3 py-2 text-text-primary outline-none transition focus:border-accent"
          onChange={(event) => setLocalUserId(event.target.value)}
          placeholder="me"
          value={localUserId}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => addLocalStroke()} className="bg-accent">
          <MessageSquareMore size={16} />
          Add Local Stroke
        </Button>
        <Button onClick={addRemoteSampleStroke} className="bg-surface">
          <User size={16} />
          Add Remote Sample
        </Button>
        <Button onClick={clearStrokes} className="bg-surface">
          <CircleSlash2 size={16} />
          Clear Log
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-md border border-surface bg-bg-primary/70 p-3">
        <Text variant={TextVariants.label} color={TextColors.Secondary} className="mb-2">
          Recent feed
        </Text>
        <div className="min-h-0 flex-1 overflow-auto rounded-md bg-surface/40 p-3 font-mono text-[11px] leading-5 text-text-secondary">
          {recentFeed.length === 0 ? (
            <p>No strokes yet. Use the buttons above to create a local or remote sample stroke.</p>
          ) : (
            recentFeed.map((item) => (
              <pre key={item.id} className="mb-3 whitespace-pre-wrap last:mb-0">
                {JSON.stringify(item, null, 2)}
              </pre>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
