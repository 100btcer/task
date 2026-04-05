/**
 * Inline spinner; animation from `App.css` (`.app-spinner`) for reduced-motion support.
 */
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 20 : 36;
  const bw = size === 'sm' ? 2.5 : 3;
  return (
    <span
      className="app-spinner"
      role="progressbar"
      aria-label="Loading"
      style={{
        display: 'inline-block',
        width: dim,
        height: dim,
        borderWidth: bw,
        borderStyle: 'solid',
        borderColor: '#e2e8f0',
        borderTopColor: '#334155',
        borderRadius: '50%',
        verticalAlign: 'middle',
        flexShrink: 0,
      }}
    />
  );
}
