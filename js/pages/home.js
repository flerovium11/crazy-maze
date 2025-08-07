import { navigateToPage } from '../index.js'
import { Sounds } from '../sound.js'
import { Pages } from '../index.js'

export const start = async () => {
    Sounds.mainTheme.start()

    const startButton = document.getElementById('start-race')
    startButton.onclick = () => {
        Sounds.click.start()
        Sounds.mainTheme.stop()
        navigateToPage(Pages.game)
    }

    const settingsButton = document.getElementById('settings-button')
    settingsButton.onclick = () => {
        Sounds.click.start()
        navigateToPage(Pages.settings)
    }

    const leaderboardButton = document.getElementById('leaderboard-button')
    leaderboardButton.onclick = () => {
        Sounds.click.start()
        navigateToPage(Pages.leaderboard)
    }

    const aboutButton = document.getElementById('about-button')
    aboutButton.onclick = () => {
        Sounds.click.start()
        navigateToPage(Pages.about)
    }
}

export const stop = async () => {}
