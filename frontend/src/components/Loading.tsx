import { Spinner } from './Spinner';

type Props = {
  /** Shown next to / below the spinner */
  message?: string;
  /** Single-line row for banners and tight layouts */
  compact?: boolean;
};

export function Loading({ message = 'Loading…', compact }: Props) {
  if (compact) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.6rem',
          color: '#475569',
          fontSize: '0.9rem',
        }}
      >
        <Spinner size="sm" />
        {message}
      </span>
    );
  }
  return (
    <div
      style={{
        padding: '1.5rem',
        textAlign: 'center',
        color: '#475569',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.75rem',
      }}
    >
      <Spinner size="md" />
      <span>{message}</span>
    </div>
  );
}
