import type { LabelId } from '../shared/ids';

/** A classification tag shared by goals, tasks, ideas, projects, resources and notes. */
export class Label {
  private constructor(
    /** Unique identifier of the label. */
    readonly id: LabelId,
    /** Display name of the label. */
    private _name: string,
    /** Optional display color (e.g. a hex value like '#ff8800'). */
    readonly color: string | undefined,
  ) {}

  static create(params: { id: LabelId; name: string; color?: string }): Label {
    return new Label(params.id, params.name, params.color);
  }

  get name(): string {
    return this._name;
  }

  rename(name: string): void {
    this._name = name;
  }
}
