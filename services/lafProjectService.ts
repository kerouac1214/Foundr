import { ProjectMetadata, StoryboardItem, GlobalContext } from '../types';

const LAF_APP_ID = 'mzr18raqjh';
const LAF_BASE_URL = `https://${LAF_APP_ID}.sealosbja.site`;

export interface CloudProject {
    _id: string;
    projectMetadata: ProjectMetadata;
    script: string;
    globalContext: GlobalContext;
    storyboard: StoryboardItem[];
}

export const lafProjectService = {
    async listProjects(): Promise<{ _id: string, projectMetadata: ProjectMetadata }[]> {
        const response = await fetch(`${LAF_BASE_URL}/project-manager`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'list' })
        });
        const result = await response.json();
        if (result.error) throw new Error(result.error);
        return result.projects || [];
    },

    async getProject(id: string): Promise<CloudProject> {
        const response = await fetch(`${LAF_BASE_URL}/project-manager`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get', id })
        });
        const result = await response.json();
        if (result.error) throw new Error(result.error);
        return result.project;
    },

    async saveProject(project: Omit<CloudProject, '_id'> & { _id?: string }): Promise<string> {
        const response = await fetch(`${LAF_BASE_URL}/project-manager`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'save',
                id: project._id,
                data: project
            })
        });
        const result = await response.json();
        if (result.error) throw new Error(result.error);
        return result.id;
    },

    async deleteProject(id: string): Promise<void> {
        const response = await fetch(`${LAF_BASE_URL}/project-manager`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', id })
        });
        const result = await response.json();
        if (result.error) throw new Error(result.error);
    }
};
