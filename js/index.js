import * as homeScript from './pages/home.js'
import * as gameScript from './pages/game.js'
import * as settingsScript from './pages/settings.js'
import * as leaderboardScript from './pages/leaderboard.js'
import * as aboutScript from './pages/about.js'

import { loadImage, Images } from './utils.js'
import { loadLevel, Levels } from './levels.js'
import { audioContext, loadAudioSettingsFromStorage } from './sound.js'
import { listenToConnectivity } from './server.js'

export class Pages {
    static home = 'home'
    static leaderboard = 'leaderboard'
    static about = 'about'
    static game = 'game'
    static settings = 'settings'
}

const pageScripts = {
    [Pages.home]: homeScript,
    [Pages.game]: gameScript,
    [Pages.settings]: settingsScript,
    [Pages.leaderboard]: leaderboardScript,
    [Pages.about]: aboutScript,
}

let root
let currentPage
const pagesCache = new Map()

export const navigateToPage = async (page, forceRefresh = false) => {
    if (!root) {
        throw Error('Document has not been initialized yet.')
    }

    if (currentPage === page && !forceRefresh) return

    let html = pagesCache.get(page)

    if (!html) {
        const content = await fetch(`pages/${page}.html`)
        if (!content.ok) {
            throw Error(`Failed to load page: ${page}`)
        }
        html = await content.text()
        pagesCache.set(page, html)
    }

    await pageScripts[currentPage]?.stop()
    root.innerHTML = html
    currentPage = page
    document.title = `Crazy Maze - ${
        page.charAt(0).toUpperCase() + page.slice(1)
    }`
    await pageScripts[page].start()
}

const preloadImages = async () => {
    for (const src of Object.values(Images)) {
        await loadImage(src)
    }

    for (let i = 0; i < 7; i++) {
        await loadImage(`assets/images/marbles/marble${i}.gif`)
    }
}

const preloadLevels = async () => {
    for (const src of Object.values(Levels)) {
        await loadLevel(src)
    }
}

// TODO:
// - [ ] Cordova
// - [ ] Presentation (mirror phone screen to desktop, also sound, script)

const start = async () => {
    root = document.getElementById('game')

    loadAudioSettingsFromStorage()
    listenToConnectivity()

    await navigateToPage(Pages.home)

    // Sound cannot be played until user interacts with page for first time
    document.addEventListener(
        'click',
        () => {
            if (audioContext.state === 'suspended') {
                audioContext.resume()
            }
        },
        { once: true }
    )

    window.addEventListener('error', (err) => {
        console.error('An error occurred:', err.message)
        root.innerHTML = `<h1>Error</h1><p>${err.message}</p>`
    })

    window.addEventListener('unhandledrejection', (err) => {
        root.innerHTML = `<h1 class="error">Error</h1><p class="error">${err.reason.message} ${err.reason.stack}</p>`
    })

    // pre-load all our images in the background
    preloadImages().catch((err) => {
        throw new Error(`Failed to preload images: ${err.message}`, {
            cause: err,
        })
    })

    // pre-load levels in the background
    preloadLevels().catch((err) => {
        throw new Error(`Failed to preload levels: ${err.message}`, {
            cause: err,
        })
    })
}

const stop = async () => {
    await pageScripts[currentPage].stop()
}

document.addEventListener('DOMContentLoaded', start)
document.addEventListener('beforeunload', stop)
