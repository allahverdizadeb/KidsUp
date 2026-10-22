type BoldTextProps = { text: string };

/** Text in which "**double stars**" mark bold words (React escapes everything: no markup is ever interpreted). */
export default function BoldText({ text }: BoldTextProps) {
  return (
    <>
      {text.split('**').map((part, index) =>
        index % 2 ? (
          <b key={index} style={{ color: '#1A1A1A' }}>
            {part}
          </b>
        ) : (
          part
        ),
      )}
    </>
  );
}
