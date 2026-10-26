/** Hand a file the API made to the browser as a download. Nothing is kept: the temporary address is revoked at once. */
export function saveBlob(blob: Blob, filename: string): void {
  const address = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = address;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(address), 0);
}
