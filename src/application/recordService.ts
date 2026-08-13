import { newId, nowIso } from '../domain/ids';
import type { EntityId, IsoTimestamp } from '../domain/ids';
import { createRecord } from '../domain/record';
import type { Record } from '../domain/record';
import type {
  RecordHistoryRepository,
  RecordListOptions,
} from '../persistence/recordRepository';

/**
 * Application boundary for creating and retrieving Records.
 *
 * The service depends only on framework-neutral ports — a `Clock`, an
 * `IdGenerator`, and the `RecordRepository` persistence boundary — so the
 * same create/read behavior runs under any UI, HTTP, or serialization
 * framework (or none at all). All domain validation runs before persistence;
 * invalid commands throw domain errors and never reach the repository.
 */

/** Supplies the current time; injectable for deterministic behavior. */
export interface Clock {
  now(): IsoTimestamp;
}

/** Supplies globally unique entity ids. */
export interface IdGenerator {
  newId(): EntityId;
}

/** Default ports backed by the platform clock and UUID generation. */
export const systemClock: Clock = { now: nowIso };
export const uuidGenerator: IdGenerator = { newId };

/** Thrown when a Record is requested by an id that does not exist. */
export class RecordNotFoundError extends Error {
  constructor(id: EntityId) {
    super(`Record ${id} not found`);
    this.name = 'RecordNotFoundError';
  }
}

/**
 * Command for recording an occurrence. `recordedAt` defaults to the clock's
 * current time (the moment of entry); `occurredAt` is always explicit because
 * when something happened is domain knowledge the caller must supply.
 */
export interface CreateRecordCommand {
  description: string;
  recordType: string;
  occurredAt: IsoTimestamp;
  recordedAt?: IsoTimestamp;
  title?: string;
  actor?: string;
  payload?: unknown;
}

export interface RecordServicePorts {
  repository: RecordHistoryRepository;
  clock?: Clock;
  ids?: IdGenerator;
  /** Extends or replaces the default record-type policy. */
  supportedRecordTypes?: readonly string[];
}

export class RecordService {
  private readonly repository: RecordHistoryRepository;
  private readonly clock: Clock;
  private readonly ids: IdGenerator;
  private readonly supportedRecordTypes?: readonly string[];

  constructor(ports: RecordServicePorts) {
    this.repository = ports.repository;
    this.clock = ports.clock ?? systemClock;
    this.ids = ports.ids ?? uuidGenerator;
    this.supportedRecordTypes = ports.supportedRecordTypes;
  }

  /** Validate and persist a new Record, returning the stored aggregate. */
  async createRecord(command: CreateRecordCommand): Promise<Record> {
    const record = createRecord(
      {
        description: command.description,
        recordType: command.recordType,
        occurredAt: command.occurredAt,
        recordedAt: command.recordedAt ?? this.clock.now(),
        title: command.title,
        actor: command.actor,
        payload: command.payload,
      },
      {
        id: this.ids.newId(),
        now: this.clock.now(),
        supportedRecordTypes: this.supportedRecordTypes,
      },
    );
    await this.repository.add(record);
    return record;
  }

  /** Return the Record with this id, or throw `RecordNotFoundError`. */
  async getRecord(id: EntityId): Promise<Record> {
    const record = await this.repository.getById(id);
    if (record === null) {
      throw new RecordNotFoundError(id);
    }
    return record;
  }

  /** Active Records by default; explicit filters preserve independent time axes. */
  async listRecords(options?: RecordListOptions): Promise<Record[]> {
    return this.repository.list(options);
  }

  /** Authorized history view: include archived Records unless the caller narrows it. */
  async listRecordHistory(
    options?: Omit<RecordListOptions, 'status'>,
  ): Promise<Record[]> {
    return this.repository.list({ ...options, status: 'all' });
  }
}
