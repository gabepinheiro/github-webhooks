import { useQuery } from '@tanstack/react-query'

import GithubLogin from 'react-login-github'

import { useProfile } from './hooks'

const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID

export function App() {
  const { isLoading, isSuccess, profile, handleAuthorize } = useProfile()

  const resultOrgs = useQuery({ queryKey: ['orgs'], queryFn: getOrgs })

  const resultMembers = useQuery({ queryKey: ['members'], queryFn: getMembers })

  const resultRepos = useQuery({ queryKey: ['repos'], queryFn: getRepos })

  const resultCommits = useQuery({ queryKey: ['commits'], queryFn: getCommits })

  function handleSuccess (event: { code: string }) {
    handleAuthorize(event.code)    
   }

  return (
    <div className="App">
      <GithubLogin
        className='btn-login-github'
        clientId={CLIENT_ID}
        redirectUri='http://localhost:3001'
        scope='user,admin:orgs,repo,admin:org_hook'
        onSuccess={handleSuccess}
        disabled={isLoading}
      />

      <h2>Profile: </h2>
      {isLoading && <p>Buscando perfil...</p>}
      {isSuccess && profile && (
        <>
          <p>Name: {profile.name}</p>
          <p>Email: {profile.email}</p>
          <p>Login: {profile.login}</p>
        </>
      )}
      
      <br />

      <h2>Organizações: </h2>
      {resultOrgs.isLoading && <p>Buscando organizações...</p>}
      {resultOrgs.isSuccess && (
        <ul>
          {resultOrgs.data.map(org => <li>{org.login}</li>)}
        </ul>
      )}
      
      <br />

      <h2>Repositórios: </h2>
      {resultRepos.isLoading && <p>Buscando repositórios...</p>}
      {resultRepos.isSuccess && (
        <ul>
          {resultRepos.data.map(repo => <li>{repo.full_name}</li>)}
        </ul>
      )}

      <br />

      <h2>Membros: </h2>
      {resultMembers.isLoading && <p>Buscando membros...</p>}
      {resultMembers.isSuccess && (
        <ul>
          {resultMembers.data.map(member => <li>{member.login}</li>)}
        </ul>
      )}
      
      <br />

      <h2>Commits: </h2>
      {resultCommits.isLoading && <p>Buscando commits...</p>}
      {resultCommits.isSuccess && (
        <ul>
          {resultCommits.data.map(item => <li>{item.commit ? item.commit.message : item.message}</li>)}
        </ul>
      )}
    </div>
  )
}

async function getOrgs () {
  const response  = await fetch('http://localhost:3000/github/orgs')
  const { orgs } = await response.json()

  return orgs
}

async function getRepos () {
  const response  = await fetch('http://localhost:3000/github/repos')
  const { repos } = await response.json()

  return repos
}

async function getMembers () {
  const response  = await fetch('http://localhost:3000/github/members')
  const { members } = await response.json()

  return members
}

async function getCommits () {
  const response  = await fetch('http://localhost:3000/github/commits')
  const { commits } = await response.json()

  return commits
}
