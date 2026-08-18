const STORAGE_KEY = 'music-repertoire-tracker'
let sortColumn = null
let sortOrder = null
const formPanel = document.getElementById('formPanel')
const pieceForm = document.getElementById('pieceForm')
const piecesList = document.getElementById('piecesList')
const stats = document.getElementById('stats')
const toggleFormBtn = document.getElementById('toggleFormBtn')
const cancelEditBtn = document.getElementById('cancelEditBtn')
const exportBtn = document.getElementById('exportBtn')
const importInput = document.getElementById('importInput')
const resetBtn = document.getElementById('resetBtn')
const pieceIdInput = document.getElementById('pieceId')
const searchInput = document.getElementById('searchInput')
const stateFilter = document.getElementById('stateFilter')
const instrumentFilter = document.getElementById('instrumentFilter')
const linkInput = document.getElementById('linkInput')

const normalizeState = (state) => {
  if (state === 'in-progress') return 'in-progress'
  if (state === 'done') return 'done'
  return 'interesting-in-the-future'
}

const stateLabelMap = {
  'interesting-in-the-future': 'Later',
  'in-progress': 'In progress',
  done: 'Done'
}

const defaultPieces = [
  { id: crypto.randomUUID(), title: 'Clair de Lune', artist: 'Claude Debussy', state: 'in-progress', instrument: 'Piano', link: '' },
  { id: crypto.randomUUID(), title: 'Dust in the Wind', artist: 'Kansas', state: 'interesting-in-the-future', instrument: 'Guitar', link: '' },
  { id: crypto.randomUUID(), title: 'Für Elise', artist: 'Ludwig van Beethoven', state: 'done', instrument: 'Piano', link: '' }
]

function normalizeLink(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultPieces
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return defaultPieces
    return parsed.map((piece) => ({
      id: piece.id || crypto.randomUUID(),
      title: String(piece.title || '').trim(),
      artist: String(piece.artist || '').trim(),
      state: normalizeState(piece.state),
      instrument: piece.instrument || 'Piano',
      link: normalizeLink(piece.link)
    })).filter((piece) => piece.title && piece.artist)
  } catch (error) {
    console.error('Could not read repertoire from local storage:', error)
    return defaultPieces
  }
}

function writeStorage(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function getPieces() {
  return readStorage()
}

function renderStats(items) {
  const total = items.length
  const done = items.filter((piece) => piece.state === 'done').length
  const inProgress = items.filter((piece) => piece.state === 'in-progress').length
  const future = items.filter((piece) => piece.state === 'interesting-in-the-future').length

  stats.innerHTML = `
    <span class="stat-item"><span class="stat-label">Total</span><strong>${total}</strong></span>
    <span class="stat-item"><span class="stat-label">Done</span><strong>${done}</strong></span>
    <span class="stat-item"><span class="stat-label">In progress</span><strong>${inProgress}</strong></span>
    <span class="stat-item"><span class="stat-label">Later</span><strong>${future}</strong></span>
  `
}

function getFilteredPieces(items = getPieces()) {
  const query = searchInput.value.trim().toLowerCase()
  const selectedState = stateFilter.value
  const selectedInstrument = instrumentFilter.value

  return items.filter((piece) => {
    const matchesQuery = !query ||
      piece.title.toLowerCase().includes(query) ||
      piece.artist.toLowerCase().includes(query)

    const matchesState = selectedState === 'all' || piece.state === selectedState
    const matchesInstrument = selectedInstrument === 'all' || piece.instrument === selectedInstrument

    return matchesQuery && matchesState && matchesInstrument
  })
}

function sortPieces(pieces) {
  if (!sortColumn || !sortOrder) return pieces

  const sorted = [...pieces]
  sorted.sort((a, b) => {
    let aValue = a[sortColumn]
    let bValue = b[sortColumn]

    if (sortColumn === 'state') {
      const stateOrder = { 'interesting-in-the-future': 0, 'in-progress': 1, 'done': 2 }
      aValue = stateOrder[aValue] ?? 999
      bValue = stateOrder[bValue] ?? 999
    }

    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase()
      bValue = bValue.toLowerCase()
    }

    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
    return 0
  })

  return sorted
}

function setSortColumn(column) {
  if (sortColumn === column) {
    if (sortOrder === 'asc') {
      sortOrder = 'desc'
    } else if (sortOrder === 'desc') {
      sortColumn = null
      sortOrder = null
    }
  } else {
    sortColumn = column
    sortOrder = 'asc'
  }
}

