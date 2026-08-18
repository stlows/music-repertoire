let sortColumn = null
let sortOrder = null
let isSyncing = false

const formPanel = document.getElementById('formPanel')
const pieceForm = document.getElementById('pieceForm')
const piecesList = document.getElementById('piecesList')
const stats = document.getElementById('stats')
const toggleFormBtn = document.getElementById('toggleFormBtn')
const cancelEditBtn = document.getElementById('cancelEditBtn')
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

function normalizeLink(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

// ============================================
// SUPABASE SYNC FUNCTIONS
// ============================================

async function syncPieceToSupabase(piece) {
  if (!window.supabaseAuth?.isLoggedIn()) return

  try {
    const { supabase } = window.supabaseAuth
    const userId = window.supabaseAuth.getUser().id

    const { error } = await supabase
      .from('pieces')
      .upsert(
        {
          id: piece.id,
          user_id: userId,
          title: piece.title,
          artist: piece.artist,
          state: piece.state,
          instrument: piece.instrument,
          link: piece.link || null
        },
        { onConflict: 'id' }
      )

    if (error) console.error('Error syncing piece:', error)
  } catch (error) {
    console.error('Sync error:', error)
  }
}

async function deletePieceFromSupabase(id) {
  if (!window.supabaseAuth?.isLoggedIn()) return

  try {
    const { supabase } = window.supabaseAuth

    const { error } = await supabase
      .from('pieces')
      .delete()
      .eq('id', id)

    if (error) console.error('Error deleting piece:', error)
  } catch (error) {
    console.error('Delete sync error:', error)
  }
}

async function getPiecesFromSupabase() {
  if (!window.supabaseAuth?.isLoggedIn()) return

  try {
    isSyncing = true
    const { supabase } = window.supabaseAuth
    const userId = window.supabaseAuth.getUser().id

    const { data, error } = await supabase
      .from('pieces')
      .select('id, title, artist, state, instrument, link')
      .eq('user_id', userId)

    if (error) throw error

    if (data && data.length > 0) {
      const pieces = data.map((piece) => ({
        id: piece.id,
        title: piece.title,
        artist: piece.artist,
        state: piece.state,
        instrument: piece.instrument,
        link: piece.link || ''
      }))
      return pieces
    }
  } catch (error) {
    console.error('Sync from Supabase error:', error)
  } finally {
    isSyncing = false
  }
}

async function getPieceFromSupabase(id) {
  if (!window.supabaseAuth?.isLoggedIn()) return

  try {
    isSyncing = true
    const { supabase } = window.supabaseAuth
    const userId = window.supabaseAuth.getUser().id

    const { data, error } = await supabase
      .from('pieces')
      .select('id, title, artist, state, instrument, link')
      .eq('user_id', userId)
      .eq('id', id)

    if (error) throw error

    if (data && data.length == 1) {
      const piece = data[0]
      return piece
    }
  } catch (error) {
    console.error('Sync from Supabase error:', error)
  } finally {
    isSyncing = false
  }
}

// Make sync function available globally
window.getPiecesFromSupabase = getPiecesFromSupabase

function normalizeLink(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
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

function getFilteredPieces(items) {
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

async function renderPieces() {
  const allPieces = await getPiecesFromSupabase()
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

async function openInlineEditor(id) {
  const piece = await getPieceFromSupabase(id)
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

async function saveInlinePiece(id) {
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

  const piece = await getPieceFromSupabase(id)
  if (!piece) return

  const updatedPiece = { ...piece, title, artist, state, instrument, link }

  syncPieceToSupabase(updatedPiece)
  renderPieces()
}

function resetForm() {
  pieceForm.reset()
  pieceIdInput.value = ''
  document.getElementById('stateInput').value = 'interesting-in-the-future'
  document.getElementById('instrumentInput').value = 'Piano'
  linkInput.value = ''
  formPanel.hidden = true
}

async function savePiece(event) {
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

  const pieces = await getPiecesFromSupabase()

  const nextPiece = { title, artist, state, instrument, link }

  syncPieceToSupabase(nextPiece)
  renderPieces()
  resetForm()
}

function deletePiece(id) {
  deletePieceFromSupabase(id)
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
searchInput.addEventListener('input', renderPieces)
stateFilter.addEventListener('change', renderPieces)
instrumentFilter.addEventListener('change', renderPieces)

document.addEventListener('DOMContentLoaded', () => {
  renderPieces()
  resetForm()
})
