import { FLOW_MARK } from '@vire/design-tokens/marks';
// Иконки, специфичные для плеера — общие для мини-бара/фуллскрина/очереди.
import { Icon } from '@/components/icon';

export function ChevronDownIcon() {
  return <Icon name="chevron-down" size={20} />;
}

export function ExpandIcon() {
  return <Icon name="maximize-2" size={14} className="text-white" />;
}

export function VolumeIcon({ muted }: { muted: boolean }) {
  return <Icon name={muted ? 'volume-x' : 'volume-2'} size={16} className="opacity-50 shrink-0" />;
}

export function QueueIcon() {
  return <Icon name="list" size={15} />;
}

export function ErrorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
    </svg>
  );
}

export function SkipBackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="19,20 9,12 19,4" />
      <rect x="5" y="4" width="2" height="16" rx="1" />
    </svg>
  );
}

export function SkipForwardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="5,4 15,12 5,20" />
      <rect x="17" y="4" width="2" height="16" rx="1" />
    </svg>
  );
}

export function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" />
      <circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" />
      <circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" />
    </svg>
  );
}

export function RepeatIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

export function WaveIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={FLOW_MARK} />
    </svg>
  );
}