function renderPieces() {
  const allPieces = getPieces()
  let filteredPieces = getFilteredPieces(allPieces)
  filteredPieces = sortPieces(filteredPieces)

  renderStats(allPieces)

  if (!filteredPieces.length) {
    piecesList.innerHTML = '<div class="empty-state">No pieces match your current filters.</div>'
    return
  }

  const stateArrow = sortColumn === 'state' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''
  const instrumentArrow = sortColumn === 'instrument' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''

  piecesList.innerHTML = `
    <table class="repertoire-table">
      <thead>
        <tr>
          <th>Title</th>
          <th>Composer</th>
          <th class="sortable" data-column="state">State${stateArrow}</th>
          <th class="sortable" data-column="instrument">Instrument${instrumentArrow}</th>
          <th>PDF</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${filteredPieces.map((piece) => {
    const stateClass = `state-${piece.state}`
    const pdfCell = piece.link
      ? `<a href="${escapeHtml(piece.link)}" target="_blank" rel="noopener noreferrer">Open PDF</a>`
      : '—'

    return `
            <tr data-id="${piece.id}">
              <td>${escapeHtml(piece.title)}</td>
              <td>${escapeHtml(piece.artist)}</td>
              <td><span class="badge ${stateClass}">${stateLabelMap[piece.state]}</span></td>
              <td><span class="instrument">${escapeHtml(piece.instrument)}</span></td>
              <td>${pdfCell}</td>
              <td class="table-actions">
                <button class="mini-button edit-piece" type="button" data-id="${piece.id}">Edit</button>
                <button class="mini-button delete delete-piece" type="button" data-id="${piece.id}">Delete</button>
              </td>
            </tr>
          `
  }).join('')}
      </tbody>
    </table>
  `

  document.querySelectorAll('th.sortable').forEach((th) => {
    th.addEventListener('click', () => {
      setSortColumn(th.dataset.column)
      renderPieces()
    })
  })


  document.querySelectorAll('.edit-piece').forEach((btn) => {
    btn.addEventListener('click', () => openInlineEditor(btn.dataset.id))
  })

  document.querySelectorAll('.delete-piece').forEach((btn) => {
    btn.addEventListener('click', () => deletePiece(btn.dataset.id))
  })
}

function openInlineEditor(id) {
  const pieces = getPieces()
  const piece = pieces.find((entry) => entry.id === id)
  if (!piece) return

  const row = document.querySelector(`tr[data-id="${id}"]`)
  if (!row) return

  row.innerHTML = `
    <td><input class="inline-edit-input" data-field="title" type="text" value="${escapeHtml(piece.title)}" /></td>
    <td><input class="inline-edit-input" data-field="artist" type="text" value="${escapeHtml(piece.artist)}" /></td>
    <td>
      <select class="inline-edit-select" data-field="state">
        <option value="interesting-in-the-future" ${piece.state === 'interesting-in-the-future' ? 'selected' : ''}>Later</option>
        <option value="in-progress" ${piece.state === 'in-progress' ? 'selected' : ''}>In progress</option>
        <option value="done" ${piece.state === 'done' ? 'selected' : ''}>Done</option>
      </select>
    </td>
    <td>
      <select class="inline-edit-select" data-field="instrument">
        <option value="Piano" ${piece.instrument === 'Piano' ? 'selected' : ''}>Piano</option>
        <option value="Guitar" ${piece.instrument === 'Guitar' ? 'selected' : ''}>Guitar</option>
      </select>
    </td>
    <td><input class="inline-edit-input" data-field="link" type="url" value="${escapeHtml(piece.link || '')}" placeholder="https://drive.google.com/..." /></td>
    <td class="table-actions">
      <div class="inline-action-group">
        <button class="mini-button save-inline-piece" type="button" data-id="${piece.id}">Save</button>
        <button class="mini-button delete cancel-inline-piece" type="button" data-id="${piece.id}">Cancel</button>
      </div>
    </td>
  `

  row.querySelector('.save-inline-piece').addEventListener('click', () => saveInlinePiece(id))
  row.querySelector('.cancel-inline-piece').addEventListener('click', () => renderPieces())
}

