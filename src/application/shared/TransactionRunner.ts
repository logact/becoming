/** Application port for atomic multi-repository work. */
export interface TransactionRunner {
  run<T>(work: () => Promise<T>): Promise<T>;
}
