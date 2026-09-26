// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearComfortPhotos, deleteComfortPhoto, loadComfortPhoto, saveComfortPhoto, validateComfortPhotoFile,
} from '../comfortPhoto.js'

const STORAGE_ERROR = 'This device could not access photo storage. Try again.'
const validFile = () => new Blob(['fixture bytes'], { type: 'image/jpeg' })

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('comfort photo selection validation', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('accepts %s at the inclusive input size limit', type => {
    expect(validateComfortPhotoFile({ type, size: 1 })).toBe(true)
    expect(validateComfortPhotoFile({ type, size: 8 * 1024 * 1024 })).toBe(true)
  })

  it.each([
    ['missing file', null, 'Choose a JPEG, PNG, or WebP photo.'],
    ['SVG', { type: 'image/svg+xml', size: 100 }, 'Choose a JPEG, PNG, or WebP photo.'],
    ['GIF', { type: 'image/gif', size: 100 }, 'Choose a JPEG, PNG, or WebP photo.'],
    ['unknown MIME', { type: '', size: 100 }, 'Choose a JPEG, PNG, or WebP photo.'],
    ['empty file', { type: 'image/jpeg', size: 0 }, 'Choose a photo that is not empty.'],
    ['invalid size', { type: 'image/png', size: NaN }, 'Choose a photo that is not empty.'],
    ['negative size', { type: 'image/webp', size: -1 }, 'Choose a photo that is not empty.'],
    ['oversize file', { type: 'image/jpeg', size: 8 * 1024 * 1024 + 1 }, 'Choose a photo no larger than 8 MiB.'],
  ])('rejects %s before image decode or storage', async (_label, file, message) => {
    const decode = vi.fn()
    const open = vi.fn()
    vi.stubGlobal('createImageBitmap', decode)
    vi.stubGlobal('indexedDB', { open })
    expect(() => validateComfortPhotoFile(file)).toThrow(message)
    await expect(saveComfortPhoto(file)).rejects.toThrow(message)
    expect(decode).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
  })
})

