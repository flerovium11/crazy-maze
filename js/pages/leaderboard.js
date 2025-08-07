import { navigateToPage, Pages } from '../index.js'
import { getHighscores } from '../server.js'
import { Sounds } from '../sound.js'

export const start = async () => {
    const backButton = document.getElementById('back-button')
    backButton.onclick = () => {
        Sounds.click.start()
        navigateToPage(Pages.home)
    }

    const infoElement = document.querySelector('.info')
    const leaderboardTable = document.querySelector('table')

    infoElement.innerText = 'Loading leaderboard...'
    let usingFallback = false
    const highscores = await getHighscores(1, () => (usingFallback = true))

    if (highscores.length === 0) {
        infoElement.innerText = 'No highscores available.'
        return
    }

    if (usingFallback) {
        infoElement.innerText =
            'No internet connection, you are viewing a local copy.'
    } else {
        infoElement.style.display = 'none'
    }

    if (!leaderboardTable) {
        console.error('Leaderboard table not found in the DOM.')
        return
    }
    leaderboardTable.innerHTML = `
        <thead>
            <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Time</th>
            </tr>
        </thead>
    `

    const tableBody = document.createElement('tbody')
    highscores.forEach((highscore, index) => {
        const { player_name, time_ms } = highscore
        const row = document.createElement('tr')
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${player_name}</td>
            <td>${(time_ms / 1000).toFixed(2)}s</td>
        `
        tableBody.appendChild(row)
    })
    leaderboardTable.appendChild(tableBody)
}

export const stop = async () => {}
