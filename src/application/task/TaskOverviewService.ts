import { LabelRepository } from "../../domain/label/repository/LabelRepository";
import { ProjectRepository } from "../../domain/project/repository/ProjectRepository";
import { LabelId } from "../../domain/shared/ids";
import { TaskRepository } from "../../domain/task/repository/TaskRepository";
import { Task, TaskStatus } from "../../domain/task/Task";
import { RecordRepository } from "../../domain/record/repository/RecordRepository";
import { Record as RecordDomain } from "../../domain/record/Record";
import { RECENT_ACTIVITY_LIMIT, TASK_DUE_WINDOW_MS } from "../dashboard/DashboardService";


export interface TaskListItem {
    id: string;
    title: string;
    status: string;
    projectName: string;
    due?: Date;
    labelIds: string[];
}


function toListItem(task: Task,projectName: string): TaskListItem {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    projectName,
    labelIds: [...task.labelIds],
    ...(task.due === undefined ? {} : { due: task.due }),
  };
}


export interface TaskAttentionItem {
    id: string;
    title: string;
    projectName: string;
    /**
    failed 在前，然后 overdue，
    再 dueSoon（`isDueImminent(TASK_DUE_WINDOW_MS, now) && !isOverdue(now)`，
    复用 `DashboardService` 的 
    */
    reason: 'failed' | 'overdue' | 'dueSoon';
    due?: Date;
}

export interface ActivityItem {
    id: string;
    kind: string;
    detail?: string;
    occurredAt: Date;
}

function toActivityItem(record: RecordDomain): any {
    return {
        id:record.id,
        kind:record.kind,
        ...(record.detail === undefined ? {} : { detail: record.detail }),
        occurredAt: record.occurredAt,
    }
}

type TaskStatusInStats = TaskStatus | 'overdue';


export interface LabelGoalCount {
    labelId: LabelId;
    /** 
     * Resolved label name;
     *  falls back to the id when the label is unknown. 
     * 
     */
    name: string;
    count: number;
}
interface TasksStats {
    doing: number;
    todo: number;
    done: number;
    overdue: number;
}


export interface TasksOverviewView {
    stats: Record<TaskStatusInStats,number>;
    attention: TaskAttentionItem[];
    doingNow: TaskListItem[];
    byStatus: Record<TaskStatus, number>;
    byLabel: LabelGoalCount[];
    allTasks: Record<TaskStatus, TaskListItem[]>;
    /**
     * ：`records.listRecent` 取较大条数后按 `kind.startsWith('task')` 过滤，
     * 截 `RECENT_ACTIVITY_LIMIT`。
     * **有意的简化**：不做 relation 维度的「全部任务活动」查询（需要仓储 join），
     * kind 前缀过滤足够且与 kind 词汇约定一致。
     * 
     */
    recentActivity: ActivityItem[];
}




/**
 * TODO supplement the test cases
 */
export class TaskOverviewService {
    projectId2Name: Record<string, string> = {};
    constructor(
        private readonly taskRespository: TaskRepository,
        private readonly projectRepository: ProjectRepository,
        private readonly labelRepository: LabelRepository,
        private readonly recordRepository: RecordRepository,
    ) { }

    async getOverview(): Promise<TasksOverviewView> {
        let now = new Date()
        this.projectId2Name = await this.projectRepository.list().then(projects => {
            const map: Record<string, string> = {};
            for (const project of projects) {
                map[project.id] = project.name;
            }
            return map;
        });
        const all = await this.taskRespository.list();
        const allTasks = this.groupByStatus(all);
        const stats = this.getStats(all);
        const attention = this.getAttention(all, now);
        const doingNow = this.getDoingNow(all, now);
        const byStatus = this.countByStatus(all);
        const byLabel = await this.countByLabel(all);
     

        const recentActivity = await this.getRecentActivity(all);
        return {
            allTasks,
            attention,
            doingNow,
            byStatus,
            byLabel,
            recentActivity,
            stats,
        }

    }
    groupByStatus(all: Task[]): Record<TaskStatus, TaskListItem[]> {
        const grouped: Record<TaskStatus, TaskListItem[]> = {
            "todo": [],
            "doing": [],
            "done": [],
            "paused": [],
            "failed": [],  
        }
        for (const task of all) {
            grouped[task.status].push(toListItem(task,this.projectId2Name[task.projectId] || task.projectId));
        }
        return grouped;
        
    }

    getStats(all: Task[]): Record<TaskStatusInStats, number> {
        const stats: Record<TaskStatusInStats, number> = {  
            "todo": 0,
            "doing": 0,
            "done": 0,
            "paused": 0,
            "failed": 0,  
            "overdue": 0,
        }
        for (const task of all) { 
            stats[task.status]++;
            if (task.isOverdue(new Date())) {
                stats["overdue"]++;
            }  
        }
          
        return stats;   
    }
    async getRecentActivity(all: Task[]): Promise<ActivityItem[]> {
        const recentRecords = await this.recordRepository.listRecent(100);
        return recentRecords
            .filter(record => record.kind.startsWith('task'))
            .slice(0, RECENT_ACTIVITY_LIMIT)
            .map(record => toActivityItem(record));
    }

  
    async countByLabel(all: Task[]): Promise<LabelGoalCount[]> {
        const labelCountMap = new Map<LabelId, number>();
        for (const task of all) {
            for (const labelId of task.labelIds) {
                labelCountMap.set(labelId, (labelCountMap.get(labelId) || 0) + 1);
            }
        }

        const labelId2Name = await this.labelRepository.list().then(labels => {
            const map: Record<LabelId, string> = {};
            for (const label of labels) {
                map[label.id] = label.name;
            }
            return map;
        });

        const labelCounts: LabelGoalCount[] = [];
        for (const [labelId, count] of labelCountMap.entries()) {
            const label = this.labelRepository.findById(labelId);
            const name = labelId2Name[labelId];
            labelCounts.push({ labelId, name, count });
        }
    
        return labelCounts; 
    }
    countByStatus(all: Task[]): Record<TaskStatus, number> {
        const counts: Record<TaskStatus, number> = {
            "todo": 0,
            "doing": 0,
            "done": 0,
            "paused": 0,
            "failed": 0,  
        }
        for (const task of all) {
            counts[task.status]++;
        }
        return counts;
    }
    getDoingNow(all: Task[], now: Date): TaskListItem[] {
        const result: TaskListItem[] = [];
        for (const task of all) {
            if (task.status === 'doing') {
                result.push(toListItem(task,this.projectId2Name[task.projectId] || task.projectId));
            }
        }
        return result;
    }
    getAttention(all: Task[], now: Date): TaskAttentionItem[] {
        const attention: TaskAttentionItem[] = [];
        for (const task of all) {
            const isFailed = task.status === 'failed';
            const isOverdue = task.isOverdue(now);
            const isDueSoon = task.isDueImminent(TASK_DUE_WINDOW_MS, now) && !isOverdue;
            if (isFailed || isOverdue || isDueSoon) {
                attention.push({
                    id: task.id,
                    title: task.title,
                    projectName: this.projectId2Name[task.projectId] || task.projectId,
                    reason: isFailed ? 'failed' : (isOverdue ? 'overdue' : 'dueSoon'),
                    ...(task.due === undefined ? {} : { due: task.due }),
                });
            }
        }
        return attention;
    }
    
}



