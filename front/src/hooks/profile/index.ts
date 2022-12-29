import { useMutation, useQueryClient } from '@tanstack/react-query'
import {useState} from 'react'

export interface Profile  {
  name: string
  email: string
  login: string
}

async function getProfileGithub(token: string): Promise<Profile> {
  const profileResponse = await fetch(`http://localhost:3000/github/profile?token=${token}`)
  const { profile } = await profileResponse.json()

  return profile
}

async function authorize (code: string): Promise<string> {
  const response = await fetch("http://localhost:3000/api/github/oauth/token", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ code })
  })
  
  const { authentication: { token } } = await response.json()
  return token
}

export function useProfile () {
  const [profile, setProfile] = useState<Profile | null>(null)

  const queryClient = useQueryClient()

  const { mutate, isLoading, isSuccess } = useMutation(authorize, {
    async onSuccess(token) { 
      const profile = await getProfileGithub(token) 
      setProfile(profile)
      queryClient.refetchQueries() 
    }
  })

  function handleAuthorize(code: string) { mutate(code) }

  return {
    isLoading,
    isSuccess,
    profile, 
    handleAuthorize, 
  }
}

