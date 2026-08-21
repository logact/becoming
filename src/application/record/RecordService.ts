import { RecordRepository } from "../../domain/record/repository/RecordRepository";
import { Record, RecordTargetType } from "../../domain/record/Record";

export class RecordService {
    constructor(private readonly records: RecordRepository) {} 


    async listRecent(limit: number,scope: string): Promise<Record[]> {  
        return await this.records.listByTarget(scope as RecordTargetType,limit,undefined);
    }
}