describe('comfort photo lookup and generic failures', () => {
  it.each([undefined, null, '', 123, '../photo', 'https://example.com/photo.jpg', 'data:image/jpeg;base64,AAAA', 'x'.repeat(121)])('returns null for invalid id %j without opening storage', async id => {
    const open = vi.fn()
    vi.stubGlobal('indexedDB', { open })
    await expect(loadComfortPhoto(id)).resolves.toBeNull()
    await expect(deleteComfortPhoto(id)).resolves.toBeUndefined()
    expect(open).not.toHaveBeenCalled()
  })

  it('deletes only the requested photo in a committed write transaction', async () => {
    let transaction
    const remove = vi.fn(() => { queueMicrotask(() => transaction.oncomplete()) })
    const clear = vi.fn()
    const objectStore = vi.fn(() => ({ delete: remove, clear }))
    transaction = { objectStore }
    const database = { transaction: vi.fn(() => transaction), close: vi.fn() }
    vi.stubGlobal('indexedDB', { open: () => {
      const request = { result: database }
      queueMicrotask(() => request.onsuccess())
      return request
    } })
    await expect(deleteComfortPhoto('unsubmitted-photo')).resolves.toBeUndefined()
    expect(database.transaction).toHaveBeenCalledWith('photos', 'readwrite')
    expect(objectStore).toHaveBeenCalledWith('photos')
    expect(remove).toHaveBeenCalledExactlyOnceWith('unsubmitted-photo')
    expect(clear).not.toHaveBeenCalled()
    expect(database.close).toHaveBeenCalledOnce()
  })

  it('rejects an aborted deletion with a generic error and closes the database', async () => {
    let transaction
    transaction = { objectStore: () => ({ delete: () => { queueMicrotask(() => transaction.onabort()) } }) }
    const database = { transaction: () => transaction, close: vi.fn() }
    vi.stubGlobal('indexedDB', { open: () => {
      const request = { result: database }
      queueMicrotask(() => request.onsuccess())
      return request
    } })
    await expect(deleteComfortPhoto('draft-photo')).rejects.toThrow(STORAGE_ERROR)
    expect(database.close).toHaveBeenCalledOnce()
  })

  it('returns null for a well-formed id absent from storage and closes the database', async () => {
    let transaction
    const get = vi.fn(() => {
      const request = { result: undefined }
      queueMicrotask(() => {
        request.onsuccess()
        transaction.oncomplete()
      })
      return request
    })
    transaction = { objectStore: () => ({ get }) }
    const database = { transaction: () => transaction, close: vi.fn() }
    vi.stubGlobal('indexedDB', { open: () => {
      const request = { result: database }
      queueMicrotask(() => request.onsuccess())
      return request
    } })
    await expect(loadComfortPhoto('missing-photo')).resolves.toBeNull()
    expect(get).toHaveBeenCalledWith('missing-photo')
    expect(database.close).toHaveBeenCalledOnce()
  })

  it('uses a generic error if photo storage is unavailable or throws internal details', async () => {
    vi.stubGlobal('indexedDB', undefined)
    await expect(loadComfortPhoto('photo-1')).rejects.toThrow(STORAGE_ERROR)
    vi.stubGlobal('indexedDB', { open: () => { throw new Error('private internal storage detail') } })
    await expect(loadComfortPhoto('photo-1')).rejects.toThrow(STORAGE_ERROR)
    await expect(clearComfortPhotos()).rejects.toThrow(STORAGE_ERROR)
    await expect(deleteComfortPhoto('draft-photo')).rejects.toThrow(STORAGE_ERROR)
  })

  it('reports a generic decode failure, releases its fallback URL, and never opens storage', async () => {
    const open = vi.fn()
    const revokeObjectURL = vi.fn()
    const removeAttribute = vi.fn()
    vi.stubGlobal('indexedDB', { open })
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('private filename and decoder detail')))
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:fixture-photo', revokeObjectURL })
    vi.stubGlobal('Image', class {
      removeAttribute = removeAttribute
      set src(_value) { queueMicrotask(() => this.onerror?.(new Error('private image detail'))) }
    })
    await expect(saveComfortPhoto(validFile())).rejects.toThrow('This photo could not be opened. Try another JPEG, PNG, or WebP photo.')
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:fixture-photo')
    expect(removeAttribute).toHaveBeenCalledWith('src')
    expect(open).not.toHaveBeenCalled()
  })

  it('releases the bitmap and rejects an oversized encoded photo before storage', async () => {
    const close = vi.fn()
    const open = vi.fn()
    const drawImage = vi.fn()
    const canvas = {
      width: 0, height: 0,
      getContext: () => ({ fillRect: vi.fn(), drawImage }),
      toBlob: (done, type, quality) => {
        expect([canvas.width, canvas.height]).toEqual([960, 480])
        expect(type).toBe('image/jpeg')
        expect(quality).toBe(0.8)
        done({ type: 'image/jpeg', size: 500 * 1024 + 1 })
      },
    }
    const bitmap = { width: 1920, height: 960, close }
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
    vi.stubGlobal('document', { createElement: () => canvas })
    vi.stubGlobal('indexedDB', { open })
    await expect(saveComfortPhoto(validFile())).rejects.toThrow('This photo is still too large after resizing. Choose a smaller or simpler photo.')
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 960, 480)
    expect(close).toHaveBeenCalledOnce()
    expect([canvas.width, canvas.height]).toEqual([0, 0])
    expect(open).not.toHaveBeenCalled()
  })

  it('hides canvas internals and releases the bitmap if re-encoding fails', async () => {
    const close = vi.fn()
    const open = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 400, height: 300, close }))
    vi.stubGlobal('document', { createElement: () => ({
      getContext: () => ({ fillRect: () => {}, drawImage: () => { throw new Error('private canvas detail') } }),
    }) })
    vi.stubGlobal('indexedDB', { open })
    await expect(saveComfortPhoto(validFile())).rejects.toThrow('This photo could not be prepared. Try another photo.')
    expect(close).toHaveBeenCalledOnce()
    expect(open).not.toHaveBeenCalled()
  })
})
