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

  const orgs = await octokit.request('GET /user/orgs{?since,per_page}', {})

  inMemoryDB.orgs = orgs.data

  await octokit.request('POST /orgs/{org}/hooks', {
    org: orgs.data[0].login,
    name: 'web',
    active: true,
    events: [
      'push',
      'pull_request'
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

  inMemoryDB.members = members.data 

  const repos = await octokit.request('GET /orgs/{org}/repos', {
    org: org.data.login
  })

  const branches = await octokit.request(`GET /repos/{owner}/{repo}/branches`, {
    owner: repos.data[0].owner.login,
    repo: repos.data[0].name
  })

  inMemoryDB.repos = repos.data

  const commits = await octokit.request('GET /repos/{owner}/{repo}/commits{?sha}', {
    sha: branches.data[0].name,
    owner: repos.data[0].owner.login,
    repo: repos.data[0].name
  })

  inMemoryDB.commits = commits.data
});

webhooks.on('push', (event) => {
  console.log(event.payload.commits)
  inMemoryDB.commits = event.payload.commits
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


