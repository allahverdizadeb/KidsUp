import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';
import Brochure from './components/Brochure';
import Certificate from './components/Certificate';

// Vite serves `public/` at the site root, so the page URL `/assets/x.png` is the file `public/assets/x.png`.
// A plain path, not `import.meta.url`: under jsdom that is not a `file:` URL.
const PUBLIC_DIRECTORY = resolve(import.meta.dirname, '../public');
const BROCHURE_PATH = 'assets/KidsUp-Brosura.pdf';
const CERTIFICATE_PATH = 'assets/sertifikat-full-name.png';

// Everything under public/ is handed to the whole world as it is. This list is the review: a file that is new, changed
// or gone fails the test until a person has looked at it (no personal data of a child or a parent, no script, no
// metadata that names someone) and has recorded its fingerprint here. Compute one with `Get-FileHash -Algorithm SHA256`.
const REVIEWED_PUBLIC_FILES: Record<string, string> = {
  'assets/KidsUp-Brosura.pdf': '472a465b395baee8def2747bc079c2777284e54a77b28e164141572fe61818a7',
  'assets/babek.jpeg': 'fa2b0108c45218629391a823168de60c4641f6a44fe07a789694ca3339f28394',
  'assets/sertifikat-full-name.png': '2ee9538ccef3254e58d682cc750f0b333a3c489a91fbb66a5d1a5de17ddacc73',
  'assets/wharton-sertifikat.png': '7ed04a63b6ea9df959ee08a9d045bb33ce9a81a9a5f3717ac8e19d7dba83e173',
  'favicon.svg': '017fb2240443ca85654c3a7e66a4e530b8a0c93ed3251923865323d7a9c3fcf7',
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// A complete PNG ends with an empty IEND chunk (length, type, CRC). A download that hit a size cap does not.
const PNG_END = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
const JPEG_START = Buffer.from([0xff, 0xd8]);
const JPEG_END = Buffer.from([0xff, 0xd9]);
// JPEG segments that hold EXIF or XMP (APP1), Photoshop/IPTC captions (APP13) and free-text comments (COM).
const JPEG_PERSONAL_SEGMENTS = [0xe1, 0xed, 0xfe];
const OBJECT_STREAMS_MESSAGE =
  'the PDF uses compressed object streams: inflate them (node:zlib) before counting pages or scanning it';

const readPublicFile = (path: string): Buffer => readFileSync(resolve(PUBLIC_DIRECTORY, path));

/** Every file under public/, as the path the site serves it at (without the leading slash). */
const listPublicFiles = (directory = PUBLIC_DIRECTORY): string[] =>
  readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? listPublicFiles(resolve(directory, entry.name))
        : [relative(PUBLIC_DIRECTORY, resolve(directory, entry.name)).replaceAll('\\', '/')],
    )
    .sort();

