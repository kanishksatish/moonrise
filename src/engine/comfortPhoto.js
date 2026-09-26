// Photos stay in this browser. Only resized JPEG pixels are persisted; the
// original file, filename and embedded metadata are never stored or uploaded.
const DATABASE = 'moonrise-comfort-photos'
const STORE = 'photos'
const MAX_INPUT_BYTES = 8 * 1024 * 1024
const MAX_STORED_BYTES = 500 * 1024
const MAX_EDGE = 960
const MAX_PHOTOS = 20
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const STORAGE_ERROR = 'This device could not access photo storage. Try again.'
const DECODE_ERROR = 'This photo could not be opened. Try another JPEG, PNG, or WebP photo.'
const ENCODE_ERROR = 'This photo could not be prepared. Try another photo.'
const TOO_LARGE_ERROR = 'This photo is still too large after resizing. Choose a smaller or simpler photo.'
const CAP_ERROR = 'This device already has 20 saved photos. Existing photos are kept for past sessions.'

// Pure validation so callers can reject an unsuitable selection before decode.
// Decode still verifies that the supplied bytes are an actual browser image.
export function validateComfortPhotoFile(file) {
  if (!file || !PHOTO_TYPES.has(file.type)) throw new Error('Choose a JPEG, PNG, or WebP photo.')
  if (!Number.isSafeInteger(file.size) || file.size <= 0) throw new Error('Choose a photo that is not empty.')
  if (file.size > MAX_INPUT_BYTES) throw new Error('Choose a photo no larger than 8 MiB.')
  return true
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    let request
    let settled = false
    const fail = () => {
      if (!settled) { settled = true; reject(new Error(STORAGE_ERROR)) }
    }
    try {
      if (!globalThis.indexedDB) { fail(); return }
      request = globalThis.indexedDB.open(DATABASE, 1)
      request.onupgradeneeded = () => {
        try {
          if (!request.result.objectStoreNames.contains(STORE)) {
            request.result.createObjectStore(STORE, { keyPath: 'id' })
          }
        } catch {
          try { request.transaction.abort() } catch { /* Already aborted. */ }
          fail()
        }
      }
      request.onerror = fail
      request.onblocked = fail
      request.onsuccess = () => {
        const database = request.result
        database.onversionchange = () => database.close()
        // A blocked open may later succeed after its caller already failed.
        if (settled) database.close()
        else { settled = true; resolve(database) }
      }
    } catch {
      fail()
    }
  })
}

function decodeWithImage(file) {
  return new Promise((resolve, reject) => {
    let url
    let image
    const release = () => {
      if (image) {
        image.onload = null
        image.onerror = null
        try { image.removeAttribute('src') } catch { /* Cleanup must still release the URL. */ }
      }
      if (url) {
        try { URL.revokeObjectURL(url) } catch { /* The browser may already have released it. */ }
        url = null
      }
    }
    try {
      url = URL.createObjectURL(file)
      image = new Image()
      image.onload = () => {
        const width = image.naturalWidth
        const height = image.naturalHeight
        image.onload = null
        image.onerror = null
        if (width > 0 && height > 0) resolve({ image, width, height, release })
        else { release(); reject(new Error(DECODE_ERROR)) }
      }
      image.onerror = () => { release(); reject(new Error(DECODE_ERROR)) }
      image.src = url
    } catch {
      release()
      reject(new Error(DECODE_ERROR))
    }
  })
}

async function decodePhoto(file) {
  if (typeof globalThis.createImageBitmap === 'function') {
    try {
      const image = await globalThis.createImageBitmap(file)
      if (image.width > 0 && image.height > 0) {
        return {
          image, width: image.width, height: image.height,
          release: () => { try { image.close() } catch { /* Already released. */ } },
        }
      }
      image.close()
    } catch { /* Image fallback also supports browsers without bitmap decode. */ }
  }
  return decodeWithImage(file)
}

async function preparePhoto(file) {
  const decoded = await decodePhoto(file)
  let canvas
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(decoded.width, decoded.height))
    canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(decoded.width * scale))
    canvas.height = Math.max(1, Math.round(decoded.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error(ENCODE_ERROR)
    // JPEG has no alpha; use white behind transparent PNG/WebP pixels.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(decoded.image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error(ENCODE_ERROR)), 'image/jpeg', 0.8)
    })
    if (blob.type !== 'image/jpeg' || !blob.size) throw new Error(ENCODE_ERROR)
    if (blob.size > MAX_STORED_BYTES) {
      throw new Error(TOO_LARGE_ERROR)
    }
    return blob
  } catch (error) {
    // Preserve only the helper's generic errors, never a decoder/canvas detail.
    if (error?.message === TOO_LARGE_ERROR) throw error
    throw new Error(ENCODE_ERROR)
  } finally {
    decoded.release()
    if (canvas) { canvas.width = 0; canvas.height = 0 }
  }
}

// Resolve only after commit, including the count-and-add operation. Readwrite
// transactions serialize access to this store across tabs and concurrent saves.
async function photoTransaction(mode, action) {
  const database = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      let transaction
      let result
      let failure
      try {
        transaction = database.transaction(STORE, mode)
        transaction.oncomplete = () => resolve(result)
        transaction.onabort = () => reject(failure || new Error(STORAGE_ERROR))
        transaction.onerror = () => { /* Failed requests abort and reject above. */ }
        action(transaction.objectStore(STORE), value => { result = value }, message => {
          failure = new Error(message)
          transaction.abort()
        })
      } catch {
        try { transaction?.abort() } catch { /* Already complete or aborted. */ }
        reject(new Error(STORAGE_ERROR))
      }
    })
  } finally {
    database.close()
  }
}

export async function saveComfortPhoto(file) {
  validateComfortPhotoFile(file)
  const blob = await preparePhoto(file)
  let id
  try { id = globalThis.crypto.randomUUID() } catch { throw new Error(STORAGE_ERROR) }
  return photoTransaction('readwrite', (store, result, fail) => {
    const count = store.count()
    count.onsuccess = () => {
      if (count.result >= MAX_PHOTOS) { fail(CAP_ERROR); return }
      // add, never put: an ID collision cannot overwrite a session's photo.
      try { store.add({ id, blob }); result({ id }) } catch { fail(STORAGE_ERROR) }
    }
  })
}

export async function loadComfortPhoto(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(id)) return null
  return photoTransaction('readonly', (store, result) => {
    const request = store.get(id)
    request.onsuccess = () => {
      const blob = request.result?.blob
      result(blob instanceof Blob && blob.type === 'image/jpeg' ? blob : null)
    }
  })
}

// Callers must only pass an unsubmitted draft's ID. Replacing a plan photo
// never authorizes removing the older photo retained by a session snapshot.
export async function deleteComfortPhoto(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(id)) return
  await photoTransaction('readwrite', store => { store.delete(id) })
}

export async function clearComfortPhotos() {
  await photoTransaction('readwrite', store => { store.clear() })
}
