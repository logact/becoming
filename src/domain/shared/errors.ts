/** Thrown when a state transition or invariant of a domain model is violated. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}
