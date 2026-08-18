import type { Label } from '../Label';
import type { LabelId } from '../../shared/ids';

export interface LabelRepository {
  /** Upserts the label. */
  save(label: Label): Promise<void>;
  findById(id: LabelId): Promise<Label | null>;
  list(): Promise<Label[]>;
  delete(id: LabelId): Promise<void>;
}
