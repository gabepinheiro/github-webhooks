import { Commit, Member, Organization, Repository } from "./types"

export class InMemoryDB {
  private _token: string = ''

  private _orgs: Organization[] = []
  private _members: Member[] = []
  private _repos: Repository[] = []
  private _commits: Commit[] = []

  constructor() {}

  set token(token: string) {
    this._token = token
  }

  get token() {
    return this._token
  }

  get user () {
    return this.user
  }

  set user (data) {
    this.user = data
  }

  get repos () {
    return this._repos
  }

  public createRepository (repository: Repository) {
    this._repos = this._repos.concat(repository)
  }

  set repos (data) {
    this._repos = this._repos.concat(data)
  }

  set orgs (data) {
    this._orgs = this._orgs.concat(data)
  }

  get orgs () {
    return this._orgs
  }

  set members (data) {
    this._members = this._members.concat(data)
  }

  get members () {
    return this._members
  }

  public createCommits(commits: Commit | Commit[]) {
    this._commits = this._commits.concat(commits)
    return commits
  }

  set commits (data) {
    this._commits = this._commits.concat(data)
  }

  get commits () {
    return this._commits
  }
}
