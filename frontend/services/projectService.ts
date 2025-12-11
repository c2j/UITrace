import { apiClient, ApiResponse, PaginatedResponse } from './api';
import { Project, ProjectVersion, ModuleNode, ProjectStats } from '../types';

// Extended types for API responses
export interface CreateProjectRequest {
  name: string;
  icon?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  icon?: string;
}

export interface CreateVersionRequest {
  name: string;
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  releaseDate?: string;
}

export interface UpdateVersionRequest {
  name?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  releaseDate?: string;
}

export interface ProjectWithStats extends Project {
  stats: ProjectStats;
}

// Project service
export const projectService = {
  // Get all projects
  async getProjects(): Promise<ApiResponse<Project[]>> {
    return apiClient.get<Project[]>('/projects');
  },

  // Get project by ID
  async getProject(projectId: string): Promise<ApiResponse<Project>> {
    return apiClient.get<Project>(`/projects/${projectId}`);
  },

  // Create new project
  async createProject(data: CreateProjectRequest): Promise<ApiResponse<Project>> {
    return apiClient.post<Project>('/projects', data);
  },

  // Update project
  async updateProject(projectId: string, data: UpdateProjectRequest): Promise<ApiResponse<Project>> {
    return apiClient.put<Project>(`/projects/${projectId}`, data);
  },

  // Delete project
  async deleteProject(projectId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/projects/${projectId}`);
  },

  // Get project versions
  async getProjectVersions(projectId: string): Promise<ApiResponse<ProjectVersion[]>> {
    return apiClient.get<ProjectVersion[]>(`/projects/${projectId}/versions`);
  },

  // Get specific project version with details
  async getProjectVersion(
    projectId: string,
    versionId: string
  ): Promise<ApiResponse<ProjectVersion>> {
    return apiClient.get<ProjectVersion>(`/projects/${projectId}/versions/${versionId}`);
  },

  // Create new version
  async createVersion(
    projectId: string,
    data: CreateVersionRequest
  ): Promise<ApiResponse<ProjectVersion>> {
    return apiClient.post<ProjectVersion>(`/projects/${projectId}/versions`, data);
  },

  // Update version
  async updateVersion(
    projectId: string,
    versionId: string,
    data: UpdateVersionRequest
  ): Promise<ApiResponse<ProjectVersion>> {
    return apiClient.put<ProjectVersion>(
      `/projects/${projectId}/versions/${versionId}`,
      data
    );
  },

  // Delete version
  async deleteVersion(
    projectId: string,
    versionId: string
  ): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/projects/${projectId}/versions/${versionId}`);
  },

  // Get project statistics
  async getProjectStats(projectId: string): Promise<ApiResponse<ProjectStats>> {
    return apiClient.get<ProjectStats>(`/projects/${projectId}/stats`);
  },

  // Get projects with statistics (for dashboard)
  async getProjectsWithStats(): Promise<ApiResponse<ProjectWithStats[]>> {
    return apiClient.get<ProjectWithStats[]>('/projects/summary');
  },

  // Get modules in a version
  async getVersionModules(
    projectId: string,
    versionId: string
  ): Promise<ApiResponse<ModuleNode[]>> {
    return apiClient.get<ModuleNode[]>(
      `/projects/${projectId}/versions/${versionId}/modules`
    );
  },
};

// Helper function to format version status for display
export function formatVersionStatus(status: string): string {
  switch (status) {
    case 'DRAFT':
      return 'Draft';
    case 'ACTIVE':
      return 'Active';
    case 'ARCHIVED':
      return 'Archived';
    default:
      return status;
  }
}

// Helper function to get status color
export function getVersionStatusColor(status: string): string {
  switch (status) {
    case 'DRAFT':
      return '#666666';
    case 'ACTIVE':
      return '#52c41a';
    case 'ARCHIVED':
      return '#999999';
    default:
      return '#666666';
  }
}