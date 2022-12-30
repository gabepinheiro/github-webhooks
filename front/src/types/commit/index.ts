export interface Commit {
  sha: string
  url: string
  commit: {
    message: string
    author: {
      name?: string
      email?: string | null
      date?: string
    },
    committer: {
      name?: string
      email?: string | null
      date?: string
    }
  }
}
