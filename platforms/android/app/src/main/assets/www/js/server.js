import { SUPABASE_KEY, SUPABASE_URL } from './config.js'
import { xhrRequest, storageAvailable, isCordova } from './utils.js'

const insertIntoHighscoresTable = async (payload) => {
    await xhrRequest({
        url: `${SUPABASE_URL}/highscores?on_conflict=player_id,level`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
            apiKey: SUPABASE_KEY,
        },
        body: payload,
    })
}

export const insertHighscore = async (playerName, level, timeMs) => {
    if (!storageAvailable('localStorage')) {
        throw Error('Local storage is not available.')
    }

    let playerId = localStorage.getItem('playerId')
    if (!playerId) {
        console.info('No player ID found, generating a new one.')
        playerId = crypto.randomUUID()
        localStorage.setItem('playerId', playerId)
    }

    const payload = JSON.stringify({
        player_id: playerId,
        player_name: playerName,
        level,
        time_ms: timeMs,
    })

    // Always also keep a local copy, not only as fallback
    localStorage.setItem(`highscore_${level}`, payload)

    try {
        await insertIntoHighscoresTable(payload)
    } catch (error) {
        console.error('Failed to insert highscore:', error)
        console.info('Falling back to local storage.')

        const unsyncedHighscores = getUnsyncedHighscores()
        unsyncedHighscores.push(payload)
        localStorage.setItem(
            `unsynced_highscores`,
            JSON.stringify(unsyncedHighscores)
        )
    }
}

export class HighscoreType {
    static personal = 'personal'
    static global = 'global'
    static none = 'none'
}

export const getHighscoreType = async (level, timeMs) => {
    if (!storageAvailable('localStorage')) {
        throw Error('Local storage is not available.')
    }

    const highscores = await getHighscores(level)
    if (highscores.length === 0 || highscores[0].time_ms > timeMs) {
        return HighscoreType.global
    }

    // Server will never be more up-to-date than our local copy
    // (if localStorage is lost the player_id will also be lost)
    const highscore = localStorage.getItem(`highscore_${level}`)
    if (highscore) {
        const { time_ms } = JSON.parse(highscore)
        return timeMs < time_ms ? HighscoreType.personal : HighscoreType.none
    }

    return HighscoreType.personal
}

export const getHighscores = async (level, onFallback = null) => {
    const localFallback = () => {
        console.info('Falling back to local storage.')
        onFallback?.()

        if (!storageAvailable('localStorage')) {
            throw Error('Local storage is not available.')
        }

        const highscores = localStorage.getItem(`highscores_${level}`)
        return highscores ? JSON.parse(highscores) : []
    }

    if (!isOnline) return localFallback()

    try {
        const response = await xhrRequest({
            url: `${SUPABASE_URL}/highscores?level=eq.${level}&select=player_name,time_ms&order=time_ms.asc`,
            method: 'GET',
            headers: {
                apiKey: SUPABASE_KEY,
            },
        })

        const data = JSON.parse(response)
        localStorage.setItem(`highscores_${level}`, JSON.stringify(data))
        return data
    } catch (error) {
        console.error('Failed to fetch highscores:', error)
        return localFallback()
    }
}

export let isOnline = true
export const listenToConnectivity = () => {
    isOnline = isCordova
        ? navigator.connection.type !== Connection.NONE
        : window.navigator.onLine

    const onOnline = () => {
        isOnline = true
        syncHighscores()
    }

    const onOffline = () => {
        isOnline = false
    }

    // window for browser and document for cordova-plugin-network-information
    window.addEventListener('online', onOnline)
    document.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('offline', onOffline)
}

const syncHighscores = async () => {
    if (!storageAvailable('localStorage')) {
        throw Error('Local storage is not available.')
    }

    const unsyncedHighscores = getUnsyncedHighscores()

    const failed = []
    for (const payload of unsyncedHighscores) {
        try {
            await insertIntoHighscoresTable(payload)
            console.info('Successfully synced unsynced highscore:', payload)
        } catch (error) {
            console.error('Failed to sync unsynced highscore:', error)
            failed.push(payload)
        }
    }

    localStorage.setItem(`unsynced_highscores`, JSON.stringify(failed))
}

export const getUnsyncedHighscores = () => {
    if (!storageAvailable('localStorage')) {
        throw Error('Local storage is not available.')
    }

    return JSON.parse(localStorage.getItem(`unsynced_highscores`) || '[]')
}
