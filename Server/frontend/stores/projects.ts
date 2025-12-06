export const useProjectsStore = defineStore('projects', {
  state: () => ({
    projects: [] as any[],
    currentProject: null as any,
    loading: false,
    error: null as string | null
  }),

  getters: {
    getProjectById: (state) => (id: string | number) => {
      return state.projects.find(p => p.id === id)
    },

    activeProjects: (state) => {
      return state.projects.filter(p => p.status === 'active')
    }
  },

  actions: {
    async fetchProjects() {
      this.loading = true
      this.error = null

      try {
        const { $api } = useNuxtApp()
        const projects = await $api('/projects')
        this.projects = projects
        return projects
      } catch (error: any) {
        this.error = error.response?.data?.message || 'Failed to fetch projects'
        throw error
      } finally {
        this.loading = false
      }
    },

    async createProject(projectData: any) {
      this.loading = true
      this.error = null

      try {
        const { $api } = useNuxtApp()
        const project = await $api('/projects', {
          method: 'POST',
          body: projectData
        })

        this.projects.unshift(project)
        return project
      } catch (error: any) {
        this.error = error.response?.data?.message || 'Failed to create project'
        throw error
      } finally {
        this.loading = false
      }
    },

    async updateProject(id: string | number, projectData: any) {
      this.loading = true
      this.error = null

      try {
        const { $api } = useNuxtApp()
        const project = await $api(`/projects/${id}`, {
          method: 'PUT',
          body: projectData
        })

        const index = this.projects.findIndex(p => p.id === id)
        if (index !== -1) {
          this.projects[index] = project
        }

        if (this.currentProject?.id === id) {
          this.currentProject = project
        }

        return project
      } catch (error: any) {
        this.error = error.response?.data?.message || 'Failed to update project'
        throw error
      } finally {
        this.loading = false
      }
    },

    async deleteProject(id: string | number) {
      this.loading = true
      this.error = null

      try {
        const { $api } = useNuxtApp()
        await $api(`/projects/${id}`, {
          method: 'DELETE'
        })

        this.projects = this.projects.filter(p => p.id !== id)

        if (this.currentProject?.id === id) {
          this.currentProject = null
        }
      } catch (error: any) {
        this.error = error.response?.data?.message || 'Failed to delete project'
        throw error
      } finally {
        this.loading = false
      }
    },

    setCurrentProject(project: any) {
      this.currentProject = project
    },

    clearCurrentProject() {
      this.currentProject = null
    }
  }
})