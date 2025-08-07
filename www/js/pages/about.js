import { navigateToPage, Pages } from '../index.js'
import { Sounds } from '../sound.js'
import { pauseMainMusic, resumeMainMusic } from '../sound.js'

export const start = async () => {
    document.addEventListener('pause', pauseMainMusic)
    document.addEventListener('resume', resumeMainMusic)

    const backButton = document.getElementById('back-button')
    backButton.onclick = () => {
        Sounds.click.start()
        navigateToPage(Pages.home)
    }
}

export const stop = async () => {
    document.removeEventListener('pause', pauseMainMusic)
    document.removeEventListener('resume', resumeMainMusic)
}
