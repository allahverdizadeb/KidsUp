type Props = {
  id: string;
  message: string;
};

/** The red "!" badge and message under an invalid field. The message is text, never colour alone (WCAG 1.4.1). */
export default function FieldError({ id, message }: Props) {
  return (
    <div
      id={id}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        fontSize: '14px',
        lineHeight: '1.4',
        fontWeight: '700',
        color: '#B00060',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flexShrink: '0',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          background: '#B00060',
          color: '#FFFFFF',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        !
      </span>
      {message}
    </div>
  );
}
