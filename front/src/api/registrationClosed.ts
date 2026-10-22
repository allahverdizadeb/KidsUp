/** The API refused an application because the course no longer takes them (closed, full, or none to choose). */
export class RegistrationClosedError extends Error {
  constructor() {
    super('Registration is closed.');
    this.name = 'RegistrationClosedError';
  }
}
