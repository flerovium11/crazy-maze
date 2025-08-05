import { navigateToPage, Pages } from './index.js'
import { configureAudioSettings, Sounds } from './sound.js'

export const start = async () => {
    const backButton = document.getElementById('back-button')
    backButton.onclick = () => {
        Sounds.click.start()
        navigateToPage(Pages.home)
    }

    configureAudioSettings()
}

export const stop = async () => {}
