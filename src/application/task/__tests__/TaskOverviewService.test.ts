import { makeFakeRepos } from "../../__tests__/fakes"
import { Project } from "../../../domain/project/Project"
import { Task } from "../../../domain/task/Task"
import { Record as DomainRecord } from "../../../domain/record/Record"
import { Label } from "../../../domain/label/Label"
import { RECENT_ACTIVITY_LIMIT } from "../../dashboard/DashboardService"
import { TaskOverviewService, TasksOverviewView } from "../TaskOverviewService"


const TODO_NUM = 5
const DOING_NUM = 10
const DONE_NUM = 8
const OVERDUE_NUM = 3
const FAILED_NUM = 2
const PAUSED_NUM = 3

const now = new Date('2026-08-21T12:00:00Z')

let taskOverviewService: TaskOverviewService
let tasksOverview: TasksOverviewView

async function seedData(repos: Awaited<ReturnType<typeof makeFakeRepos>>) {
    const project = Project.create({
        id: 'project-1',
        name: 'Test Project',
        goalId: 'goal-1',
        now,
    })
    await repos.projectRepo.save(project)

    const label = Label.create({ id: 'label-1', name: 'Important', color: '#ff0000' })
    await repos.labelRepo.save(label)

    let counter = 0
    const makeTask = (status: 'todo' | 'doing' | 'done' | 'paused' | 'failed', due?: Date) => {
        counter += 1
        const task = Task.create({
            id: `task-${counter}`,
            title: `Task ${counter}`,
            projectId: project.id,
            due,
            now,
        })
        if (status === 'doing') task.start(now)
        if (status === 'done') {
            task.start(now)
            task.complete(now)
        }
        if (status === 'paused') {
            task.start(now)
            task.pause(now)
        }
        if (status === 'failed') {
            task.start(now)
            task.fail(now)
        }
        task.addLabel(label.id)
        return task
    }

    for (let i = 0; i < TODO_NUM; i += 1) {
        await repos.taskRepo.save(makeTask('todo'))
    }
    for (let i = 0; i < DOING_NUM - OVERDUE_NUM - 1; i += 1) {
        await repos.taskRepo.save(makeTask('doing'))
    }
    for (let i = 0; i < DONE_NUM; i += 1) {
        await repos.taskRepo.save(makeTask('done'))
    }
    for (let i = 0; i < FAILED_NUM; i += 1) {
        await repos.taskRepo.save(makeTask('failed'))
    }
    for (let i = 0; i < PAUSED_NUM; i += 1) {
        await repos.taskRepo.save(makeTask('paused'))
    }
    for (let i = 0; i < OVERDUE_NUM; i += 1) {
        await repos.taskRepo.save(makeTask('doing', new Date(now.getTime() - 24 * 60 * 60 * 1000)))
    }
    await repos.taskRepo.save(makeTask('doing', new Date(now.getTime() + 30 * 60 * 1000)))

    for (let i = 0; i < RECENT_ACTIVITY_LIMIT + 5; i += 1) {
        const record = DomainRecord.create({
            id: `rec-${i}`,
            kind: 'taskStarted',
            occurredAt: new Date(now.getTime() - i * 1000),
        })
        await repos.recordRepo.append(record)
    }
}

beforeAll(async () => {
    const repos = await makeFakeRepos()
    taskOverviewService = new TaskOverviewService(
        repos.taskRepo,
        repos.projectRepo,
        repos.labelRepo,
        repos.recordRepo,
    )
    await seedData(repos)
    tasksOverview = await taskOverviewService.getOverview()
})

describe("TaskOverviewService.getOverview", () => {
    it("counts the doing,todo,done overdue non-archived tasks in the stats", () => {
        const stats = tasksOverview.stats
        expect(stats.todo).toBe(TODO_NUM)
        expect(stats.doing).toBe(DOING_NUM)
        expect(stats.done).toBe(DONE_NUM)
        expect(stats.overdue).toBe(OVERDUE_NUM)
        expect(stats.failed).toBe(FAILED_NUM)
    })
    it("show the attention items", () => {
        const attention = tasksOverview.attention
        expect(attention.length).toBe(6)
    })
    it("show all tasks", () => {
        const allTasks = tasksOverview.allTasks
        expect(allTasks.doing.length).toBe(DOING_NUM)
        expect(allTasks.todo.length).toBe(TODO_NUM)
        expect(allTasks.done.length).toBe(DONE_NUM)
        expect(allTasks.failed.length).toBe(FAILED_NUM)
        expect(allTasks.paused.length).toBe(PAUSED_NUM)
    })
    it("show the recent activities", () => {
        const recentActivities = tasksOverview.recentActivity
        expect(recentActivities.length).toBe(RECENT_ACTIVITY_LIMIT)
    })
})
