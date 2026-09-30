import { AppwriteException, ID } from 'appwrite'
import { useSyncExternalStore } from 'react'
import { storage } from './appwrite'
import { BUCKET_ID } from './ids'

export const ACCEPTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf']
export const ACCEPT_ATTRIBUTE = '.jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf'
export const MAX_FILE_BYTES = 10_000_000

/** The SDK uploads files larger than this in 5 MiB chunks and reports progress after each one. */
const CHUNK_BYTES = 5 * 1024 * 1024

/** Small files go up in one request, so there is no progress to show until it finishes. */
export const reportsProgress = (file: File) => file.size > CHUNK_BYTES

/** Checks a file before uploading it. The bucket enforces the same rules. */
export function checkFile(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (extension === 'heic' || extension === 'heif') return 'HEIC photos are not supported. Export as JPG.'
  if (!ACCEPTED_EXTENSIONS.includes(extension)) return 'Outlay reads JPG, PNG, WEBP, and PDF files.'
  if (file.size > MAX_FILE_BYTES) return 'Larger than 10 MB.'
  return null
}

export type Upload = {
  /** Stays the same when an upload is tried again. */
  key: string
  /** The Storage file ID, which is also the ID of the expense the agent creates. */
  fileId: string
  file: File
  previewUrl: string | null
  state: 'blocked' | 'uploading' | 'uploaded' | 'failed'
  progress: number
  error: string | null
  addedAt: number
}

type IntakeState = { uploads: Upload[]; open: boolean }

let state: IntakeState = { uploads: [], open: false }
const listeners = new Set<() => void>()

function setState(next: Partial<IntakeState>) {
  state = { ...state, ...next }
  for (const listener of listeners) listener()
}

function patchUpload(key: string, patch: Partial<Upload>) {
  setState({ uploads: state.uploads.map((upload) => (upload.key === key ? { ...upload, ...patch } : upload)) })
}

function uploadError(error: unknown): string {
  if (error instanceof AppwriteException) {
    if (error.type === 'storage_file_type_unsupported') return 'Outlay reads JPG, PNG, WEBP, and PDF files.'
    if (error.type === 'storage_invalid_file_size') return 'Larger than 10 MB.'
    return error.message
  }
  return 'The upload stopped. Check your connection and try again.'
}

/**
 * Uploads one receipt to the private bucket. No permissions are passed, so
 * Appwrite gives the uploader read, update, and delete access and nobody else
 * anything. The upload event starts the intake agent.
 */
async function upload(key: string) {
  const current = state.uploads.find((item) => item.key === key)
  if (!current) return
  const fileId = ID.unique()
  patchUpload(key, { fileId, state: 'uploading', progress: 0, error: null })
  try {
    await storage.createFile({
      bucketId: BUCKET_ID,
      fileId,
      file: current.file,
      onProgress: ({ progress }) => patchUpload(key, { progress: Math.round(progress) }),
    })
    patchUpload(key, { state: 'uploaded', progress: 100 })
  } catch (error) {
    patchUpload(key, { state: 'failed', error: uploadError(error) })
  }
}

export const intake = {
  /** Adds files to the intake sheet and uploads the ones Outlay can read. */
  add(files: File[]) {
    const added: Upload[] = files.map((file) => {
      const error = checkFile(file)
      return {
        key: ID.unique(),
        fileId: '',
        file,
        previewUrl: file.type.startsWith('image/') && !error ? URL.createObjectURL(file) : null,
        state: error ? 'blocked' : 'uploading',
        progress: 0,
        error,
        addedAt: Date.now(),
      }
    })
    setState({ uploads: [...added.reverse(), ...state.uploads], open: true })
    for (const item of added) if (item.state !== 'blocked') void upload(item.key)
  },
  retry(key: string) {
    void upload(key)
  },
  dismiss(key: string) {
    const item = state.uploads.find((upload) => upload.key === key)
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
    setState({ uploads: state.uploads.filter((upload) => upload.key !== key) })
  },
  setOpen(open: boolean) {
    setState({ open })
  },
  reset() {
    for (const item of state.uploads) if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
    setState({ uploads: [], open: false })
  },
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useIntake(): IntakeState {
  return useSyncExternalStore(subscribe, () => state)
}
