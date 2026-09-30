import { Account, Client, Functions, Realtime, Storage, TablesDB } from 'appwrite'

export const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID)

export const account = new Account(client)
export const tablesDB = new TablesDB(client)
export const storage = new Storage(client)
export const functions = new Functions(client)
export const realtime = new Realtime(client)