function saveInlinePiece(id) {
  const row = document.querySelector(`tr[data-id="${id}"]`)
  if (!row) return

  const title = row.querySelector('[data-field="title"]').value.trim()
  const artist = row.querySelector('[data-field="artist"]').value.trim()
  const state = normalizeState(row.querySelector('[data-field="state"]').value)
  const instrument = row.querySelector('[data-field="instrument"]').value
  const link = normalizeLink(row.querySelector('[data-field="link"]').value)

  if (!title || !artist) {
    alert('Please add both a title and an artist/composer.')
    return
  }

  const pieces = getPieces()
  const index = pieces.findIndex((piece) => piece.id === id)
  if (index === -1) return

  pieces[index] = { ...pieces[index], title, artist, state, instrument, link }
  writeStorage(pieces)
  renderPieces()
}


function openEditor(id) {
  const pieces = getPieces()
  const piece = pieces.find((entry) => entry.id === id)
  if (!piece) return

  pieceIdInput.value = piece.id
  document.getElementById('titleInput').value = piece.title
  document.getElementById('artistInput').value = piece.artist
  document.getElementById('stateInput').value = piece.state
  document.getElementById('instrumentInput').value = piece.instrument
  linkInput.value = piece.link || ''
  formPanel.hidden = false
  document.getElementById('titleInput').focus()
}

function resetForm() {
  pieceForm.reset()
  pieceIdInput.value = ''
  document.getElementById('stateInput').value = 'interesting-in-the-future'
  document.getElementById('instrumentInput').value = 'Piano'
  linkInput.value = ''
  formPanel.hidden = true
}

function savePiece(event) {
  event.preventDefault()

  const title = document.getElementById('titleInput').value.trim()
  const artist = document.getElementById('artistInput').value.trim()
  const state = normalizeState(document.getElementById('stateInput').value)
  const instrument = document.getElementById('instrumentInput').value
  const link = normalizeLink(linkInput.value)

  if (!title || !artist) {
    alert('Please add both a title and an artist/composer.')
    return
  }

  const pieces = getPieces()
  const id = pieceIdInput.value || crypto.randomUUID()

  const nextPiece = { id, title, artist, state, instrument, link }
  const existingIndex = pieces.findIndex((piece) => piece.id === id)

  if (existingIndex >= 0) {
    pieces[existingIndex] = nextPiece
  } else {
    pieces.push(nextPiece)
  }

  writeStorage(pieces)
  renderPieces()
  resetForm()
}

function deletePiece(id) {
  const pieces = getPieces().filter((piece) => piece.id !== id)
  writeStorage(pieces)
  renderPieces()
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function exportJSON() {
  const pieces = getPieces()
  const blob = new Blob([JSON.stringify(pieces, null, 2)], { type: 'application/json' })
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = 'music-repertoire.json'
  link.click()
  URL.revokeObjectURL(href)
}

function importJSON(event) {
  const [file] = event.target.files || []
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result))
      if (!Array.isArray(parsed)) {
        throw new Error('JSON must be an array of pieces.')
      }

      const cleaned = parsed
        .map((piece) => ({
          id: piece.id || crypto.randomUUID(),
          title: String(piece.title || '').trim(),
          artist: String(piece.artist || '').trim(),
          state: normalizeState(piece.state),
          instrument: piece.instrument || 'Piano',
          link: normalizeLink(piece.link)
        }))
        .filter((piece) => piece.title && piece.artist)

      if (!cleaned.length) {
        throw new Error('No valid pieces found in the uploaded file.')
      }

      writeStorage(cleaned)
      renderPieces()
      alert('Your repertoire has been imported from JSON.')
    } catch (error) {
      alert(`Import failed: ${error.message}`)
    } finally {
      event.target.value = ''
    }
  }

  reader.readAsText(file)
}

function clearStorage() {
  const shouldClear = window.confirm('Clear all saved repertoire entries from local storage?')
  if (!shouldClear) return
  localStorage.removeItem(STORAGE_KEY)
  renderPieces()
  resetForm()
}

toggleFormBtn.addEventListener('click', () => {
  if (formPanel.hidden) {
    formPanel.hidden = false
    document.getElementById('titleInput').focus()
  } else {
    resetForm()
  }
})

cancelEditBtn.addEventListener('click', resetForm)
pieceForm.addEventListener('submit', savePiece)
exportBtn.addEventListener('click', exportJSON)
importInput.addEventListener('change', importJSON)
resetBtn.addEventListener('click', clearStorage)
searchInput.addEventListener('input', renderPieces)
stateFilter.addEventListener('change', renderPieces)
instrumentFilter.addEventListener('change', renderPieces)

document.addEventListener('DOMContentLoaded', () => {
  const initial = getPieces()
  if (!localStorage.getItem(STORAGE_KEY) && initial.length) {
    writeStorage(initial)
  }
  renderPieces()
  resetForm()
})
