import * as dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'

import SmeeClient from 'smee-client'

import { Octokit } from 'octokit'
import { OAuthApp, createNodeMiddleware } from '@octokit/oauth-app'
import { 
  Webhooks, 
  createNodeMiddleware as createNodeMiddlewareWebhooks,
} from '@octokit/webhooks'

import { InMemoryDB } from './in-memory-db'
import {Commit, Member, Organization, Repository} from './types'

const inMemoryDB = new InMemoryDB()

const octokitOAuthApp = new OAuthApp({
  clientType: 'oauth-app',
  clientId: process.env.GITHUB_CLIENT_ID || '', 
  clientSecret: process.env.GITHUB_CLIENT_SECRET || ''
});

const webhooks = new Webhooks({ secret: process.env.WEBHOOK_SECRET || '' })

const app = express()

app.use(createNodeMiddlewareWebhooks(webhooks, { path: '/webhooks' }))
app.use(createNodeMiddleware(octokitOAuthApp))

app.use(cors())
app.use(express.json())

octokitOAuthApp.on("token", async ({ token, octokit }) => {
  if(inMemoryDB.token) return 

  inMemoryDB.token = token

  const orgs = await octokit.request('GET /user/orgs')

  inMemoryDB.orgs = orgs.data.map<Organization>(item => ({
    id: item.id,
    nodeId: item.node_id,
    name: item.login,
    url: item.url,
    description: item.description,
    avatarUrl: item.avatar_url,
    membersUrl: item.members_url,
    reposUrl: item.repos_url,
  }))

  await octokit.request('POST /orgs/{org}/hooks', {
    org: orgs.data[0].login,
    name: 'web',
    active: true,
    events: [
      'push',
      'pull_request',
      'repository',
      'member',
      'organization'
    ],
    config: {
      url: 'https://smee.io/wVAjhSoQzcEVpbep',
      content_type: 'json',
      secret: 'mysecret'
    }
  })
  
  // const hooks = await octokit.request('GET /orgs/{org}/hooks{?per_page,page}', {
  //    org: 'ORG'
  // })

  const org = await octokit.request('GET /orgs/{org}', {
    org: orgs.data[0].login
  })

  const members = await octokit.request('GET /orgs/{org}/members', {
    org: org.data.login
  })

  inMemoryDB.members = members.data.map<Member>(item => ({
    nodeId: item.node_id,
    login: item.login,
    avatarUrl: item.avatar_url,
  }))

  const repos = await octokit.request('GET /orgs/{org}/repos', {
    org: org.data.login
  })

  await Promise.all(repos.data.map(async repo => {
    const branchs = await octokit.request(`GET /repos/{owner}/{repo}/branches`, {
      owner: repo.owner.login,
      repo: repo.name
    })

    const branchMain = branchs.data.find(branch => branch.name === 'main')

    if(!branchMain) return;

    const commitsBranchMain = await octokit.request('GET /repos/{owner}/{repo}/commits', {
      sha: branchMain.name,
      owner: repo.owner.login,
      repo: repo.name
    })

    const branchsOthers = branchs.data.filter(branch => branch.name !== 'main')

    async function getCommits () {
      for (const branch of branchsOthers) {
        const commits = await octokit.request('GET /repos/{owner}/{repo}/commits', {
          sha: branch.name,
          owner: repo.owner.login,
          repo: repo.name
        })

        const indexDiffCommitEnd = commits.data.findIndex(commit => commitsBranchMain.data.some(item => item.sha === commit.sha))
        const commitsDiff = commits.data.slice(0, indexDiffCommitEnd)

        inMemoryDB.commits = commitsDiff.map<Commit>(item => ({
          sha: item.sha,
          url: item.html_url,
          commit: {
            message: item.commit.message,
            author: {
              name: item.commit.author?.name,
              email: item.commit.author?.email,
              date: item.commit.author?.date
            },
            committer: {
              name: item.commit.committer?.name,
              email: item.commit.committer?.email,
              date: item.commit.committer?.date
            }
          }
        }))
      }
    }

    await getCommits()

    inMemoryDB.commits = commitsBranchMain.data.map<Commit>(item => ({
      sha: item.sha,
      url: item.html_url,
      commit: {
        message: item.commit.message,
        author: {
          name: item.commit.author?.name,
          email: item.commit.author?.email,
          date: item.commit.author?.date
        },
        committer: {
          name: item.commit.committer?.name,
          email: item.commit.committer?.email,
          date: item.commit.committer?.date
        }
      }
    }))
  }))

  inMemoryDB.repos = repos.data.map<Repository>(item => ({
    id: item.node_id,
    name: item.name,
    fullname: item.full_name,
    url: item.html_url
  })) 
});

webhooks.on('push', event => {
  const commits = event.payload.commits.map<Commit>(item => ({
    sha: item.id,
    url: item.url,
    commit: {
      message: item.message,
      author: {
        name: item.author?.name,
        email: item.author?.email,
        date: item.author?.date
      },
      committer: {
        name: item.committer?.name,
        email: item.committer?.email,
        date: item.committer?.date
      }
    }
  }))

  inMemoryDB.createCommits(commits)
})

webhooks.on('repository.created', ({ payload }) => {
  const repository: Repository = {
    id: payload.repository.node_id,
    name: payload.repository.name,
    fullname: payload.repository.full_name,
    url: payload.repository.html_url
  }
 
  inMemoryDB.createRepository(repository)
})

webhooks.on('repository.deleted', event => {
  const id = event.payload.repository.node_id
  inMemoryDB.deleteRepository(id)
})

webhooks.on('organization.member_added', event => {
  const memberResponse = event.payload.membership.user

  const newMember: Member = {
    nodeId: memberResponse.node_id,
    avatarUrl: memberResponse.avatar_url,
    login: memberResponse.login
  }

  inMemoryDB.createMembers(newMember)
})

webhooks.on('organization.member_removed', event => {
  const nodeId = event.payload.membership.user.node_id 

  inMemoryDB.deleteMember(nodeId)
})

app.get('/github/orgs', async (_, res) => {
  // const octokit = new Octokit({ auth: inMemoryDB.token })
  //
  // try {
  //   const orgs = await octokit.request('GET /user/orgs{?since,per_page}', {})
  //   return res.json({ orgs: orgs.data })
  // } catch (err) {
  //   if (err.status === 401) {
  //     return res.status(err.status).json({
  //       error: {
  //         message: 'Unauthorized'
  //       }
  //     })
  //   }
 // }
  
 return res.json({ orgs: inMemoryDB.orgs })
})

app.get('/github/members', (_, res) => {
  return res.json({ members: inMemoryDB.members })
})

app.get('/github/repos', (_, res) => {
  return res.json({ repos: inMemoryDB.repos })
})

app.get('/github/commits', (_, res) => {
  return res.json({ commits: inMemoryDB.commits })
})

app.get('/github/profile', async (req, res) => {
  const token = req.query.token
  
  const octokit = new Octokit({ auth: token })

  const { data } = await octokit.request('GET /user')

  return res.json({ profile: data })
})

const smee = new SmeeClient({
  source: process.env.WEBHOOK_PROXY_URL || '',
  target: 'http://localhost:3000/webhooks',
  logger: console
})

smee.start()

app.listen(3000, () => {
  console.log(`Example app listening at http://localhost:3000`);
});