// The page is rendered once, however many tests ask: the list of files it links to and displays.
let localAssetUrls: string[] | undefined;
const listLocalAssetUrls = (): string[] => {
  if (localAssetUrls) return localAssetUrls;
  const { container, unmount } = render(<App />);
  const urls = Array.from(
    container.querySelectorAll('[src], [href]'),
    (element) => element.getAttribute('src') ?? element.getAttribute('href') ?? '',
  );
  unmount();
  localAssetUrls = [...new Set(urls.filter((url) => /^\/?assets\//.test(url)))];
  return localAssetUrls;
};

// The file under `public/` that a page URL such as `/assets/x.png` points to.
const toPublicPath = (url: string): string => url.replace(/^\//, '');

/** The chunk types of a PNG, in file order: 4 bytes of length, 4 of type, the data, 4 of CRC, from byte 8. */
const readPngChunkTypes = (bytes: Buffer): string[] => {
  const types: string[] = [];
  for (let offset = 8; offset + 8 <= bytes.length;) {
    types.push(bytes.toString('latin1', offset + 4, offset + 8));
    offset += 12 + bytes.readUInt32BE(offset);
  }
  return types;
};

/** The marker byte of every JPEG segment before the image data starts (APP0 is 0xE0, APP1 0xE1, comment 0xFE ...). */
const readJpegSegmentTypes = (bytes: Buffer): number[] => {
  const types: number[] = [];
  let offset = 2; // after the start-of-image marker
  while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
    const type = bytes[offset + 1];
    if (type === 0xda) break; // start of scan: entropy-coded image data follows
    types.push(type);
    offset += 2 + bytes.readUInt16BE(offset + 2);
  }
  return types;
};

/** Turns the `#41` escapes PDF allows inside names back into letters, so `/J#61vaScript` reads as `/JavaScript`. */
const decodeNameEscapes = (pdfStructure: string): string =>
  pdfStructure.replace(/#([0-9a-fA-F]{2})/g, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );

const ACTIVE_PDF_CONTENT =
  /\/(JavaScript|JS|Launch|OpenAction|AA|AcroForm|SubmitForm|GoToR|EmbeddedFile|RichMedia|XFA|URI|Encrypt)\b/;

/**
 * The first keyword of active content in a PDF's structure, if any. Compressed streams are not scanned: they can
 * contain any byte sequence by chance.
 */
const findActiveContent = (pdfText: string): string | undefined =>
  decodeNameEscapes(pdfText.replace(/stream\r?\n[\s\S]*?endstream/g, '')).match(ACTIVE_PDF_CONTENT)?.[0];

const isCompleteFile = (path: string): boolean => {
  const bytes = readPublicFile(path);
  if (path.endsWith('.png')) {
    return bytes.subarray(0, 8).equals(PNG_SIGNATURE) && bytes.subarray(-12).equals(PNG_END);
  }
  if (/\.jpe?g$/.test(path)) {
    return bytes.subarray(0, 2).equals(JPEG_START) && bytes.subarray(-2).equals(JPEG_END);
  }
  if (path.endsWith('.pdf')) {
    return (
      bytes.subarray(0, 5).toString('latin1') === '%PDF-' &&
      bytes.subarray(-1024).toString('latin1').includes('%%EOF')
    );
  }
  return bytes.length > 0;
};

describe('public assets', () => {
  it('ships every local file the page links to or displays', () => {
    const paths = listLocalAssetUrls().map(toPublicPath);
    expect(paths).toContain(BROCHURE_PATH);
    expect(paths).toContain(CERTIFICATE_PATH);
    for (const path of paths) {
      expect(existsSync(resolve(PUBLIC_DIRECTORY, path)), `${path} is missing from public/`).toBe(true);
    }
  });

  it('ships every referenced file complete: no cut-off image and no empty download', () => {
    for (const path of listLocalAssetUrls().map(toPublicPath)) {
      expect(isCompleteFile(path), `${path} is cut off or empty`).toBe(true);
    }
  });

  it('refers to local files with root-absolute URLs, so they also load when the page is opened on a deep path', () => {
    // On `/x/`, a relative `assets/a.pdf` would be requested as `/x/assets/a.pdf`, which nginx answers with the
    // page itself (and `download` would then save HTML under a .pdf name).
    expect(listLocalAssetUrls().filter((url) => !url.startsWith('/assets/'))).toEqual([]);
  });

  it('declares the certificate image at its real size so the layout does not shift while it loads', () => {
    render(<Certificate />);
    const image = screen.getByRole('img', { name: /sertifikatının nümunəsi$/ });
    const certificateBytes = readPublicFile(CERTIFICATE_PATH);
    // PNG layout: 8-byte signature, then the IHDR chunk whose first two fields are width and height.
    expect(image).toHaveAttribute('width', String(certificateBytes.readUInt32BE(16)));
    expect(image).toHaveAttribute('height', String(certificateBytes.readUInt32BE(20)));
  });

  it('states the real page count and file size of the brochure it offers', () => {
    render(<Brochure />);
    const brochureBytes = readPublicFile(BROCHURE_PATH);
    const brochureText = brochureBytes.toString('latin1');
    expect(brochureText, OBJECT_STREAMS_MESSAGE).not.toMatch(/\/ObjStm\b/);
    const pageCount = brochureText.match(/\/Type\s*\/Page(?![s\w])/g)?.length ?? 0;
    const sizeInMegabytes = (brochureBytes.length / 1_000_000).toFixed(1).replace('.', ',');
    expect(pageCount).toBeGreaterThan(0);
    expect(screen.getByText(new RegExp(`\\b${pageCount} səhifə`))).toBeInTheDocument();
    expect(screen.getByText(`PDF · ${sizeInMegabytes} MB`)).toBeInTheDocument();
  });
});

describe('everything served from public/ (SEC-F-17)', () => {
  it('is a file a person has reviewed: nothing new or changed slips in', () => {
    const served = Object.fromEntries(
      listPublicFiles().map((path) => [
        path,
        createHash('sha256').update(readPublicFile(path)).digest('hex'),
      ]),
    );
    expect(
      served,
      'A file under public/ is new, changed or gone. Review it for personal data, scripts and metadata, then record its SHA-256 in REVIEWED_PUBLIC_FILES.',
    ).toEqual(REVIEWED_PUBLIC_FILES);
  });

  it('is an image or a PDF: no page, script or style that could run on this origin', () => {
    for (const path of listPublicFiles()) {
      expect(path, `${path} is not an image or a PDF`).toMatch(/\.(svg|png|jpe?g|pdf)$/);
    }
  });

  it('has no script, event handler or outside reference in any SVG', () => {
    const svgs = listPublicFiles().filter((path) => path.endsWith('.svg'));
    expect(svgs.length).toBeGreaterThan(0);
    for (const path of svgs) {
      const svg = readPublicFile(path).toString('utf8');
      expect(svg, `${path} has active content`).not.toMatch(
        /<script|<foreignObject|<iframe|<object|<embed|javascript:/i,
      );
      expect(svg, `${path} has an event handler`).not.toMatch(/\son[a-z]+\s*=/i);
      expect(svg, `${path} points outside itself`).not.toMatch(/(?:href|src)\s*=\s*["'](?!#)/i);
    }
  });

  it('carries no metadata that could identify a person: text chunks, EXIF, XMP, IPTC, comments, PDF author fields', () => {
    // A C2PA provenance box (which tool made the image) is allowed: it names no person. The reviewed hashes above
    // record that a person looked at it.
    const textChunks = ['tEXt', 'iTXt', 'zTXt', 'eXIf'];
    for (const path of listPublicFiles()) {
      const bytes = readPublicFile(path);
      if (path.endsWith('.png')) {
        for (const chunk of textChunks) {
          expect(readPngChunkTypes(bytes), `${path} has a ${chunk} chunk`).not.toContain(chunk);
        }
      }
      if (/\.jpe?g$/.test(path)) {
        const segments = readJpegSegmentTypes(bytes);
        expect(segments.length, `${path} could not be read as a JPEG`).toBeGreaterThan(0);
        for (const personal of JPEG_PERSONAL_SEGMENTS) {
          expect(
            segments,
            `${path} has the JPEG segment 0xFF${personal.toString(16).toUpperCase()}`,
          ).not.toContain(personal);
        }
      }
      if (path.endsWith('.pdf')) {
        const pdfText = bytes.toString('latin1');
        expect(pdfText, `${path} has author, tool or XMP fields`).not.toMatch(
          /\/(Author|Creator|Producer|Title|Subject|Keywords|Metadata)\b/,
        );
      }
    }
  });

  // A tripwire for accidental active content from an authoring tool, not a malware scan.
  it('keeps every PDF free of scripts, launch actions, links, forms, attachments and encryption', () => {
    const pdfs = listPublicFiles().filter((path) => path.endsWith('.pdf'));
    expect(pdfs.length).toBeGreaterThan(0);
    for (const path of pdfs) {
      const pdfText = readPublicFile(path).toString('latin1');
      expect(pdfText, OBJECT_STREAMS_MESSAGE).not.toMatch(/\/ObjStm\b/);
      expect(findActiveContent(pdfText), `${path} has active content`).toBeUndefined();
    }
  });

  it('finds active content in a PDF even when its name is spelled with escapes', () => {
    // `#61` is "a": the escaped spelling is the same name to a PDF reader.
    expect(findActiveContent('<< /J#61vaScript 5 0 R >>')).toBe('/JavaScript');
    expect(findActiveContent('<< /Open#41ction 5 0 R >>')).toBe('/OpenAction');
    expect(findActiveContent('<< /Type /Page >>')).toBeUndefined();
  });

  it('does not look inside compressed streams, whose bytes can spell anything by chance', () => {
    expect(findActiveContent('stream\n/JavaScript /URI\nendstream')).toBeUndefined();
  });

  it('reads the segments of a JPEG up to its image data', () => {
    const jpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, 0xff, 0xfe, 0x00, 0x03, 0x41, 0xff, 0xda, 0x00, 0x02,
    ]);
    expect(readJpegSegmentTypes(jpeg)).toEqual([0xe0, 0xfe]);
  });
});
