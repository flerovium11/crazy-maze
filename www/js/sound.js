import { storageAvailable } from './utils.js'

export const audioContext = new AudioContext()

let soundEffectsEnabled = true
let musicEnabled = true
let globalVolume = 1
const globalGain = audioContext.createGain()
globalGain.gain.value = globalVolume
globalGain.connect(audioContext.destination)

export const setSoundEffectsEnabled = (enabled) => {
    soundEffectsEnabled = enabled

    if (enabled) {
        playingSounds.forEach((sound) => {
            if (sound.type === SoundType.soundEffect) {
                sound.start()
            }
        })
    } else {
        playingSounds.forEach((sound) => {
            if (sound.type === SoundType.soundEffect) {
                sound.stop()
            }
        })
    }
    localStorage.setItem('soundEffectsEnabled', enabled)
}

export const setMusicEnabled = (enabled) => {
    musicEnabled = enabled
    if (enabled) {
        playingSounds.forEach((sound) => {
            if (sound.type === SoundType.music) {
                sound.resume()
            }
        })
    } else {
        playingSounds.forEach((sound) => {
            if (sound.type === SoundType.music) {
                sound.pause()
            }
        })
    }

    localStorage.setItem('musicEnabled', enabled)
}

export const setGlobalVolume = (volume) => {
    globalVolume = volume
    globalGain.gain.value = globalVolume
    localStorage.setItem('globalVolume', globalVolume)
}

export const configureAudioSettings = () => {
    const soundEffectsCheckbox = document.getElementById(
        'sound-effects-checkbox'
    )
    const musicCheckbox = document.getElementById('music-checkbox')
    const volumeSlider = document.getElementById('volume-slider')

    soundEffectsCheckbox.checked = soundEffectsEnabled
    musicCheckbox.checked = musicEnabled
    volumeSlider.value = globalVolume * 100

    soundEffectsCheckbox.onchange = (event) => {
        setSoundEffectsEnabled(event.target.checked)
    }
    musicCheckbox.onchange = (event) => {
        setMusicEnabled(event.target.checked)
    }
    volumeSlider.oninput = (event) => {
        const volume = event.target.value / 100
        setGlobalVolume(volume)
    }
}

export const loadAudioSettingsFromStorage = () => {
    if (!storageAvailable()) {
        console.warn(
            'LocalStorage is not available. Skipping audio settings load.'
        )
        return
    }

    const soundEffects = localStorage.getItem('soundEffectsEnabled')
    const music = localStorage.getItem('musicEnabled')
    const volume = localStorage.getItem('globalVolume')

    if (soundEffects !== null) setSoundEffectsEnabled(soundEffects === 'true')
    if (music !== null) setMusicEnabled(music === 'true')
    if (volume !== null) setGlobalVolume(parseFloat(volume))
}

const fetchAudio = async (src) => {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest()
        request.open('GET', src, true)
        request.responseType = 'arraybuffer'
        request.onload = () => {
            const audioData = request.response
            audioContext.decodeAudioData(
                audioData,
                (buffer) => {
                    resolve(buffer)
                },
                reject
            )
        }
        request.onerror = (err) => {
            reject(err)
        }
        request.send()
    })
}

const createAudioSource = (buffer) => {
    const source = audioContext.createBufferSource()
    source.buffer = buffer
    return source
}

const playingSounds = new Set()

class SoundType {
    static music = 'music'
    static soundEffect = 'sound-effect'
}

export class Sound {
    constructor(src, type, volume = 0.2, loop = false) {
        this.buffer = fetchAudio(src)
        this.volume = volume
        this.loop = loop
        this.sources = new Set()
        this.type = type
        this.src = src
    }

    async start() {
        if (!soundEffectsEnabled && this.type === SoundType.soundEffect) return
        if (!musicEnabled && this.type === SoundType.music) return

        if (this.type === SoundType.music && playingSounds.has(this)) {
            console.warn(`Sound ${this.src} is already playing.`)
            return
        }

        const source = createAudioSource(await this.buffer)
        const gainNode = audioContext.createGain()
        gainNode.gain.value = this.volume
        source.connect(gainNode)
        gainNode.connect(globalGain)
        source.start(0)
        this.sources.add(source)
        playingSounds.add(this)
        source.onended = (ev) => {
            const naturalEnd = this.sources.has(source)
            this.sources.delete(source)
            playingSounds.delete(this)
            if (this.loop && naturalEnd) this.start()
        }
    }

    stop() {
        if (this.sources.size > 0) {
            this.sources.forEach((source) => {
                source.stop()
            })
            this.sources.clear()
            playingSounds.delete(this)
        }
    }

    pause() {
        this.sources.forEach((source) => {
            source.disconnect()
        })
    }

    resume() {
        this.sources.forEach((source) => {
            const gainNode = audioContext.createGain()
            gainNode.gain.value = this.volume
            source.connect(gainNode)
            gainNode.connect(globalGain)
        })
    }
}

class MarbleDropSound {
    start() {
        if (!soundEffectsEnabled) return

        const drops = [0, 0.15, 0.25, 0.32, 0.37, 0.41]
        const volumes = [0.4, 0.3, 0.2, 0.15, 0.1, 0.05]
        const frequencies = [500, 450, 400, 350, 300, 250]

        drops.forEach((time, index) => {
            setTimeout(() => {
                const now = audioContext.currentTime
                const osc = audioContext.createOscillator()
                const gain = audioContext.createGain()

                osc.frequency.setValueAtTime(frequencies[index], now)
                osc.frequency.exponentialRampToValueAtTime(
                    frequencies[index] * 0.5,
                    now + 0.1
                )
                osc.type = 'triangle'

                gain.gain.setValueAtTime(volumes[index], now)
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1)

                osc.connect(gain)
                gain.connect(globalGain)

                osc.start(now)
                osc.stop(now + 0.1)
            }, time * 1000)
        })
    }
}

