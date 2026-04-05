/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AuthResponse } from '../models/AuthResponse';
import type { CreateTaskRequest } from '../models/CreateTaskRequest';
import type { CredentialRequest } from '../models/CredentialRequest';
import type { ErrorResponse } from '../models/ErrorResponse';
import type { HealthResponse } from '../models/HealthResponse';
import type { PatchTaskRequest } from '../models/PatchTaskRequest';
import type { Task } from '../models/Task';
import type { TaskListResponse } from '../models/TaskListResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class DefaultService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Health check
     * @returns HealthResponse Service is up
     * @throws ApiError
     */
    public getHealth(): CancelablePromise<HealthResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/health',
        });
    }
    /**
     * Register
     * @param requestBody
     * @returns AuthResponse Registered
     * @returns ErrorResponse Error
     * @throws ApiError
     */
    public register(
        requestBody: CredentialRequest,
    ): CancelablePromise<AuthResponse | ErrorResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/auth/register',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Login
     * @param requestBody
     * @returns AuthResponse OK
     * @returns ErrorResponse Error
     * @throws ApiError
     */
    public login(
        requestBody: CredentialRequest,
    ): CancelablePromise<AuthResponse | ErrorResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/auth/login',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * List tasks
     * @param page
     * @param limit
     * @returns TaskListResponse Paginated task list
     * @returns ErrorResponse Error
     * @throws ApiError
     */
    public listTasks(
        page: number = 1,
        limit: number = 20,
    ): CancelablePromise<TaskListResponse | ErrorResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/tasks',
            query: {
                'page': page,
                'limit': limit,
            },
        });
    }
    /**
     * Create a task
     * @param requestBody
     * @returns ErrorResponse Error
     * @returns Task Created
     * @throws ApiError
     */
    public createTask(
        requestBody: CreateTaskRequest,
    ): CancelablePromise<ErrorResponse | Task> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/tasks',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get task by id
     * @param taskId
     * @returns Task Task
     * @returns ErrorResponse Error
     * @throws ApiError
     */
    public getTask(
        taskId: number,
    ): CancelablePromise<Task | ErrorResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/tasks/{taskId}',
            path: {
                'taskId': taskId,
            },
            errors: {
                404: `Not found`,
            },
        });
    }
    /**
     * Partially update a task
     * @param taskId
     * @param requestBody
     * @returns Task Updated task
     * @returns ErrorResponse Error
     * @throws ApiError
     */
    public patchTask(
        taskId: number,
        requestBody: PatchTaskRequest,
    ): CancelablePromise<Task | ErrorResponse> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/tasks/{taskId}',
            path: {
                'taskId': taskId,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Delete a task
     * @param taskId
     * @returns {{ ok: true }} Deleted (HTTP 200)
     * @returns ErrorResponse Error
     * @throws ApiError
     */
    public deleteTask(
        taskId: number,
    ): CancelablePromise<{ ok: boolean } | ErrorResponse> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/tasks/{taskId}',
            path: {
                'taskId': taskId,
            },
        });
    }
}
