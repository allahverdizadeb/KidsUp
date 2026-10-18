import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';
import Brochure from './components/Brochure';
import Certificate from './components/Certificate';

// Vite serves `public/` at the site root, so the page URL `assets/x.png` is the file `public/assets/x.png`.
// A plain path, not `import.meta.url`: under jsdom that is not a `file:` URL.
const PUBLIC_DIRECTORY = resolve(import.meta.dirname, '../public');
const BROCHURE_PATH = 'assets/KidsUp-Brosura.pdf';
const CERTIFICATE_PATH = 'assets/sertifikat-full-name.png';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// A complete PNG ends with an empty IEND chunk (length, type, CRC). A download that hit a size cap does not.
const PNG_END = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
const JPEG_START = Buffer.from([0xff, 0xd8]);
const JPEG_END = Buffer.from([0xff, 0xd9]);

const readPublicFile = (path: string): Buffer => readFileSync(resolve(PUBLIC_DIRECTORY, path));

const listLocalAssetPaths = (): string[] => {
  const { container } = render(<App />);
  const urls = Array.from(
    container.querySelectorAll('[src], [href]'),
    (element) => element.getAttribute('src') ?? element.getAttribute('href') ?? '',
  );
  return [...new Set(urls.filter((url) => url.startsWith('assets/')))];
};

const isCompleteFile = (path: string): boolean => {
  const bytes = readPublicFile(path);
  if (path.endsWith('.png')) {
    return bytes.subarray(0, 8).equals(PNG_SIGNATURE) && bytes.subarray(-12).equals(PNG_END);
  }
  if (path.endsWith('.jpeg')) {
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
    const paths = listLocalAssetPaths();
    expect(paths).toContain(BROCHURE_PATH);
    expect(paths).toContain(CERTIFICATE_PATH);
    for (const path of paths) {
      expect(existsSync(resolve(PUBLIC_DIRECTORY, path)), `${path} is missing from public/`).toBe(true);
    }
  });

  it('ships them complete: no cut-off image and no empty download', () => {
    for (const path of listLocalAssetPaths()) {
      expect(isCompleteFile(path), `${path} is cut off or empty`).toBe(true);
    }
  });

  it('declares the certificate image at its real size so the layout does not shift while it loads', () => {
    render(<Certificate />);
    const image = screen.getByRole('img', { name: /sertifikatının nümunəsi$/ });
    const png = readPublicFile(CERTIFICATE_PATH);
    // PNG layout: 8-byte signature, then the IHDR chunk whose first two fields are width and height.
    expect(image).toHaveAttribute('width', String(png.readUInt32BE(16)));
    expect(image).toHaveAttribute('height', String(png.readUInt32BE(20)));
  });

  it('states the real page count and file size of the brochure it offers', () => {
    render(<Brochure />);
    const pdf = readPublicFile(BROCHURE_PATH);
    const pageCount = pdf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g)?.length ?? 0;
    const sizeInMegabytes = (pdf.length / 1_000_000).toFixed(1).replace('.', ',');
    expect(pageCount).toBeGreaterThan(0);
    expect(screen.getByText(new RegExp(`\\b${pageCount} səhifə`))).toBeInTheDocument();
    expect(screen.getByText(`PDF · ${sizeInMegabytes} MB`)).toBeInTheDocument();
  });

  it('keeps the brochure free of active content such as scripts and launch actions', () => {
    // Compressed streams can contain any byte sequence by chance; only the document structure is scanned.
    const structure = readPublicFile(BROCHURE_PATH)
      .toString('latin1')
      .replace(/stream\r?\n[\s\S]*?endstream/g, '');
    expect(structure).not.toMatch(/\/(JavaScript|JS|Launch|OpenAction|EmbeddedFile|RichMedia|XFA)\b/);
  });
});
