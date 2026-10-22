type RegistrationClosedProps = { message: string; whatsappUrl: string; linkLabel: string };

/** Takes the place of the form while no course takes applications. It never carries any detail of a family. */
export default function RegistrationClosed({ message, whatsappUrl, linkLabel }: RegistrationClosedProps) {
  return (
    <div
      data-reveal="1"
      role="status"
      style={{
        margin: '0',
        border: '2px solid #1A1A1A',
        borderRadius: '6px',
        padding: 'clamp(20px,3.5vw,44px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '22px',
      }}
    >
      <div style={{ fontWeight: '800', fontSize: '22px', letterSpacing: '-0.01em' }}>Müraciət forması</div>
      <div style={{ fontSize: '17px', lineHeight: '1.6', color: '#4A4A4A' }}>{message}</div>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          alignSelf: 'flex-start',
          display: 'flex',
          alignItems: 'center',
          minHeight: '48px',
          padding: '0 20px',
          borderRadius: '6px',
          background: '#1A1A1A',
          color: '#FFFFFF',
          fontWeight: '800',
          fontSize: '16px',
        }}
        className="hv-11"
      >
        {linkLabel}
      </a>
    </div>
  );
}
