import type { CSSProperties } from 'react';

/** Use with `className` so `App.css` can style :hover without conflicting with global button filters. */
export const MODAL_CLOSE_BUTTON_CLASS = 'app-modal-close';

export const modalCloseButtonStyle: CSSProperties = {
  flexShrink: 0,
  width: '2rem',
  height: '2rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: 0,
  padding: 0,
  border: 'none',
  borderRadius: '8px',
  background: 'transparent',
  color: '#94a3b8',
  fontSize: '1.5rem',
  fontWeight: 300,
  lineHeight: 1,
  cursor: 'pointer',
};
