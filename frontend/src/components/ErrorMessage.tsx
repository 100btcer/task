import { MODAL_CLOSE_BUTTON_CLASS, modalCloseButtonStyle } from '../styles/modalClose';

interface ErrorMessageProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorMessage({ message, onDismiss }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      style={{
        padding: '0.75rem 1rem',
        background: '#fef2f2',
        color: '#b91c1c',
        borderRadius: '6px',
        marginBottom: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className={MODAL_CLOSE_BUTTON_CLASS}
          style={modalCloseButtonStyle}
        >
          ×
        </button>
      )}
    </div>
  );
}