class MarbleCollisionSound {
    start() {
        if (!soundEffectsEnabled) return
        const now = audioContext.currentTime

        const osc1 = audioContext.createOscillator()
        const osc2 = audioContext.createOscillator()
        const gain = audioContext.createGain()

        osc1.frequency.setValueAtTime(800, now)
        osc2.frequency.setValueAtTime(1600, now)
        osc1.type = 'sine'
        osc2.type = 'sine'

        gain.gain.setValueAtTime(0.2, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02)

        osc1.connect(gain)
        osc2.connect(gain)
        gain.connect(globalGain)

        osc1.start(now)
        osc2.start(now)
        osc1.stop(now + 0.02)
        osc2.stop(now + 0.02)
    }
}

export class MarbleRollingSound {
    type = SoundType.soundEffect

    constructor() {
        this.audioContext = audioContext
        this.isPlaying = false
        this.masterGain = null
        this.noiseSource = null
        this.filter1 = null
        this.filter2 = null
        this.oscillator = null
        this.volume = 0.5
        this.rollSpeed = 1.0
    }

    createNoiseBuffer(duration = 10) {
        const bufferSize = this.audioContext.sampleRate * duration
        const buffer = this.audioContext.createBuffer(
            1,
            bufferSize,
            this.audioContext.sampleRate
        )
        const data = buffer.getChannelData(0)

        let b0 = 0,
            b1 = 0,
            b2 = 0,
            b3 = 0,
            b4 = 0,
            b5 = 0,
            b6 = 0
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1
            b0 = 0.99886 * b0 + white * 0.0555179
            b1 = 0.99332 * b1 + white * 0.0750759
            b2 = 0.969 * b2 + white * 0.153852
            b3 = 0.8665 * b3 + white * 0.3104856
            b4 = 0.55 * b4 + white * 0.5329522
            b5 = -0.7616 * b5 - white * 0.016898
            const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362
            b6 = white * 0.115926
            data[i] = pink * 0.11
        }

        return buffer
    }

    start() {
        if (!soundEffectsEnabled && this.type === SoundType.soundEffect) return
        if (this.isPlaying) return

        this.isPlaying = true

        this.masterGain = this.audioContext.createGain()
        this.masterGain.gain.setValueAtTime(
            this.volume,
            this.audioContext.currentTime
        )
        this.masterGain.connect(globalGain)

        this.noiseSource = this.audioContext.createBufferSource()
        this.noiseSource.buffer = this.createNoiseBuffer()
        this.noiseSource.loop = true

        this.filter1 = this.audioContext.createBiquadFilter()
        this.filter1.type = 'bandpass'
        this.filter1.frequency.setValueAtTime(
            200 * this.rollSpeed,
            this.audioContext.currentTime
        )
        this.filter1.Q.setValueAtTime(3, this.audioContext.currentTime)

        this.filter2 = this.audioContext.createBiquadFilter()
        this.filter2.type = 'highpass'
        this.filter2.frequency.setValueAtTime(50, this.audioContext.currentTime)

        this.oscillator = this.audioContext.createOscillator()
        this.oscillator.frequency.setValueAtTime(
            0.5 * this.rollSpeed,
            this.audioContext.currentTime
        )
        this.oscillator.type = 'sine'

        const oscGain = this.audioContext.createGain()
        oscGain.gain.setValueAtTime(50, this.audioContext.currentTime)

        this.oscillator.connect(oscGain)
        oscGain.connect(this.filter1.frequency)

        this.noiseSource.connect(this.filter1)
        this.filter1.connect(this.filter2)
        this.filter2.connect(this.masterGain)

        playingSounds.add(this)
        this.noiseSource.start(this.audioContext.currentTime)
        this.oscillator.start(this.audioContext.currentTime)
    }

    stop() {
        if (!this.isPlaying) return

        this.isPlaying = false
        playingSounds.delete(this)

        if (this.noiseSource) {
            this.noiseSource.stop()
            this.noiseSource = null
        }

        if (this.oscillator) {
            this.oscillator.stop()
            this.oscillator = null
        }

        if (this.masterGain) {
            this.masterGain.disconnect()
            this.masterGain = null
        }

        this.filter1 = null
        this.filter2 = null
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume))
        if (this.masterGain) {
            this.masterGain.gain.setValueAtTime(
                this.volume,
                this.audioContext.currentTime
            )
        }
    }

    setRollSpeed(speed) {
        this.rollSpeed = Math.max(0.1, Math.min(5, speed))

        if (this.filter1) {
            this.filter1.frequency.setValueAtTime(
                200 * this.rollSpeed,
                this.audioContext.currentTime
            )
        }

        if (this.oscillator) {
            this.oscillator.frequency.setValueAtTime(
                0.5 * this.rollSpeed,
                this.audioContext.currentTime
            )
        }
    }
}

export class Sounds {
    static click = new Sound(
        'assets/sounds/click.wav',
        SoundType.soundEffect,
        0.2
    )
    static gameOver = new Sound(
        'assets/sounds/game-over.mp3',
        SoundType.soundEffect,
        0.1
    )
    static mainTheme = new Sound(
        'assets/sounds/main-theme.mp3',
        SoundType.music,
        0.3,
        true
    )
    static gameComplete = new Sound(
        'assets/sounds/game-complete.mp3',
        SoundType.soundEffect,
        0.2
    )
    static marbleDrop = new MarbleDropSound()
    static marbleCollision = new MarbleCollisionSound()
}
